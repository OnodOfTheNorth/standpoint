/**
 * Event-sourced state. All state is recomputed from the session log.
 */
import type { Bundle, Evidence, Node, Option } from '@standpoint/content/schema';
import { CAUSES } from '@standpoint/content/schema';
import type { AnswerEvent, LogEvent, Session, State, TrailItem } from './types.js';
import { evaluate } from './cond.js';
import { holdings } from './holdings.js';

export const ORIGIN_OPTIONS = [
  { id: 'work', text: 'Experience at work' },
  { id: 'family', text: 'Family' },
  { id: 'school', text: 'School or university' },
  { id: 'church', text: 'A church, mosque, temple or other religious community' },
  { id: 'media', text: 'News, social media, or podcasts' },
  { id: 'organization', text: 'An organization I belonged to' },
  { id: 'books', text: 'Books and study' },
  { id: 'event', text: 'A specific event I lived through' },
  { id: 'hardship', text: 'Hardship in my own life' },
] as const;
export const LIVED_ORIGINS = new Set(['work', 'event', 'hardship']);

export function emptyState(session: Pick<Session, 'mode' | 'respondent' | 'seed'>): State {
  return {
    rev: 0,
    mode: session.mode,
    respondent: session.respondent,
    seed: session.seed,
    answers: [],
    visited: new Set(),
    decisions: 0,
    scores: {},
    trail: {},
    corrections: {},
    situation: {},
    situationSkipped: false,
    practice: new Set(),
    practiceAnswered: 0,
    flags: {},
    arcsDone: [],
    arcsStarted: [],
    arcStartResolution: {},
    descentsDone: [],
    descentsRequested: [],
    causes: Object.fromEntries(CAUSES.map((c) => [c, 0])) as State['causes'],
    causeTrail: [],
    sides: [],
    pressures: [],
    tensions: {},
    trajectory: {},
    origins: {},
    affordances: [],
    disputes: [],
    notes: {},
    domainEngagement: {},
    notices: [],
    standaloneEscalations: [],
    kinds: {},
    migrated: [],
  };
}

/** Resolve undo events into the effective event list. */
export function effectiveLog(log: LogEvent[]): LogEvent[] {
  const out: LogEvent[] = [];
  for (const ev of log) {
    if (ev.t === 'undo') {
      for (let i = out.length - 1; i >= 0; i--) {
        if (out[i]!.t === 'answer') {
          out.splice(i, 1);
          break;
        }
      }
    } else out.push(ev);
  }
  return out;
}

export function replay(b: Bundle, session: Session): State {
  const s = emptyState(session);
  for (const ev of effectiveLog(session.log)) apply(b, s, ev);
  return s;
}

function addEvidence(s: State, ev: Evidence, item: Omit<TrailItem, 'w'>, scale = 1) {
  const w = ev.w * scale;
  if (!w) return;
  s.scores[ev.position] = (s.scores[ev.position] ?? 0) + w;
  (s.trail[ev.position] ??= []).push({ ...item, w: Math.round(w * 100) / 100 });
  s.rev++;
}

function touchDomains(b: Bundle, s: State, evs: Evidence[], declined: boolean) {
  const doms = new Set<string>();
  for (const e of evs) {
    const p = b.positions[e.position];
    if (p) doms.add(b.problematics[p.problematic]!.domain);
  }
  for (const d of doms) {
    const de = (s.domainEngagement[d] ??= { answered: 0, declined: 0 });
    if (declined) de.declined++;
    else de.answered++;
  }
}

export function nodeEvidence(n: Node): Evidence[] {
  const out: Evidence[] = [];
  for (const o of n.options) {
    out.push(...o.evidence);
    for (const po of o.probe?.options ?? []) out.push(...po.evidence);
  }
  for (const a of [...n.premises, ...n.conditions]) out.push(...a.evidence);
  for (const it of n.allocate?.items ?? []) out.push(...it.evidence);
  return out;
}

export function resolveNext(b: Bundle, s: State, o: Option | undefined): string | undefined {
  if (!o?.next) return undefined;
  if (typeof o.next === 'string') return o.next;
  for (const x of o.next) if (evaluate(b, s, x.if)) return x.to;
  return undefined;
}

function snapshotResolution(b: Bundle, s: State): Record<string, number> {
  const h = holdings(b, s);
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(h.byProblematic)) out[k] = v.resolution;
  return out;
}

function arcLearned(b: Bundle, s: State, arcId: string): string | null {
  const before = s.arcStartResolution[arcId] ?? {};
  const h = holdings(b, s);
  let best: { gain: number; pid: string } | null = null;
  for (const [pid, ps] of Object.entries(h.byProblematic)) {
    const gain = ps.resolution - (before[pid] ?? 0);
    if (gain > 0.05 && ps.holdings.length && (!best || gain > best.gain || (gain === best.gain && pid < best.pid))) best = { gain, pid };
  }
  if (!best) return null;
  const top = h.byProblematic[best.pid]!.holdings[0]!;
  const pos = b.positions[top.position]!;
  return pos.you;
}

function endArc(b: Bundle, s: State, arcId: string) {
  if (!s.arcsDone.includes(arcId)) s.arcsDone.push(arcId);
  s.currentArc = undefined;
  s.arcNext = undefined;
  const learned = arcLearned(b, s, arcId);
  const arc = b.arcs[arcId];
  if (learned && arc) s.notices.push(`What the instrument just learned from “${arc.title}”: ${learned}`);
}

export function apply(b: Bundle, s: State, ev: LogEvent) {
  switch (ev.t) {
    case 'answer':
      s.notices = [];
      applyAnswer(b, s, ev);
      s.answers.push(ev);
      return;
    case 'situation':
      if (ev.value === null || (Array.isArray(ev.value) && !ev.value.length)) delete s.situation[ev.field];
      else s.situation[ev.field] = ev.value;
      s.situationSkipped = false;
      s.rev++;
      return;
    case 'skip-situation':
      s.situationSkipped = true;
      return;
    case 'correct':
      if (ev.stance === 'clear') delete s.corrections[ev.position];
      else {
        s.corrections[ev.position] = ev.stance;
        (s.trail[ev.position] ??= []).push({
          node: 'correction',
          label: ev.stance === 'hold' ? 'You corrected this: you hold it.' : 'You corrected this: you do not hold it.',
          w: 0,
          kind: 'correction',
          index: s.answers.length,
        });
      }
      s.rev++;
      return;
    case 'dispute':
      s.disputes.push({ claim: ev.claim, text: ev.text, at: ev.at });
      return;
    case 'mode':
      s.mode = ev.mode;
      return;
    case 'descend':
      if (!s.descentsRequested.includes(ev.descent)) s.descentsRequested.push(ev.descent);
      return;
    case 'note':
      s.notes[ev.key] = ev.text;
      return;
    case 'undo':
      return;
  }
}

function applyAnswer(b: Bundle, s: State, ev: AnswerEvent) {
  const index = s.answers.length;
  // ---- probe follow-ups
  if (ev.node.endsWith('#probe')) {
    const pending = s.pendingProbe;
    const base = ev.node.slice(0, -'#probe'.length);
    s.pendingProbe = undefined;
    if (!pending || pending.node !== base) {
      s.migrated.push(ev.node);
      return;
    }
    if (ev.affordance) {
      s.affordances.push({ node: ev.node, kind: ev.affordance, text: ev.text, premise: ev.premise, condition: ev.condition });
      return;
    }
    const i = Number((ev.option ?? '').replace(/^p/, ''));
    const po = pending.probe.options[i];
    if (!po) {
      s.migrated.push(ev.node);
      return;
    }
    for (const e of po.evidence) addEvidence(s, e, { node: base, label: `${pending.probe.ask} → ${po.text}`, kind: 'probe', index });
    if (po.cause) {
      s.causes[po.cause]++;
      s.causeTrail.push({ node: base, cause: po.cause, label: po.text });
    }
    touchDomains(b, s, po.evidence, false);
    if (base.startsWith('challenge:')) {
      const rec = s.tensions[base.slice('challenge:'.length)];
      if (rec) rec.followup = po.text;
    }
    return;
  }

  // ---- challenges
  if (ev.node.startsWith('challenge:')) {
    const id = ev.node.slice('challenge:'.length);
    const rule = b.tensions[id];
    if (!rule) {
      s.migrated.push(ev.node);
      return;
    }
    s.decisions++;
    s.kinds.challenge = (s.kinds.challenge ?? 0) + 1;
    s.visited.add(ev.node);
    if (ev.affordance) {
      s.tensions[id] = { rule: id, status: 'confronted', resolution: ev.affordance, kind: ev.affordance === 'reject' ? 'reject' : 'declined', index };
      s.affordances.push({ node: ev.node, kind: ev.affordance, text: ev.text, premise: ev.premise, condition: ev.condition });
      return;
    }
    const r = rule.resolutions.find((x) => x.id === ev.option);
    if (!r) {
      s.migrated.push(ev.node);
      return;
    }
    s.tensions[id] = { rule: id, status: 'confronted', resolution: r.id, kind: r.kind, index };
    if (r.revise)
      addEvidence(s, { position: r.revise, w: -Math.max(3, (s.scores[r.revise] ?? 0) * 0.8) }, { node: ev.node, label: `Challenge: ${r.text}`, kind: 'challenge', index });
    for (const e of r.evidence) addEvidence(s, e, { node: ev.node, label: `Challenge: ${r.text}`, kind: 'challenge', index });
    if (r.kind === 'hold')
      for (const p of rule.between) if (b.positions[p]) addEvidence(s, { position: p, w: 0.5 }, { node: ev.node, label: `Held both under challenge: ${r.text}`, kind: 'challenge', index });
    if (r.followup) s.pendingProbe = { node: ev.node, option: r.id, probe: r.followup, label: r.text };
    return;
  }

  // ---- origins of keystones
  if (ev.node.startsWith('origin:')) {
    const pid = ev.node.slice('origin:'.length);
    s.visited.add(ev.node);
    s.kinds.origin = (s.kinds.origin ?? 0) + 1;
    s.decisions++;
    if (ev.affordance) {
      s.affordances.push({ node: ev.node, kind: ev.affordance, text: ev.text });
      return;
    }
    if (ev.option) s.origins[pid] = ev.option;
    return;
  }

  // ---- content nodes
  const n = b.nodes[ev.node];
  if (!n) {
    s.migrated.push(ev.node);
    return;
  }
  s.visited.add(n.id);
  s.decisions++;
  s.kinds[n.role ?? 'node'] = (s.kinds[n.role ?? 'node'] ?? 0) + 1;
  s.kinds[`type:${n.type}`] = (s.kinds[`type:${n.type}`] ?? 0) + 1;
  if (n.set) Object.assign(s.flags, n.set);

  // arc bookkeeping on entry
  if (n.arc) {
    const arc = b.arcs[n.arc];
    if (arc && s.currentArc !== n.arc) {
      if (n.id === arc.start) {
        s.currentArc = n.arc;
        if (!s.arcsStarted.includes(n.arc)) s.arcsStarted.push(n.arc);
        s.arcStartResolution[n.arc] = snapshotResolution(b, s);
      } else if (n.type === 'escalation') {
        if (!s.standaloneEscalations.includes(n.arc)) s.standaloneEscalations.push(n.arc);
      }
    }
  }
  if (n.descent && s.currentDescent !== n.descent) {
    const d = b.descents[n.descent];
    if (d && n.id === d.entry) s.currentDescent = n.descent;
  }

  let chosen: Option | undefined;
  const label = (t: string) => `${shortText(n.text)} → ${t}`;

  if (ev.affordance) {
    s.affordances.push({ node: n.id, kind: ev.affordance, premise: ev.premise, condition: ev.condition, text: ev.text });
    const aff =
      ev.affordance === 'reject'
        ? n.premises.find((p) => p.id === ev.premise)
        : ev.affordance === 'depends'
          ? n.conditions.find((p) => p.id === ev.condition)
          : undefined;
    if (aff)
      for (const e of aff.evidence)
        addEvidence(s, e, { node: n.id, label: `${ev.affordance === 'reject' ? 'Rejected the premise' : 'It depends'}: ${aff.text}`, kind: ev.affordance === 'reject' ? 'premise' : 'condition', index });
    touchDomains(b, s, nodeEvidence(n), ev.affordance === 'decline');
    if (n.type === 'escalation') {
      const axis = n.options.find((o) => o.side)?.side?.axis ?? 'class';
      s.sides.push({ node: n.id, arc: n.arc, axis, dir: 'declined', option: ev.affordance });
    }
    if (n.type === 'pressure' && n.tests) s.pressures.push({ node: n.id, tests: n.tests, outcome: 'evaded', option: ev.affordance });
    if (n.type === 'practice') s.practiceAnswered++;
    // the story continues along the first option's path
    chosen = undefined;
    advance(b, s, n, n.options[0], true);
    return;
  }

  if (n.allocate && ev.alloc) {
    const items = n.allocate.items;
    const total = Object.values(ev.alloc).reduce((a, z) => a + Math.max(0, z), 0) || 1;
    for (const it of items) {
      const share = Math.max(0, ev.alloc[it.id] ?? 0) / total;
      const factor = Math.min(share * items.length, 2.5);
      for (const e of it.evidence)
        addEvidence(s, e, { node: n.id, label: label(`${it.text}: ${ev.alloc[it.id] ?? 0} of ${n.allocate.budget}`), kind: 'allocation', index }, factor);
    }
    touchDomains(b, s, nodeEvidence(n), false);
    advance(b, s, n, n.options[0], true);
    return;
  }

  const chosenIds = ev.options ?? (ev.option ? [ev.option] : []);
  const chosenOpts = chosenIds.map((id) => n.options.find((o) => o.id === id)).filter((o): o is Option => !!o);
  if (!chosenOpts.length) {
    s.migrated.push(n.id);
    return;
  }
  for (const o of chosenOpts) {
    for (const e of o.evidence) addEvidence(s, e, { node: n.id, label: label(o.text), kind: 'answer', index });
    if (o.cause) {
      s.causes[o.cause]++;
      s.causeTrail.push({ node: n.id, cause: o.cause, label: o.text });
    }
    if (o.side) s.sides.push({ node: n.id, arc: n.arc, axis: o.side.axis, dir: o.side.dir, option: o.id });
    if (o.pressure && n.tests) s.pressures.push({ node: n.id, tests: n.tests, outcome: o.pressure, option: o.id, cost: o.cost });
    if (o.set) Object.assign(s.flags, o.set);
    if (o.practice) for (const p of o.practice) if (p !== 'practice.none') s.practice.add(p);
    if (o.value !== undefined && n.field) {
      const target = n.type === 'situation' ? s.situation : s.trajectory;
      if (n.multi) {
        const cur = target[n.field];
        target[n.field] = [...(Array.isArray(cur) ? cur : cur ? [cur] : []), o.value];
      } else target[n.field] = o.value;
      s.rev++;
    }
    touchDomains(b, s, o.evidence, false);
  }
  if (n.type === 'practice') s.practiceAnswered++;
  chosen = chosenOpts[0];
  if (chosen?.probe && !ev.options) s.pendingProbe = { node: n.id, option: chosen.id, probe: chosen.probe, label: chosen.text };
  advance(b, s, n, chosen, false);
}

/** Move the story along after a node is answered. */
function advance(b: Bundle, s: State, n: Node, o: Option | undefined, viaAffordance: boolean) {
  if (n.arc) {
    if (s.currentArc !== n.arc) return; // standalone escalation: no continuation
    const next = resolveNext(b, s, o) ?? (viaAffordance ? firstNext(b, s, n) : undefined);
    if (next && !o?.end) s.arcNext = next;
    else endArc(b, s, n.arc);
    return;
  }
  if (n.descent) {
    if (s.currentDescent !== n.descent) return;
    const next = resolveNext(b, s, o) ?? (viaAffordance ? firstNext(b, s, n) : undefined);
    if (next && !o?.end) s.arcNext = next;
    else {
      if (!s.descentsDone.includes(n.descent)) s.descentsDone.push(n.descent);
      s.currentDescent = undefined;
      s.arcNext = undefined;
      s.descentsRequested = s.descentsRequested.filter((d) => d !== n.descent);
      const d = b.descents[n.descent];
      if (d) s.notices.push(`Descent complete: ${d.title}.`);
    }
  }
}

function firstNext(b: Bundle, s: State, n: Node): string | undefined {
  for (const o of n.options) {
    const x = resolveNext(b, s, o);
    if (x) return x;
  }
  return undefined;
}

export function shortText(t: string, n = 60): string {
  const one = t.replace(/\s+/g, ' ').trim();
  return one.length > n ? one.slice(0, n - 1).trimEnd() + '…' : one;
}
