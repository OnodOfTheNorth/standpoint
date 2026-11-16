/**
 * Part two of the result: the map, the person in their own terms.
 */
import type { Bundle, Layer, Source } from '@standpoint/content/schema';
import type { State } from '../types.js';
import { holdings, HOLD_THRESHOLD } from '../holdings.js';
import { keystones, liveTensions, type Keystone } from '../structure.js';
import { LIVED_ORIGINS, ORIGIN_OPTIONS } from '../state.js';
import { held, lcFirst, listJoin, stripPeriod, resolutionOf } from './common.js';

/* ---------------- portrait ---------------- */

const LAYER_LEAD: Record<Layer, string> = {
  method: 'How you think.',
  analysis: 'What you see.',
  horizon: 'What you want.',
  strategy: 'How you would get there.',
  priority: 'What gives way.',
};

export function portrait(b: Bundle, s: State): string[] {
  const h = holdings(b, s);
  const paras: string[] = [];
  const layers: Layer[] = ['method', 'analysis', 'horizon', 'strategy'];
  for (const layer of layers) {
    const inLayer = h.held.filter((x) => b.problematics[x.problematic]!.layer === layer);
    // one position per problematic, best first
    const seen = new Set<string>();
    const picks = inLayer.filter((x) => (seen.has(x.problematic) ? false : (seen.add(x.problematic), true))).slice(0, 4);
    const probs = Object.values(b.problematics).filter((p) => p.layer === layer).map((p) => p.id);
    const res = resolutionOf(b, s, probs);
    if (!picks.length) {
      paras.push(`${LAYER_LEAD[layer]} The instrument has not resolved this yet${res > 0 ? ` (${Math.round(res * 100)}% resolved)` : ''}.`);
      continue;
    }
    const sentences = picks.map((x, i) => {
      const you = stripPeriod(b.positions[x.position]!.you);
      const hedge = x.weight < 0.4 ? (i === 0 ? 'Tentatively, ' : 'Less firmly, ') : '';
      return `${hedge}${hedge ? lcFirst(you) : you}.`;
    });
    // contradictions inside this layer
    const tens = liveTensions(b, s)
      .map((t) => b.tensions[t.rule]!)
      .filter((t) => t.between.some((p) => picks.some((x) => x.position === p)))
      .slice(0, 1);
    const tail = tens.length ? ` At the same time, ${lcFirst(stripPeriod(tens[0]!.explain))}.` : '';
    paras.push(`${LAYER_LEAD[layer]} ${sentences.join(' ')}${tail}`);
  }
  // practice
  const pr = [...s.practice].map((p) => b.practice[p]).filter(Boolean);
  const orgs = pr.filter((p) => p!.kind === 'organization');
  const acts = pr.filter((p) => p!.kind !== 'organization' && p!.kind !== 'none');
  const ps = s.pressures;
  let what = 'What you do. ';
  if (!s.practiceAnswered) what += 'You have not been asked yet.';
  else if (!pr.length) what += 'By your own account, nothing political at present: no organization and no regular collective action.';
  else
    what += `${orgs.length ? `You belong to ${listJoin(orgs.map((p) => lcFirst(p!.text)))}. ` : 'You belong to no political organization. '}${acts.length ? `You ${listJoin(acts.map((p) => lcFirst(p!.text)))}.` : ''}`;
  if (ps.length) {
    const held_ = ps.filter((p) => p.outcome === 'principle').length;
    what += ` When a principle cost you something, it held ${held_} of ${ps.length} times.`;
  }
  paras.push(what.trim());
  return paras;
}

/* ---------------- graph ---------------- */

export interface GraphNode {
  id: string;
  label: string;
  problematic: string;
  domain: string;
  layer: string;
  weight: number;
  keystone: number; // 0..1
  fog: boolean;
}
export interface GraphEdge {
  source: string;
  target: string;
  kind: 'presupposes' | 'tension' | 'excludes';
  live?: boolean;
}

export function graph(b: Bundle, s: State, ks: Keystone[]) {
  const h = holdings(b, s);
  const maxK = Math.max(1e-9, ...ks.map((k) => k.score));
  const kmap = new Map(ks.map((k) => [k.position, k.score / maxK]));
  const nodes: GraphNode[] = h.held.map((x) => {
    const p = b.positions[x.position]!;
    const pr = b.problematics[x.problematic]!;
    return { id: x.position, label: p.label, problematic: pr.id, domain: pr.domain, layer: pr.layer, weight: x.weight, keystone: kmap.get(x.position) ?? 0, fog: false };
  });
  // fog: unresolved problematics with importance >= 2, one node each
  for (const pr of Object.values(b.problematics)) {
    const ps = h.byProblematic[pr.id]!;
    if (ps.holdings.some((x) => x.weight >= HOLD_THRESHOLD)) continue;
    if (pr.importance < 2 && ps.mass === 0) continue;
    nodes.push({ id: `fog:${pr.id}`, label: pr.short, problematic: pr.id, domain: pr.domain, layer: pr.layer, weight: 0, keystone: 0, fog: true });
  }
  const ids = new Set(nodes.map((n) => n.id));
  const edges: GraphEdge[] = [];
  const liveSet = new Set(liveTensions(b, s).flatMap((t) => b.tensions[t.rule]!.between));
  for (const n of nodes) {
    if (n.fog) continue;
    const p = b.positions[n.id]!;
    for (const pre of p.presupposes) if (ids.has(pre)) edges.push({ source: n.id, target: pre, kind: 'presupposes' });
    for (const t of p.tension) if (ids.has(t) && n.id < t) edges.push({ source: n.id, target: t, kind: 'tension', live: liveSet.has(n.id) && liveSet.has(t) });
    for (const x of p.excludes) if (ids.has(x) && n.id < x) edges.push({ source: n.id, target: x, kind: 'excludes', live: true });
  }
  // tensions from rules
  for (const t of liveTensions(b, s)) {
    const r = b.tensions[t.rule]!;
    const ps = r.between.filter((x) => ids.has(x));
    for (let i = 0; i + 1 < ps.length; i++)
      if (!edges.some((e) => (e.source === ps[i] && e.target === ps[i + 1]) || (e.source === ps[i + 1] && e.target === ps[i])))
        edges.push({ source: ps[i]!, target: ps[i + 1]!, kind: 'tension', live: true });
  }
  return { nodes, edges };
}

/* ---------------- lineage ---------------- */

export interface Affinity {
  tradition: string;
  name: string;
  family: string;
  score: number;
  agreements: { position: string; centrality: string }[];
  breaks: { position: string; yours?: string; why: string }[];
}

const CENT = { defining: 3, typical: 2, contested: 1 } as const;

export function affinities(b: Bundle, s: State): Affinity[] {
  const h = holdings(b, s);
  const acc = new Map<string, Affinity>();
  const get = (t: string) => {
    let a = acc.get(t);
    if (!a) {
      const tr = b.traditions[t]!;
      a = { tradition: t, name: tr.name, family: tr.family, score: 0, agreements: [], breaks: [] };
      acc.set(t, a);
    }
    return a;
  };
  for (const p of Object.values(b.positions)) {
    const hp = h.byPosition[p.id];
    const w = hp?.weight ?? 0;
    const prs = h.byProblematic[p.problematic]!;
    for (const k of ['defining', 'typical', 'contested'] as const) {
      for (const t of p.traditions[k] ?? []) {
        if (!b.traditions[t]) continue;
        if (w >= HOLD_THRESHOLD) {
          const a = get(t);
          a.score += w * CENT[k];
          a.agreements.push({ position: p.id, centrality: k });
        } else if (k === 'defining' && prs.resolution >= 0.5 && prs.holdings[0] && prs.holdings[0].weight >= HOLD_THRESHOLD) {
          const a = get(t);
          a.score -= 1.5;
          a.breaks.push({ position: p.id, yours: prs.holdings[0].position, why: 'defining for them; you hold another answer' });
        }
      }
    }
    for (const t of p.traditions.rejects ?? []) {
      if (!b.traditions[t] || w < HOLD_THRESHOLD) continue;
      const a = get(t);
      a.score -= 2 * w;
      a.breaks.push({ position: p.id, why: 'you hold it; they reject it' });
    }
  }
  return [...acc.values()].sort((a, z) => z.score - a.score || a.tradition.localeCompare(z.tradition));
}

export function lineageTree(b: Bundle, aff: Affinity[]) {
  const score = new Map(aff.map((a) => [a.tradition, a.score]));
  const max = Math.max(1e-9, ...aff.map((a) => a.score));
  return Object.values(b.traditions).map((t) => ({
    id: t.id,
    name: t.name,
    family: t.family,
    parent: t.parent ?? null,
    descendsFrom: t.descendsFrom.map((d) => d.id),
    breaksWith: t.breaksWith.map((d) => d.id),
    era: t.era,
    proximity: Math.max(0, (score.get(t.id) ?? 0) / max),
  }));
}

/* ---------------- record ---------------- */

export function record(b: Bundle, s: State) {
  const h = holdings(b, s);
  return Object.values(b.events)
    .filter((e) => e.problematic && b.problematics[e.problematic])
    .map((e) => {
      const prs = h.byProblematic[e.problematic!]!;
      const top = prs.holdings[0];
      const pos = top && top.weight >= HOLD_THRESHOLD ? b.positions[top.position]! : null;
      const withWhom = pos ? [...(pos.traditions.defining ?? []), ...(pos.traditions.typical ?? [])].filter((t) => b.traditions[t]).slice(0, 4) : [];
      const stances = e.stances.filter((st) => pos && st.position === pos.id).map((st) => st.tradition);
      return {
        event: e.id,
        name: e.name,
        date: e.date,
        place: e.place,
        stood: pos ? { position: pos.id, label: pos.label, you: pos.you } : null,
        resolution: prs.resolution,
        withWhom: [...new Set([...withWhom, ...stances])].map((t) => ({ id: t, name: b.traditions[t]!.name })),
      };
    })
    .sort((a, z) => yearOf(a.date) - yearOf(z.date));
}

export function yearOf(d: string | number): number {
  if (typeof d === 'number') return d;
  const m = /-?\d{1,4}/.exec(d);
  return m ? Number(m[0]) : 0;
}

/* ---------------- neighbors ---------------- */

export function neighbors(b: Bundle, s: State, limit = 6) {
  const h = holdings(b, s);
  const out = [];
  for (const t of Object.values(b.thinkers)) {
    const agree: { position: string; in: Source; via?: Source }[] = [];
    const part: { position: string; yours: string; in: Source }[] = [];
    for (const a of t.argues) {
      const hp = h.byPosition[a.position];
      if (!hp) continue;
      if (hp.weight >= HOLD_THRESHOLD) agree.push({ position: a.position, in: a.in, ...(a.via ? { via: a.via } : {}) });
      else {
        const prs = h.byProblematic[hp.problematic]!;
        const top = prs.holdings[0];
        if (prs.resolution >= 0.4 && top && top.weight >= HOLD_THRESHOLD) part.push({ position: a.position, yours: top.position, in: a.in });
      }
    }
    if (!agree.length) continue;
    const score = agree.length - 0.7 * part.length + agree.reduce((x, a) => x + (h.byPosition[a.position]?.weight ?? 0), 0);
    out.push({ thinker: t.id, name: t.name, score, agree, part });
  }
  return out.sort((a, z) => z.score - a.score || a.thinker.localeCompare(z.thinker)).slice(0, limit);
}

/* ---------------- other readings ---------------- */

const READERS = ['marxism.leninism', 'liberalism.austrian', 'anarchism.communist', 'conservatism.burkean'];

export function otherReadings(b: Bundle, s: State, aff: Affinity[]) {
  const hs = held(b, s);
  const readers = READERS.filter((r) => b.traditions[r]);
  const nearest = aff[0]?.tradition;
  const farthest = aff.length ? aff[aff.length - 1]!.tradition : undefined;
  for (const x of [nearest, farthest]) if (x && !readers.includes(x)) readers.push(x);
  return readers.map((rid) => {
    const r = b.traditions[rid]!;
    const sameFamily = (from: string) => from === rid || b.traditions[from]?.family === r.family || b.traditions[from]?.parent === rid;
    const objections: { position: string; text: string; from: string }[] = [];
    for (const h of hs) {
      const p = b.positions[h.position]!;
      const a = p.against.find((x) => x.from === rid) ?? p.against.find((x) => sameFamily(x.from));
      if (a) objections.push({ position: p.id, text: a.text, from: a.from });
    }
    const agreements = hs.filter((h) => {
      const t = b.positions[h.position]!.traditions;
      return [...(t.defining ?? []), ...(t.typical ?? [])].includes(rid);
    });
    const text: string[] = [];
    if (agreements.length)
      text.push(`A ${r.name} reader would find common ground in ${listJoin(agreements.slice(0, 3).map((h) => `“${b.positions[h.position]!.label}”`))}.`);
    for (const o of objections.slice(0, 3)) text.push(`On “${b.positions[o.position]!.label}”: ${o.text}`);
    if (!text.length) text.push(`The ${r.name} tradition has no recorded objection to anything you hold so far.`);
    return { tradition: rid, name: r.name, voice: r.self, text, nearest: rid === nearest, farthest: rid === farthest };
  });
}

/* ---------------- theory and practice, origins, library ---------------- */

export function theoryPractice(b: Bundle, s: State) {
  const hs = held(b, s).filter((h) => b.problematics[h.problematic]!.layer === 'strategy');
  return {
    commitments: hs.map((h) => ({ position: h.position, label: b.positions[h.position]!.label, you: b.positions[h.position]!.you })),
    practice: [...s.practice].filter((p) => b.practice[p]).map((p) => ({ id: p, text: b.practice[p]!.text, kind: b.practice[p]!.kind })),
  };
}

export function origins(b: Bundle, s: State, ks: Keystone[]) {
  const label = new Map<string, string>(ORIGIN_OPTIONS.map((o) => [o.id, o.text]));
  const all = new Set([...ks.map((k) => k.position), ...Object.keys(s.origins)]);
  return [...all].map((pid) => {
    const o = s.origins[pid];
    return {
      position: pid,
      label: b.positions[pid]?.label ?? pid,
      origin: o ?? null,
      originText: o ? label.get(o) ?? o : null,
      kind: o ? (LIVED_ORIGINS.has(o) ? 'lived' : o === 'family' ? 'inherited' : 'received') : null,
    };
  });
}

export function library(b: Bundle, s: State, limit = 12) {
  const hs = held(b, s).slice(0, 12);
  const key = (x: Source) => `${x.author}|${x.title}`;
  const forSeen = new Set<string>();
  const forList: (Source & { position: string })[] = [];
  const againstList: (Source & { position: string; against: string })[] = [];
  const agSeen = new Set<string>();
  for (const h of hs) {
    const p = b.positions[h.position]!;
    for (const src of p.sources) if (!forSeen.has(key(src))) (forSeen.add(key(src)), forList.push({ ...src, position: p.id }));
    // strongest texts against: sources of excluded positions, else of siblings that the respondent does not hold
    const pr = b.problematics[p.problematic]!;
    const rivals = [...p.excludes, ...pr.positions.filter((x) => x !== p.id && (holdings(b, s).byPosition[x]?.weight ?? 0) < HOLD_THRESHOLD)];
    for (const r of rivals.slice(0, 2)) {
      const rp = b.positions[r];
      const src = rp?.sources[0];
      if (src && !agSeen.has(key(src)) && !forSeen.has(key(src))) (agSeen.add(key(src)), againstList.push({ ...src, position: r, against: p.id }));
    }
  }
  return { for: forList.slice(0, limit), against: againstList.slice(0, limit) };
}
