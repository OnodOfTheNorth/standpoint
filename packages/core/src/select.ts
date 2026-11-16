/**
 * Adaptive selection: which prompt comes next.
 *
 * Order of precedence:
 *   1. a pending reason probe or challenge follow-up
 *   2. the next node inside the current arc or descent
 *   3. the trunk, in order
 *   4. stop if the mode's decision budget is spent
 *   5. a detected tension, as a challenge (within the mode's quota)
 *   6. a requested descent
 *   7. the next slot of the mode's template (arc, pressure, practice, targeted probe, ...)
 *   8. the node with the highest expected resolution of remaining fog
 */
import type { Bundle, Cond, Node } from '@standpoint/content/schema';
import type { Mode, Prompt, State } from './types.js';
import { MODE_TARGET } from './types.js';
import { evaluate } from './cond.js';
import { holdings } from './holdings.js';
import { jitter } from './rng.js';
import { keystones, liveTensions, tensionFamily } from './structure.js';
import { ORIGIN_OPTIONS } from './state.js';
import { arcPositions, descentPositions, discrimination, holdingsRelevance, keystoneAdjacency, situationRelevance, tensionCloseness } from './relevance.js';

type Slot = 'arc' | 'pressure' | 'escalation' | 'practice' | 'trajectory' | 'descent' | 'origin' | 'probe' | 'probe-tension' | 'probe-split' | 'probe-keystone';

const TEMPLATES: Record<Mode, Slot[]> = {
  sketch: ['pressure', 'escalation', 'practice'],
  // Three targeted probes follow the first descent, once arcs and descent have made holdings firm: one that
  // could complete a half-met tension rule, one that splits the nearest traditions, one next to a keystone.
  // Plain probe slots, ranked by fog, made Survey worse; these are ranked by purpose (relevance.ts).
  survey: ['practice', 'arc', 'pressure', 'arc', 'trajectory', 'descent', 'probe-tension', 'probe-split', 'probe-keystone', 'arc', 'pressure', 'origin', 'practice', 'trajectory', 'origin', 'descent'],
  excavation: ['practice', 'arc', 'pressure', 'trajectory', 'arc', 'descent', 'origin', 'practice', 'trajectory', 'arc', 'pressure', 'origin', 'descent'],
};
const CHALLENGE_QUOTA: Record<Mode, number> = { sketch: 1, survey: 4, excavation: Infinity };

export interface Candidate {
  kind: Slot | 'challenge';
  id: string;
  score: number;
}

function interest(s: State, domain: string): number {
  const total = Object.values(s.domainEngagement).reduce((a, d) => a + d.answered, 0) || 1;
  const d = s.domainEngagement[domain];
  if (!d) return 1;
  const declined = d.declined / Math.max(1, d.answered + d.declined);
  return 1 + 0.6 * (d.answered / total) - 0.8 * declined;
}

/** Expected resolution a node buys, weighted by importance and interest. */
export function gain(b: Bundle, s: State, n: Node): number {
  const h = holdings(b, s);
  const touched = new Map<string, number>();
  const see = (pos: string, w: number) => {
    const p = b.positions[pos];
    if (!p) return;
    touched.set(p.problematic, Math.max(touched.get(p.problematic) ?? 0, Math.abs(w)));
  };
  for (const o of n.options) {
    o.evidence.forEach((e) => see(e.position, e.w));
    o.probe?.options.forEach((po) => po.evidence.forEach((e) => see(e.position, e.w * 0.7)));
  }
  n.allocate?.items.forEach((it) => it.evidence.forEach((e) => see(e.position, e.w)));
  let g = 0;
  for (const [pid, w] of touched) {
    const pr = b.problematics[pid]!;
    const fog = h.byProblematic[pid]?.fog ?? 1;
    g += (pr.importance / 2) * fog * interest(s, pr.domain) * (1 - Math.exp(-w / 2));
  }
  return g;
}

/**
 * Arc relevance. Fog alone gave every respondent the same first arc (the parish arc touches the most open
 * ground of any), so fog gain is scaled by how well the arc's setting matches the Situation and practice
 * (relevance.ts) and by how much of its ground the respondent's nearest traditions take a stand on.
 * Tuned on the persona suite (42 personas): eleven distinct first arcs instead of one. Holdings weights
 * below about 0.8 let later arcs drift to settings that only match the Situation, which cost the
 * self-reliant shopkeeper its keystones and the domestic radical its "with the empire abroad" reading.
 */
const ARC_SITUATION = 1;
const ARC_HOLDINGS = 1;
/**
 * Descent relevance from holdings: the share of the descent's ground on which the respondent's nearest
 * traditions take a stand. Complements the gate-based weight below; without it a liberal went into the
 * conservatism descent because its gate opened on one incidental holding.
 */
const DESCENT_HOLDINGS = 1;
/**
 * In Survey, an arc or descent is not started with fewer than this many decisions left in the budget: it
 * would run several prompts past the budget, and the reading would rest on half a story. The remaining
 * template slots (pressure, origin, practice, trajectory) or a probe take its place.
 */
const ARC_FIT = 4;

function arcScore(b: Bundle, s: State, arcId: string): number {
  const arc = b.arcs[arcId]!;
  let g = 0;
  for (const id of arc.nodes) g += gain(b, s, b.nodes[id]!);
  g /= Math.sqrt(arc.nodes.length);
  // variety: prefer arcs on ground not yet covered by finished arcs
  const doneTags = new Set(s.arcsStarted.flatMap((a) => b.arcs[a]?.tags ?? []));
  const overlap = arc.tags.length ? arc.tags.filter((t) => doneTags.has(t)).length / arc.tags.length : 0;
  const rel = 1 + ARC_SITUATION * situationRelevance(s, arcId) + ARC_HOLDINGS * holdingsRelevance(b, s, arcPositions(b, arcId));
  return g * (1 - 0.4 * overlap) * rel;
}

/** Positions a gate condition tests, collected recursively (negated branches excluded). */
function gatePositions(c: Cond | undefined, out: Set<string> = new Set()): Set<string> {
  if (!c) return out;
  if ('holds' in c) out.add(c.holds);
  else if ('holdsAll' in c) c.holdsAll.forEach((p) => out.add(p));
  else if ('holdsAny' in c) c.holdsAny.forEach((p) => out.add(p));
  else if ('weight' in c && c.weight.gt !== undefined) out.add(c.weight.position);
  else if ('all' in c) c.all.forEach((x) => gatePositions(x, out));
  else if ('any' in c) c.any.forEach((x) => gatePositions(x, out));
  return out;
}

/**
 * How strongly the evidence points into a gated descent: the firmest holding among the positions its gate
 * tests. Gates open easily once a few scenes have been answered, and fog alone then decides: a Catholic
 * integralist went into the liberal or libertarian descent rather than the religious one, and a Maoist into
 * the libertarian one rather than the communist one, because that ground was emptier. A descent exists to
 * go deeper where the evidence already points (brief 5.2), so relevance scales the fog gain. The weight is
 * moderate: much larger values let incidental holdings pull respondents into the wrong region (tuned on
 * the persona suite; 0.2 to 0.5 behave the same there).
 */
const DESCENT_RELEVANCE = 0.35;
function descentRelevance(b: Bundle, s: State, gate: Cond | undefined): number {
  const h = holdings(b, s);
  let m = 0;
  for (const p of gatePositions(gate)) m = Math.max(m, h.byPosition[p]?.weight ?? 0);
  return m;
}

function eligible(b: Bundle, s: State, n: Node | undefined): n is Node {
  return !!n && !s.visited.has(n.id) && evaluate(b, s, n.gate);
}

export function candidates(b: Bundle, s: State, kind: Slot): Candidate[] {
  const out: Candidate[] = [];
  const j = (id: string) => jitter(s.seed, id) * 1e-6;
  switch (kind) {
    case 'arc':
      for (const a of Object.values(b.arcs)) {
        if (s.arcsStarted.includes(a.id) || s.standaloneEscalations.includes(a.id)) continue;
        if (!eligible(b, s, b.nodes[a.start])) continue;
        out.push({ kind, id: a.id, score: arcScore(b, s, a.id) + j(a.id) });
      }
      break;
    case 'escalation':
      for (const a of Object.values(b.arcs)) {
        if (s.arcsStarted.includes(a.id) || s.standaloneEscalations.includes(a.id)) continue;
        const n = b.nodes[a.escalation];
        if (!eligible(b, s, n)) continue;
        // in sketch mode there is no arc state, so gates on arc flags are ignored by requiring no gate
        if (n.gate) continue;
        out.push({ kind, id: n.id, score: gain(b, s, n) + j(n.id) });
      }
      break;
    case 'pressure': {
      // A pressure scene tests a principle against the respondent's own interest, so it is eligible only
      // when the respondent holds the principle it tests; one that tests a keystone ranks first.
      const h = holdings(b, s);
      const ks = new Set(keystones(b, s, 5).map((k) => k.position));
      for (const id of b.pressure) {
        const n = b.nodes[id];
        if (!eligible(b, s, n)) continue;
        if (!n.tests || !h.byPosition[n.tests] || !h.held.some((x) => x.position === n.tests)) continue;
        out.push({ kind, id, score: gain(b, s, n) + (n.gate ? 1 : 0) + (ks.has(n.tests) ? 2 : 0) + j(id) });
      }
      break;
    }
    case 'practice':
    case 'trajectory':
      for (const id of b.modules) {
        const n = b.nodes[id];
        if (!n || n.type !== kind || !eligible(b, s, n)) continue;
        out.push({ kind, id, score: -b.modules.indexOf(id) }); // module order is authored order
      }
      break;
    case 'descent':
      for (const d of Object.values(b.descents)) {
        if (s.descentsDone.includes(d.id) || s.currentDescent === d.id) continue;
        if (!evaluate(b, s, d.gate)) continue;
        const n = b.nodes[d.entry];
        if (!eligible(b, s, n)) continue;
        let g = 0;
        for (const id of d.nodes) g += gain(b, s, b.nodes[id]!);
        out.push({ kind, id: d.id, score: (g / Math.sqrt(d.nodes.length)) * (1 + DESCENT_RELEVANCE * descentRelevance(b, s, d.gate)) * (1 + DESCENT_HOLDINGS * holdingsRelevance(b, s, descentPositions(b, d.id))) + j(d.id) });
      }
      break;
    case 'origin':
      for (const k of keystones(b, s, 5)) {
        if (s.visited.has(`origin:${k.position}`)) continue;
        out.push({ kind, id: k.position, score: k.score });
      }
      break;
    case 'probe':
      for (const id of b.probes) {
        const n = b.nodes[id];
        if (!eligible(b, s, n)) continue;
        out.push({ kind, id, score: gain(b, s, n) + j(id) });
      }
      break;
    case 'probe-tension':
    case 'probe-split':
    case 'probe-keystone': {
      // only probes that serve the slot's purpose; if none does, the slot falls back to the plain fog ranking
      const f = kind === 'probe-tension' ? tensionCloseness : kind === 'probe-split' ? discrimination : keystoneAdjacency;
      for (const id of b.probes) {
        const n = b.nodes[id];
        if (!eligible(b, s, n)) continue;
        const r = f(b, s, n);
        if (r > 0) out.push({ kind, id, score: gain(b, s, n) * r + j(id) });
      }
      break;
    }
  }
  out.sort((a, z) => z.score - a.score || a.id.localeCompare(z.id));
  return out;
}

function doneCount(b: Bundle, s: State, k: Slot): number {
  switch (k) {
    case 'arc':
      return s.arcsStarted.length;
    case 'escalation':
      return s.standaloneEscalations.length;
    case 'pressure':
      return s.kinds.pressure ?? 0;
    case 'practice':
      return s.kinds['type:practice'] ?? 0;
    case 'trajectory':
      return s.kinds['type:trajectory'] ?? 0;
    case 'descent':
      return s.descentsDone.length + (s.currentDescent ? 1 : 0);
    case 'origin':
      return s.kinds.origin ?? 0;
    case 'probe':
    case 'probe-tension':
    case 'probe-split':
    case 'probe-keystone':
      return s.kinds.probe ?? 0;
  }
}

export type NextStep = { prompt: Prompt; notices: string[] } | { prompt: null; notices: string[]; done: true; reason: string };

export function nextPrompt(b: Bundle, s: State): NextStep {
  const notices = [...s.notices];
  const ret = (p: Prompt | null, reason = 'complete'): NextStep => (p ? { prompt: p, notices } : { prompt: null, notices, done: true, reason });

  // 1. pending probe
  if (s.pendingProbe) {
    const pp = s.pendingProbe;
    const base = pp.node.startsWith('challenge:') ? null : b.nodes[pp.node];
    return ret({
      id: `${pp.node}#probe`,
      kind: 'probe',
      type: 'reason',
      title: base?.title,
      text: pp.probe.ask,
      options: pp.probe.options.map((o, i) => ({ id: `p${i}`, text: o.text })),
      premises: [],
      conditions: [],
      context: ctx(b, s, base ?? undefined),
    });
  }
  // 2. inside an arc or descent
  if (s.arcNext) {
    const n = b.nodes[s.arcNext];
    if (n && !s.visited.has(n.id)) return ret(nodePrompt(b, s, n));
  }
  // 3. trunk
  for (const id of b.trunk) {
    const n = b.nodes[id];
    if (eligible(b, s, n)) return ret(nodePrompt(b, s, n));
  }
  // 4. budget
  const target = MODE_TARGET[s.mode];
  if (s.decisions >= target) return ret(null, 'budget');

  // 5. challenges: one per tension family per session, never two in a row
  const used = s.kinds.challenge ?? 0;
  if (used < CHALLENGE_QUOTA[s.mode] && !lastWasChallenge(s)) {
    const live = openChallenges(b, s);
    if (live.length) return ret(challengePrompt(b, s, live[0]!.rule));
  }
  // 6. requested descents
  for (const d of s.descentsRequested) {
    const desc = b.descents[d];
    if (!desc || s.descentsDone.includes(d)) continue;
    const n = b.nodes[desc.entry];
    if (n && !s.visited.has(n.id)) return ret(nodePrompt(b, s, n));
  }
  // 7. template slots
  const need: Partial<Record<Slot, number>> = {};
  for (const slot of TEMPLATES[s.mode]) {
    // targeted probe slots share one count: the n-th probe slot is filled once n probes are answered
    const fam: Slot = slot.startsWith('probe') ? 'probe' : slot;
    need[fam] = (need[fam] ?? 0) + 1;
    if (doneCount(b, s, slot) >= need[fam]!) continue;
    if (s.mode === 'survey' && (slot === 'arc' || slot === 'descent') && target - s.decisions < ARC_FIT) continue;
    const p = promptFor(b, s, slot) ?? (fam === 'probe' ? promptFor(b, s, 'probe') : null);
    if (p) return ret(p);
  }
  // 8. fill
  if (s.mode === 'excavation') {
    const pool: Candidate[] = [];
    for (const k of ['arc', 'descent', 'pressure', 'probe', 'origin', 'practice', 'trajectory'] as Slot[]) {
      const c = candidates(b, s, k)[0];
      if (!c) continue;
      const bias = k === 'arc' ? 1.3 : k === 'descent' ? 1.2 : k === 'origin' ? 0.5 : 1;
      pool.push({ ...c, score: (k === 'origin' || k === 'practice' || k === 'trajectory' ? 0.2 : c.score) * bias });
    }
    pool.sort((a, z) => z.score - a.score || a.id.localeCompare(z.id));
    for (const c of pool) {
      const p = promptFor(b, s, c.kind as Slot);
      if (p) return ret(p);
    }
    const live = lastWasChallenge(s) ? [] : openChallenges(b, s);
    if (live.length) return ret(challengePrompt(b, s, live[0]!.rule));
    return ret(null, 'exhausted');
  }
  const p = promptFor(b, s, 'probe') ?? promptFor(b, s, 'pressure') ?? promptFor(b, s, 'descent') ?? promptFor(b, s, 'arc');
  return ret(p, 'exhausted');
}

/** Live tensions whose family has not yet been put to the respondent. */
function openChallenges(b: Bundle, s: State) {
  const faced = new Set(Object.keys(s.tensions).map((r) => tensionFamily(b, r)));
  return liveTensions(b, s).filter((t) => !s.tensions[t.rule] && !faced.has(t.family));
}

/** True when the last answered prompt was a challenge or a reason probe that followed one. */
function lastWasChallenge(s: State): boolean {
  const last = s.answers.at(-1);
  return !!last && (last.node.startsWith('challenge:') || (last.node.endsWith('#probe') && last.node.startsWith('challenge:')));
}

function promptFor(b: Bundle, s: State, slot: Slot): Prompt | null {
  const c = candidates(b, s, slot)[0];
  if (!c) return null;
  switch (slot) {
    case 'arc':
      return nodePrompt(b, s, b.nodes[b.arcs[c.id]!.start]!);
    case 'descent':
      return nodePrompt(b, s, b.nodes[b.descents[c.id]!.entry]!);
    case 'origin':
      return originPrompt(b, s, c.id);
    default:
      return nodePrompt(b, s, b.nodes[c.id]!);
  }
}

function ctx(b: Bundle, s: State, n?: Node): Prompt['context'] {
  const target = MODE_TARGET[s.mode];
  const c: Prompt['context'] = { decisions: s.decisions, target: Number.isFinite(target) ? target : null, mode: s.mode };
  if (n?.arc) {
    const a = b.arcs[n.arc];
    if (a) c.arc = { id: a.id, title: a.title, role: a.role, place: a.place };
  }
  if (n?.descent) {
    const d = b.descents[n.descent];
    if (d) c.descent = { id: d.id, title: d.title };
  }
  return c;
}

export function nodePrompt(b: Bundle, s: State, n: Node): Prompt {
  const standaloneEsc = n.type === 'escalation' && n.arc && s.currentArc !== n.arc;
  return {
    id: n.id,
    kind: 'node',
    type: n.type,
    role: n.role,
    title: n.title,
    text: standaloneEsc && n.recap ? `${n.recap} ${n.text}` : n.text,
    voices: n.voices,
    cases: n.cases,
    allocate: n.allocate ? { budget: n.allocate.budget, unit: n.allocate.unit, items: n.allocate.items.map((i) => ({ id: i.id, text: i.text })) } : undefined,
    multi: n.multi,
    options: n.allocate ? [] : n.options.map((o) => ({ id: o.id, text: o.text })),
    premises: n.premises.map((p) => ({ id: p.id, text: p.text })),
    conditions: n.conditions.map((p) => ({ id: p.id, text: p.text })),
    context: ctx(b, s, n),
  };
}

export function challengePrompt(b: Bundle, s: State, ruleId: string): Prompt {
  const t = b.tensions[ruleId]!;
  return {
    id: `challenge:${t.id}`,
    kind: 'challenge',
    type: 'challenge',
    title: 'A tension in your answers',
    text: t.prompt,
    options: t.resolutions.map((r) => ({ id: r.id, text: r.text })),
    premises: [],
    conditions: [],
    context: ctx(b, s),
  };
}

export function originPrompt(b: Bundle, s: State, positionId: string): Prompt {
  const p = b.positions[positionId]!;
  return {
    id: `origin:${positionId}`,
    kind: 'origin',
    type: 'origin',
    title: 'Where did this come from?',
    text: `Your answers lean hard on this: “${p.you}” Where did it mainly come from?`,
    options: ORIGIN_OPTIONS.map((o) => ({ id: o.id, text: o.text })),
    premises: [],
    conditions: [],
    context: ctx(b, s),
  };
}

/** Resolve any prompt id back to a prompt, for explain/back navigation. */
export function promptById(b: Bundle, s: State, id: string): Prompt | null {
  if (id.startsWith('challenge:')) return b.tensions[id.slice(10)] ? challengePrompt(b, s, id.slice(10)) : null;
  if (id.startsWith('origin:')) return b.positions[id.slice(7)] ? originPrompt(b, s, id.slice(7)) : null;
  const n = b.nodes[id];
  return n ? nodePrompt(b, s, n) : null;
}
