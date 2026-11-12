/**
 * Content lints. Structural problems are always errors. Coverage lints
 * (reach >= 3, floors, pressure coverage) are errors under --strict or
 * STANDPOINT_STRICT=1, which CI sets, and warnings otherwise.
 */
import type { Bundle, Cond, Node } from './schema.js';
import { CLASS_IDS } from './schema.js';

export const FLOORS = {
  problematics: 120,
  positions: 700,
  traditions: 140,
  thinkers: 100,
  events: 60,
  debates: 50,
  arcs: 24,
  nodes: 450,
  tensions: 150,
} as const;

/** Narrator-voice terms forbidden outside quoted speech (brief 4.3). */
const LOADED: { re: RegExp; label: string }[] = [
  { re: /\bregimes?\b/i, label: 'regime' },
  { re: /\bstrongm[ae]n\b/i, label: 'strongman' },
  { re: /\bfree world\b/i, label: 'free world' },
  { re: /\bextremis[tm]s?\b/i, label: 'extremist' },
  { re: /\bmoderates?\b/i, label: 'moderate' },
  { re: /\bdeveloping (countr|nation|world|econom)/i, label: 'developing' },
  { re: /\bthird world\b/i, label: 'third world (narrator)' },
];
const QUALIFIERS =
  /(liberal|bourgeois|council|direct|representative|parliamentary|social|people's|popular|workers'|economic|industrial|participatory|deliberative|christian|guided|electoral|formal|substantive|soviet|proletarian|socialist|radical|grassroots|illiberal|multiparty|one-party|party|internal|inner-party|majoritarian|consociational|western|athenian|constitutional|procedural|liberal-democratic|islamic|delegative|workplace|economic|national|new|sham|real|actual|their|its|his|her|your|our|negative|positive|religious|academic|market|press|personal|individual|civil|political|natural|formal|real|communal|reproductive|sexual|bodily|contractual|academic|artistic|ordered|christian|republican|national|collective|true|full|so-called|so called|what they call|called|the word|lack of|of|of the)\s+$/i;

function stripQuotes(s: string): string {
  return s.replace(/"[^"]*"|“[^”]*”/g, ' ').replace(/'[^']{12,}'/g, ' ');
}

export function loadedTerms(text: string): string[] {
  const t = stripQuotes(text);
  const hits: string[] = [];
  for (const { re, label } of LOADED) if (re.test(t)) hits.push(label);
  for (const word of ['democracy', 'freedom']) {
    const re = new RegExp(`\\b${word}\\b`, 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(t))) {
      const before = t.slice(Math.max(0, m.index - 40), m.index);
      const after = t.slice(m.index + word.length, m.index + word.length + 6);
      if (QUALIFIERS.test(before) || /^\s+(of|from|to)\b/i.test(after) || /^-/.test(after)) continue;
      hits.push(`unqualified "${word}"`);
      break;
    }
  }
  return hits;
}

function wordCount(s: string) {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function condRefs(c: Cond | undefined, out: { positions: string[]; nodes: string[]; practice: string[] }) {
  if (!c) return;
  if ('holds' in c) out.positions.push(c.holds);
  else if ('holdsAll' in c) out.positions.push(...c.holdsAll);
  else if ('holdsAny' in c) out.positions.push(...c.holdsAny);
  else if ('weight' in c) out.positions.push(c.weight.position);
  else if ('practice' in c) out.practice.push(c.practice);
  else if ('practiceAny' in c) out.practice.push(...c.practiceAny);
  else if ('answered' in c) out.nodes.push(c.answered.node);
  else if ('all' in c) c.all.forEach((x) => condRefs(x, out));
  else if ('any' in c) c.any.forEach((x) => condRefs(x, out));
  else if ('not' in c) condRefs(c.not, out);
}

export function lintBundle(b: Bundle, errors: string[], warnings: string[], known: Set<string> = new Set()) {
  const strict = process.argv.includes('--strict') || process.env.STANDPOINT_STRICT === '1';
  const coverage = (msg: string) => (strict ? errors : warnings).push(msg);

  const P = b.positions;
  const T = b.traditions;
  const N = b.nodes;
  const pos = (id: string, where: string) => {
    if (!P[id]) errors.push(`${where}: unknown position "${id}"`);
  };
  const trad = (id: string, where: string) => {
    if (!T[id] && !known.has(id)) errors.push(`${where}: unknown tradition "${id}"`);
  };

  // ---- ontology references
  for (const p of Object.values(P)) {
    const w = `position ${p.id}`;
    for (const r of [...p.presupposes, ...p.excludes, ...p.tension]) pos(r, w);
    for (const k of ['defining', 'typical', 'contested', 'rejects'] as const) for (const t of p.traditions[k] ?? []) trad(t, w);
    for (const a of p.against) trad(a.from, `${w} against`);
    if (p.presupposes.includes(p.id) || p.excludes.includes(p.id)) errors.push(`${w}: relates to itself`);
    for (const f of ['claim', 'you', 'mechanism'] as const) {
      const text = f === 'mechanism' ? p.analysis.mechanism : p[f];
      const hits = loadedTerms(text);
      if (hits.length) errors.push(`${w}.${f}: narrator-voice loaded term(s): ${hits.join(', ')}`);
    }
    for (const s of p.sources) if (!s.author || !s.title || s.year === undefined) errors.push(`${w}: incomplete source`);
    if (!p.analysis.gains.length && !p.analysis.pays.length && p.analysis.drain === 'none' && p.analysis.law_of_value === 'none')
      warnings.push(`${w}: analysis names no classes, drain or law-of-value effect`);
  }
  for (const pr of Object.values(b.problematics)) {
    if (pr.positions.length < 3) warnings.push(`problematic ${pr.id}: only ${pr.positions.length} positions`);
  }

  // ---- traditions
  const defining = new Map<string, number>();
  for (const p of Object.values(P)) for (const t of p.traditions.defining ?? []) defining.set(t, (defining.get(t) ?? 0) + 1);
  for (const t of Object.values(T)) {
    const w = `tradition ${t.id}`;
    if (t.parent) trad(t.parent, w);
    for (const l of [...t.descendsFrom, ...t.breaksWith]) trad(l.id, w);
    for (const th of t.thinkers) if (!b.thinkers[th]) errors.push(`${w}: unknown thinker "${th}"`);
    if (t.leaf && !defining.get(t.id)) coverage(`${w}: leaf tradition has no defining positions`);
    for (const r of t.record) {
      const hits = loadedTerms(r.text);
      if (hits.length) errors.push(`${w}.record: narrator-voice loaded term(s): ${hits.join(', ')}`);
    }
    for (const f of ['conditions', 'class_base', 'function'] as const) {
      const hits = loadedTerms(t.analysis[f]);
      if (hits.length) errors.push(`${w}.analysis.${f}: narrator-voice loaded term(s): ${hits.join(', ')}`);
    }
  }
  for (const th of Object.values(b.thinkers)) {
    for (const t of th.traditions) trad(t, `thinker ${th.id}`);
    for (const a of th.argues) {
      pos(a.position, `thinker ${th.id} argues`);
      if (!a.in.author || !a.in.title || a.in.year === undefined) errors.push(`thinker ${th.id}: argues edge without full source`);
    }
  }
  for (const e of Object.values(b.events)) {
    if (e.problematic && !b.problematics[e.problematic]) errors.push(`event ${e.id}: unknown problematic ${e.problematic}`);
    for (const s of e.stances) {
      trad(s.tradition, `event ${e.id}`);
      if (s.position) pos(s.position, `event ${e.id}`);
    }
    const hits = loadedTerms(e.summary);
    if (hits.length) errors.push(`event ${e.id}.summary: narrator-voice loaded term(s): ${hits.join(', ')}`);
  }
  for (const d of Object.values(b.debates)) {
    if (d.problematic && !b.problematics[d.problematic]) errors.push(`debate ${d.id}: unknown problematic ${d.problematic}`);
    for (const s of d.sides) {
      for (const t of s.thinkers) if (!b.thinkers[t]) errors.push(`debate ${d.id}: unknown thinker ${t}`);
      for (const p of s.positions) pos(p, `debate ${d.id}`);
    }
  }

  // ---- nodes
  const nextTargets = (n: Node): string[] => {
    const out: string[] = [];
    for (const o of n.options) {
      if (!o.next) continue;
      if (typeof o.next === 'string') out.push(o.next);
      else for (const x of o.next) out.push(x.to);
    }
    return out;
  };
  for (const n of Object.values(N)) {
    const w = `node ${n.id}`;
    for (const o of n.options) {
      for (const e of o.evidence) pos(e.position, `${w}.${o.id}`);
      for (const po of o.probe?.options ?? []) for (const e of po.evidence) pos(e.position, `${w}.${o.id}.probe`);
      if (o.practice) for (const p of o.practice) if (!b.practice[p]) errors.push(`${w}.${o.id}: unknown practice "${p}"`);
      if (o.next) {
        const targets = typeof o.next === 'string' ? [o.next] : o.next.map((x) => x.to);
        for (const t of targets) if (!N[t]) errors.push(`${w}.${o.id}: next -> unknown node "${t}"`);
        if (typeof o.next !== 'string') for (const x of o.next) {
          const refs = { positions: [] as string[], nodes: [] as string[], practice: [] as string[] };
          condRefs(x.if, refs);
          refs.positions.forEach((p) => pos(p, `${w}.${o.id}.next`));
        }
      }
      if (o.consequence) {
        const hits = loadedTerms(o.consequence);
        if (hits.length) errors.push(`${w}.${o.id}.consequence: narrator-voice loaded term(s): ${hits.join(', ')}`);
      }
    }
    for (const a of [...n.premises, ...n.conditions]) for (const e of a.evidence) pos(e.position, `${w}.${a.id}`);
    for (const it of n.allocate?.items ?? []) for (const e of it.evidence) pos(e.position, `${w}.${it.id}`);
    const refs = { positions: [] as string[], nodes: [] as string[], practice: [] as string[] };
    condRefs(n.gate, refs);
    refs.positions.forEach((p) => pos(p, `${w}.gate`));
    refs.nodes.forEach((x) => N[x] || errors.push(`${w}.gate: unknown node ${x}`));
    refs.practice.forEach((x) => b.practice[x] || errors.push(`${w}.gate: unknown practice ${x}`));
    if (n.tests) pos(n.tests, `${w}.tests`);
    if (!n.allocate && n.options.length < 2) errors.push(`${w}: needs at least two options`);
    const ids = new Set<string>();
    for (const o of n.options) {
      if (ids.has(o.id)) errors.push(`${w}: duplicate option id ${o.id}`);
      ids.add(o.id);
    }
    const hits = loadedTerms(n.text);
    if (hits.length) errors.push(`${w}.text: narrator-voice loaded term(s): ${hits.join(', ')}`);
    const words = wordCount(n.text) + (n.voices ?? []).reduce((a, v) => a + wordCount(v.says), 0) * 0;
    if (words > 70) warnings.push(`${w}: ${words} words before the choice (limit 70)`);
    if (n.type === 'escalation' && !n.options.some((o) => o.side)) errors.push(`${w}: escalation options need sides`);
    if (n.type === 'escalation' && !n.recap) errors.push(`${w}: escalation needs a recap for standalone entry`);
    if (n.type === 'pressure' && !n.options.some((o) => o.pressure)) errors.push(`${w}: pressure options need principle/interest tags`);
    if (n.type === 'pressure' && !n.tests) errors.push(`${w}: pressure node needs "tests"`);
  }

  // ---- arcs: reachability, dead ends, escalation
  for (const a of Object.values(b.arcs)) {
    const w = `arc ${a.id}`;
    if (!N[a.start]) {
      errors.push(`${w}: start node missing`);
      continue;
    }
    if (!N[a.escalation] || N[a.escalation]!.type !== 'escalation') errors.push(`${w}: escalation must be a node of type escalation`);
    const own = new Set(a.nodes);
    const seen = new Set<string>();
    const stack = [a.start];
    while (stack.length) {
      const id = stack.pop()!;
      if (seen.has(id) || !N[id]) continue;
      seen.add(id);
      stack.push(...nextTargets(N[id]!));
    }
    for (const id of a.nodes) if (!seen.has(id)) errors.push(`${w}: node ${id} unreachable from start`);
    if (!seen.has(a.escalation)) errors.push(`${w}: escalation unreachable`);
    for (const id of a.nodes) {
      const n = N[id]!;
      for (const o of n.options) {
        if (!o.next && !o.end && n.id !== a.escalation && !isTerminal(n, a.nodes, N)) {
          errors.push(`${w}: dead end at ${id}.${o.id} (no next, not marked end)`);
        }
        if (o.next) {
          const targets = typeof o.next === 'string' ? [o.next] : o.next.map((x) => x.to);
          for (const t of targets) if (!own.has(t)) errors.push(`${w}: ${id}.${o.id} jumps outside the arc to ${t}`);
          if (typeof o.next !== 'string' && o.next[o.next.length - 1]!.if) errors.push(`${w}: ${id}.${o.id} conditional next needs an unconditional fallback last`);
        }
      }
    }
    for (const p of a.pressure) if (!own.has(p)) errors.push(`${w}: pressure node ${p} not in arc`);
  }
  for (const d of Object.values(b.descents)) {
    const w = `descent ${d.id}`;
    if (!N[d.entry]) errors.push(`${w}: entry missing`);
    const refs = { positions: [] as string[], nodes: [] as string[], practice: [] as string[] };
    condRefs(d.gate, refs);
    refs.positions.forEach((p) => pos(p, `${w}.gate`));
    const gateReach = refs.positions.filter((p) => (b.reach[p]?.filter((n) => N[n]?.descent !== d.id).length ?? 0) > 0);
    if (refs.positions.length && !gateReach.length) coverage(`${w}: gate positions are not reachable outside the descent, so it can never open`);
    const seen = new Set<string>();
    const stack = [d.entry];
    while (stack.length) {
      const id = stack.pop()!;
      if (seen.has(id) || !N[id]) continue;
      seen.add(id);
      stack.push(...nextTargets(N[id]!));
    }
    for (const id of d.nodes) if (!seen.has(id)) errors.push(`${w}: node ${id} unreachable from entry`);
  }

  // ---- tensions
  for (const t of Object.values(b.tensions)) {
    const w = `tension ${t.id}`;
    const refs = { positions: [] as string[], nodes: [] as string[], practice: [] as string[] };
    condRefs(t.when, refs);
    refs.positions.forEach((p) => pos(p, `${w}.when`));
    refs.practice.forEach((x) => b.practice[x] || errors.push(`${w}.when: unknown practice ${x}`));
    for (const r of t.resolutions) {
      if (r.revise) pos(r.revise, `${w}.${r.id}`);
      for (const e of r.evidence) pos(e.position, `${w}.${r.id}`);
      for (const po of r.followup?.options ?? []) for (const e of po.evidence) pos(e.position, `${w}.${r.id}.followup`);
    }
    for (const x of t.between) if (!P[x] && !b.practice[x]) errors.push(`${w}: between references unknown "${x}"`);
    if (!t.resolutions.some((r) => r.kind === 'reject')) warnings.push(`${w}: no "reject the framing" resolution`);
  }

  // ---- coverage lints
  for (const p of Object.values(P)) {
    const n = b.reach[p.id]?.length ?? 0;
    if (n < 3) coverage(`position ${p.id}: reachable from ${n} node(s), needs 3`);
  }
  const pressureByClass = new Map<string, number>(CLASS_IDS.map((c) => [c, 0]));
  for (const id of b.pressure) {
    const n = N[id]!;
    const refs = JSON.stringify(n.gate ?? {});
    for (const c of CLASS_IDS) if (refs.includes(`"${c}"`)) pressureByClass.set(c, pressureByClass.get(c)! + 1);
  }
  for (const [c, n] of pressureByClass) if (n < 3) coverage(`situation category ${c}: ${n} pressure scenes, needs 3`);
  const fl = {
    problematics: Object.keys(b.problematics).length,
    positions: Object.keys(P).length,
    traditions: Object.values(T).filter((t) => t.leaf).length,
    thinkers: Object.keys(b.thinkers).length,
    events: Object.keys(b.events).length,
    debates: Object.keys(b.debates).length,
    arcs: Object.keys(b.arcs).length,
    nodes: Object.keys(N).length,
    tensions: Object.keys(b.tensions).length,
  };
  for (const k of Object.keys(FLOORS) as (keyof typeof FLOORS)[]) if (fl[k] < FLOORS[k]) coverage(`floor: ${k} ${fl[k]} < ${FLOORS[k]}`);
  if (b.trunk.length < 6) coverage(`trunk has ${b.trunk.length} nodes; needs about 8`);
}

function isTerminal(n: Node, arcNodes: string[], _N: Record<string, Node>) {
  // the last listed node of an arc may end without explicit "end"
  return arcNodes[arcNodes.length - 1] === n.id;
}
