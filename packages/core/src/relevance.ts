/**
 * Relevance: how strongly a piece of the journey bears on this respondent, as opposed to how much fog it
 * would clear. Fog alone sends everyone down the same road (the arc touching the most open ground wins for
 * every respondent), so selection multiplies fog gain by relevance drawn from three sources:
 *
 *   1. the Situation and the practice module: an arc set where the respondent lives, works or prays;
 *   2. firm holdings: ground the respondent's nearest traditions treat as defining or typical, where the
 *      answers so far point (the arc analogue of descent relevance);
 *   3. for probes only: ground adjacent to the keystones, ground that would separate the respondent's two
 *      or three nearest traditions, and ground that would decide a tension rule half of which already holds.
 *
 * Everything here is a pure function of the state, so the same answers still give the same journey.
 */
import type { Bundle, ClassId, Cond, Node } from '@standpoint/content/schema';
import type { State } from './types.js';
import { holdings } from './holdings.js';
import { evaluate } from './cond.js';
import { location } from './situation.js';
import { keystones } from './structure.js';
import { affinities } from './analysis/map.js';
import { nodeEvidence } from './state.js';

/* ------------------------------------------------------------------ */
/* Situation                                                            */
/* ------------------------------------------------------------------ */

/**
 * Arcs whose setting matches a derived class location. A class match counts 0.75, a field or practice
 * match 0.5, and relevance is capped at 1, so an arc needs two matches (say class and sector) to reach it. These hints live in the engine because arcs carry no
 * Situation metadata yet; an arc missing from every list simply gets no Situation boost.
 */
const CLASS_ARCS: Record<ClassId, string[]> = {
  'finance-capital': ['arc.imf', 'arc.microfinance', 'arc.founder'],
  'industrial-capital': ['arc.founder', 'arc.automation', 'arc.plant'],
  'landed-capital': ['arc.rentstrike', 'arc.temple', 'arc.landreform'],
  'comprador-capital': ['arc.imf', 'arc.mine', 'arc.annotators'],
  'petty-bourgeoisie': ['arc.uprising', 'arc.founder', 'arc.platform'],
  'professional-managerial': ['arc.campus', 'arc.surge', 'arc.automation'],
  'core-workers': ['arc.dock', 'arc.plant'],
  'peripheral-workers': ['arc.annotators', 'arc.clinic', 'arc.mine', 'arc.platform'],
  peasantry: ['arc.landreform', 'arc.flood', 'arc.temple', 'arc.blockade'],
  'reserve-army': ['arc.platform', 'arc.dock', 'arc.surge', 'arc.uprising'],
};

/** field -> value -> arcs (half weight each). */
const FIELD_ARCS: Record<string, Record<string, string[]>> = {
  sector: {
    agriculture: ['arc.landreform', 'arc.parish', 'arc.flood'],
    extraction: ['arc.mine', 'arc.pipeline'],
    manufacturing: ['arc.plant', 'arc.automation', 'arc.mobilization'],
    logistics: ['arc.dock', 'arc.platform'],
    construction: ['arc.flood', 'arc.uprising'],
    'retail-hospitality': ['arc.dock', 'arc.uprising'],
    'care-health': ['arc.clinic'],
    education: ['arc.campus', 'arc.family'],
    'public-professional': ['arc.surge', 'arc.imf', 'arc.flood'],
    professional: ['arc.campus', 'arc.automation'],
    tech: ['arc.annotators', 'arc.automation'],
    finance: ['arc.imf', 'arc.microfinance'],
    trade: ['arc.uprising', 'arc.border'],
    'military-police': ['arc.coup', 'arc.border', 'arc.mobilization'],
    domestic: ['arc.family'],
    informal: ['arc.platform', 'arc.uprising'],
  },
  housing: {
    rent: ['arc.rentstrike'],
    'social-housing': ['arc.rentstrike'],
    landlord: ['arc.rentstrike'],
    insecure: ['arc.uprising', 'arc.rentstrike'],
  },
  debt: {
    crushing: ['arc.microfinance', 'arc.imf'],
    consumer: ['arc.microfinance', 'arc.platform'],
    business: ['arc.founder', 'arc.microfinance'],
    mortgage: ['arc.rentstrike'],
  },
  assets: {
    'property-one': ['arc.rentstrike'],
    'property-many': ['arc.rentstrike'],
    land: ['arc.landreform', 'arc.temple'],
    'business-small': ['arc.founder'],
    'business-large': ['arc.founder'],
  },
  land: {
    'landless-rural': ['arc.landreform'],
    'tenant-farmer': ['arc.landreform'],
    'own-farm-small': ['arc.flood', 'arc.landreform'],
    'own-farm-large': ['arc.temple', 'arc.landreform'],
  },
  union: { member: ['arc.plant', 'arc.dock'], former: ['arc.plant', 'arc.dock'] },
  world: {
    periphery: ['arc.imf', 'arc.flood', 'arc.coup', 'arc.microfinance', 'arc.blockade'],
    'semi-periphery': ['arc.imf', 'arc.coup'],
  },
  'nation-place': { 'oppressed-nation': ['arc.pipeline', 'arc.coup', 'arc.border'] },
  settler: { indigenous: ['arc.pipeline', 'arc.coup'], 'settler-descended': ['arc.pipeline'] },
  migrant: {
    naturalized: ['arc.border'],
    resident: ['arc.border'],
    undocumented: ['arc.border'],
    refugee: ['arc.border'],
  },
  caste: {
    dominant: ['arc.temple', 'arc.landreform'],
    intermediate: ['arc.temple', 'arc.landreform'],
    dalit: ['arc.temple', 'arc.landreform'],
    adivasi: ['arc.temple', 'arc.landreform'],
  },
  religion: {
    catholic: ['arc.parish'],
    hindu: ['arc.temple'],
    sunni: ['arc.family', 'arc.microfinance'],
    shia: ['arc.family'],
  },
  gender: { woman: ['arc.family', 'arc.clinic'] },
  employment: {
    temporary: ['arc.platform', 'arc.dock'],
    precarious: ['arc.platform', 'arc.dock'],
    unemployed: ['arc.surge', 'arc.uprising'],
    student: ['arc.campus'],
  },
  income: {
    transfers: ['arc.surge'],
    'own-account': ['arc.platform', 'arc.uprising'],
    rent: ['arc.rentstrike'],
  },
  place: {
    rural: ['arc.landreform', 'arc.flood'],
    town: ['arc.plant', 'arc.surge'],
    metropolis: ['arc.uprising', 'arc.platform'],
  },
};

const PRACTICE_ARCS: Record<string, string[]> = {
  'practice.union-member': ['arc.plant', 'arc.dock'],
  'practice.union-activist': ['arc.plant', 'arc.dock'],
  'practice.strike': ['arc.plant', 'arc.dock'],
  'practice.religious-community': ['arc.parish', 'arc.temple', 'arc.family'],
  'practice.prayer': ['arc.parish', 'arc.temple', 'arc.family'],
  'practice.tenant-assoc': ['arc.rentstrike'],
  'practice.employer-assoc': ['arc.founder'],
  'practice.manage': ['arc.founder', 'arc.automation'],
  'practice.peasant-movement': ['arc.landreform'],
  'practice.militia': ['arc.coup', 'arc.mobilization'],
  'practice.arms-work': ['arc.mobilization'],
  'practice.ngo': ['arc.microfinance', 'arc.flood'],
  'practice.charity-abroad': ['arc.microfinance', 'arc.flood'],
  'practice.party-member': ['arc.blockade'],
  'practice.revolutionary-org': ['arc.blockade', 'arc.uprising'],
  'practice.mutual-aid': ['arc.uprising', 'arc.surge'],
  'practice.community-org': ['arc.uprising', 'arc.surge'],
  'practice.professional-body': ['arc.clinic', 'arc.campus'],
};

const CLASS_WEIGHT = 0.75;
const SECONDARY_CLASS_WEIGHT = 0.5;
const FIELD_WEIGHT = 0.5;

const arr = (v: string | string[] | undefined): string[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

/** 0..1: how closely an arc's setting matches the respondent's Situation and practice. */
export function situationRelevance(s: State, arcId: string): number {
  let m = 0;
  const l = location(s);
  if (l.primary && CLASS_ARCS[l.primary]?.includes(arcId)) m += CLASS_WEIGHT;
  for (const c of l.secondary) if (CLASS_ARCS[c]?.includes(arcId)) m += SECONDARY_CLASS_WEIGHT;
  for (const [field, map] of Object.entries(FIELD_ARCS)) {
    for (const v of arr(s.situation[field])) if (map[v]?.includes(arcId)) m += FIELD_WEIGHT;
  }
  for (const p of s.practice) if (PRACTICE_ARCS[p]?.includes(arcId)) m += FIELD_WEIGHT;
  return Math.min(1, m);
}

/* ------------------------------------------------------------------ */
/* Holdings                                                             */
/* ------------------------------------------------------------------ */

interface Lean {
  /** the nearest traditions by affinity, best first (empty until something is held) */
  top: string[];
  /** the traditions a split probe tries to tell apart */
  rivals: string[];
  /**
   * keystone neighborhood: positions related to a keystone by presupposition, exclusion, tension or a
   * shared question, each weighted by the strength of the keystone (the strongest scores 1)
   */
  near: Map<string, number>;
  heldCount: number;
}

const leanCache = new WeakMap<State, { rev: number; lean: Lean }>();

/**
 * Nearest traditions that holdings relevance looks at, and the wider set of rivals a split probe tries to
 * tell apart. Rivals reach further down the ranking because the neighbor that matters is often not in the
 * top three (an ordoliberal's nearest are Christian democracy, social liberalism and the third way).
 */
const TOP_TRADITIONS = 3;
const RIVALS = 5;

export function lean(b: Bundle, s: State): Lean {
  const c = leanCache.get(s);
  if (c && c.rev === s.rev) return c.lean;
  const h = holdings(b, s);
  const ranked = h.held.length ? affinities(b, s).filter((a) => a.score > 0).map((a) => a.tradition) : [];
  const top = ranked.slice(0, TOP_TRADITIONS);
  const rivals = ranked.slice(0, RIVALS);
  const near = new Map<string, number>();
  const ks = keystones(b, s, 5);
  const strength = new Map(ks.map((k) => [k.position, ks[0]!.score > 0 ? k.score / ks[0]!.score : 1]));
  const add = (x: string, w: number) => near.set(x, Math.max(near.get(x) ?? 0, w));
  for (const k of ks) {
    const p = b.positions[k.position];
    if (!p) continue;
    const w = strength.get(k.position)!;
    for (const x of [...p.presupposes, ...p.excludes, ...p.tension]) add(x, w);
    // the rest of a keystone's question: a sibling answer would revise it
    for (const x of b.problematics[p.problematic]?.positions ?? []) if (x !== p.id) add(x, w);
  }
  // positions that build on a keystone
  if (ks.length)
    for (const p of Object.values(b.positions)) for (const x of p.presupposes) if (strength.has(x)) add(p.id, strength.get(x)!);
  const out = { top, rivals, near, heldCount: h.held.length };
  leanCache.set(s, { rev: s.rev, lean: out });
  return out;
}

function centrality(b: Bundle, pos: string, t: string): number {
  const p = b.positions[pos];
  if (!p) return 0;
  if (p.traditions.defining?.includes(t)) return 1;
  if (p.traditions.typical?.includes(t)) return 0.6;
  return 0;
}

/** Positive-evidence positions a node can record, deduplicated. */
export function positionsOf(n: Node): Set<string> {
  const out = new Set<string>();
  for (const e of nodeEvidence(n)) if (e.w > 0) out.add(e.position);
  return out;
}

/**
 * 0..1: the share of a set of positions' foggy problematics on which the respondent's nearest traditions
 * take a defining or typical stand. High when the arc or probe would go deeper on the respondent's own
 * ground rather than on ground nobody near them cares about.
 */
export function holdingsRelevance(b: Bundle, s: State, positions: Iterable<string>): number {
  const L = lean(b, s);
  if (!L.top.length) return 0;
  const h = holdings(b, s);
  const probs = new Map<string, number>();
  for (const pos of positions) {
    const p = b.positions[pos];
    if (!p) continue;
    let c = 0;
    for (const t of L.top) c = Math.max(c, centrality(b, pos, t));
    probs.set(p.problematic, Math.max(probs.get(p.problematic) ?? 0, c));
  }
  let num = 0;
  let den = 0;
  for (const [pid, c] of probs) {
    const fog = h.byProblematic[pid]?.fog ?? 1;
    num += c * fog;
    den += fog;
  }
  return den > 0 ? num / den : 0;
}

const pathPositionCache = new WeakMap<Bundle, Map<string, Set<string>>>();
function pathPositions(b: Bundle, key: string, nodes: string[]): Set<string> {
  let m = pathPositionCache.get(b);
  if (!m) pathPositionCache.set(b, (m = new Map()));
  let out = m.get(key);
  if (!out) {
    out = new Set();
    for (const id of nodes) {
      const n = b.nodes[id];
      if (n) for (const p of positionsOf(n)) out.add(p);
    }
    m.set(key, out);
  }
  return out;
}

/** Every position an arc's nodes can record. */
export function arcPositions(b: Bundle, arcId: string): Set<string> {
  return pathPositions(b, arcId, b.arcs[arcId]?.nodes ?? []);
}

/** Every position a descent's nodes can record. */
export function descentPositions(b: Bundle, descentId: string): Set<string> {
  return pathPositions(b, descentId, b.descents[descentId]?.nodes ?? []);
}

/* ------------------------------------------------------------------ */
/* Probes                                                               */
/* ------------------------------------------------------------------ */

/** 0..1: does the probe touch the keystones' neighborhood (presupposed, excluded, in tension, or a sibling)? */
export function keystoneAdjacency(b: Bundle, s: State, n: Node): number {
  const L = lean(b, s);
  if (!L.near.size) return 0;
  const h = holdings(b, s);
  let best = 0;
  for (const pos of positionsOf(n)) {
    const w = L.near.get(pos);
    if (!w) continue;
    best = Math.max(best, w * (h.byProblematic[b.positions[pos]?.problematic ?? '']?.fog ?? 1));
  }
  return best;
}

/**
 * 0..1: how well the probe separates the respondent's nearest traditions. A pair of top traditions is
 * separated when one option records a position that is more central to the first and another option one
 * that is more central to the second, so whichever the respondent picks moves the two apart. Scaled by the
 * fog left on the question.
 */
export function discrimination(b: Bundle, s: State, n: Node): number {
  const L = lean(b, s);
  if (L.rivals.length < 2) return 0;
  const h = holdings(b, s);
  const opts = [...n.options.map((o) => o.evidence), ...(n.allocate?.items.map((i) => i.evidence) ?? [])];
  let best = 0;
  for (let i = 0; i < L.rivals.length; i++) {
    for (let k = i + 1; k < L.rivals.length; k++) {
      const [a, z] = [L.rivals[i]!, L.rivals[k]!];
      let forA = 0;
      let forZ = 0;
      for (const ev of opts) {
        for (const e of ev) {
          if (e.w <= 0) continue;
          const d = centrality(b, e.position, a) - centrality(b, e.position, z);
          const fog = h.byProblematic[b.positions[e.position]?.problematic ?? '']?.fog ?? 1;
          if (d > 0) forA = Math.max(forA, d * fog);
          if (d < 0) forZ = Math.max(forZ, -d * fog);
        }
      }
      best = Math.max(best, Math.min(forA, forZ));
    }
  }
  return best;
}

/** Strength of the clauses of an `all` condition that already hold: the firmest held position in each. */
function clauseStrength(b: Bundle, s: State, c: Cond): number {
  const w = (p: string) => holdings(b, s).byPosition[p]?.weight ?? 0;
  if ('holds' in c) return w(c.holds);
  if ('holdsAny' in c) return Math.max(0, ...c.holdsAny.map(w));
  if ('holdsAll' in c) return Math.min(...c.holdsAll.map(w));
  return 0.5; // situation, practice, class and the like: met, of no graded strength
}

/** Positions named by the failing branches of an `all` condition whose other branches already hold. */
function openClauses(b: Bundle, s: State, c: Cond, out: Map<string, number>) {
  if (!('all' in c)) return;
  const results = c.all.map((x) => evaluate(b, s, x));
  const passed = results.filter(Boolean).length;
  if (!passed || passed === results.length) return;
  let strength = 1;
  c.all.forEach((x, i) => {
    if (results[i]) strength = Math.min(strength, clauseStrength(b, s, x));
  });
  // a rule two clauses away from firing is a long shot
  strength /= results.length - passed;
  const add = (p: string) => out.set(p, Math.max(out.get(p) ?? 0, strength));
  c.all.forEach((x, i) => {
    if (results[i]) return;
    if ('holds' in x) add(x.holds);
    else if ('holdsAny' in x) x.holdsAny.forEach(add);
    else if ('holdsAll' in x) x.holdsAll.forEach(add);
    else if ('weight' in x && x.weight.gt !== undefined) add(x.weight.position);
  });
}

const nearTensionCache = new WeakMap<State, { rev: number; map: Map<string, number> }>();
/** Positions that would complete a tension rule part of which already holds, with the strength of that part. */
export function nearTensionPositions(b: Bundle, s: State): Map<string, number> {
  const c = nearTensionCache.get(s);
  if (c && c.rev === s.rev) return c.map;
  const out = new Map<string, number>();
  for (const t of Object.values(b.tensions)) {
    if (s.tensions[t.id] || evaluate(b, s, t.when)) continue;
    openClauses(b, s, t.when, out);
  }
  nearTensionCache.set(s, { rev: s.rev, map: out });
  return out;
}

/** 0..1: would answering the probe decide a tension rule whose other half already holds firmly? */
export function tensionCloseness(b: Bundle, s: State, n: Node): number {
  const near = nearTensionPositions(b, s);
  if (!near.size) return 0;
  const h = holdings(b, s);
  let best = 0;
  for (const pos of positionsOf(n)) {
    const st = near.get(pos);
    if (!st) continue;
    best = Math.max(best, st * (h.byProblematic[b.positions[pos]?.problematic ?? '']?.fog ?? 1));
  }
  return best;
}
