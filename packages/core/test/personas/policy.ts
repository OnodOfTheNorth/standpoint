/**
 * Answer policies for the persona suite.
 *
 * A persona is a set of target positions (weights in -3..3), a Situation, a practice profile, and a few
 * behavioral traits. The policy picks, for each prompt, the option whose evidence best matches the targets,
 * and falls back to the affordances (reject the premise, it depends, decline) when nothing fits.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Bundle, Evidence } from '@standpoint/content/schema';
import { Engine, newSession, computeResult, type Prompt, type Result, type Mode } from '../../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(here, '..', '..', '..', 'content', 'dist', 'bundle.json');

let cached: Bundle | null = null;
export function realBundle(): Bundle {
  if (!cached) {
    if (!existsSync(BUNDLE)) throw new Error('Compile content first: packages/content/dist/bundle.json is missing');
    cached = JSON.parse(readFileSync(BUNDLE, 'utf8')) as Bundle;
  }
  return cached;
}

export interface Persona {
  id: string;
  name: string;
  /** position id -> how strongly the persona holds (+) or rejects (-) it */
  targets: Record<string, number>;
  situation?: Record<string, string | string[]>;
  /** practice option ids the persona ticks in the practice module (e.g. "union", "vote") */
  practice?: string[];
  /** in escalations: which side the persona breaks to when nothing in its targets decides */
  breaks?: 'order' | 'dispossessed' | 'neither';
  /** in pressure scenes: what wins when nothing in its targets decides */
  underPressure?: 'principle' | 'interest' | 'mixed';
  /** the kind of cause it reaches for when nothing in its targets decides */
  reachesFor?: string;
  /** how hard the persona pulls toward its `reachesFor` cause in explanation nodes and reason probes (default 0.5) */
  causeBias?: number;
  /** tension rules: hold both, yield, or reject the framing */
  onTension?: 'yield' | 'hold' | 'reject';
  /** origin answer for keystones */
  origin?: string;
  /** the positions it must hold at the end of a Survey (keystone recovery) */
  expect?: string[];
  /** a fraction of prompts answered with "decline" (0..1), for incoherent and disengaged personas */
  declineRate?: number;
  /**
   * Home tradition(s). Where no explicit target bears on an option, the persona leans on how the bundle
   * tags positions for these traditions (defining +0.6, typical +0.3, rejects -0.6), so it answers the way
   * its tradition would instead of picking arbitrarily. Explicit targets always override the prior.
   */
  traditions?: string[];
}

const PRIOR = { defining: 0.6, typical: 0.3, rejects: -0.6 } as const;
const effCache = new WeakMap<Persona, Record<string, number>>();

/** Explicit targets plus the tradition prior. */
export function effectiveTargets(b: Bundle, persona: Persona): Record<string, number> {
  const c = effCache.get(persona);
  if (c) return c;
  const t: Record<string, number> = {};
  if (persona.traditions?.length) {
    for (const p of Object.values(b.positions)) {
      let v = 0;
      for (const tr of persona.traditions) {
        for (const k of ['defining', 'typical', 'rejects'] as const) if (p.traditions[k]?.includes(tr)) v += PRIOR[k];
      }
      if (v) t[p.id] = v / persona.traditions.length;
    }
  }
  Object.assign(t, persona.targets);
  effCache.set(persona, t);
  return t;
}

type Scored = { id: string; score: number; side?: string; pressure?: string; cause?: string };

function score(ev: Evidence[] | undefined, targets: Record<string, number>): number {
  let s = 0;
  for (const e of ev ?? []) s += (targets[e.position] ?? 0) * e.w;
  return s;
}

/** Per-option evidence for any prompt, looked up from the bundle. */
function scoreOptions(b: Bundle, p: Prompt, persona: Persona): { options: Scored[]; premises: Scored[]; conditions: Scored[] } {
  const t = effectiveTargets(b, persona);
  if (p.kind === 'challenge') {
    const rule = b.tensions[p.id.slice('challenge:'.length)]!;
    return {
      options: rule.resolutions.map((r) => ({
        id: r.id,
        score: score(r.evidence, t) - (r.revise ? Math.max(0, t[r.revise] ?? 0) * 2 : 0) + (r.kind === (persona.onTension ?? 'hold') ? 1.5 : 0),
      })),
      premises: [],
      conditions: [],
    };
  }
  if (p.kind === 'origin') return { options: p.options.map((o) => ({ id: o.id, score: o.id === (persona.origin ?? 'books') ? 1 : 0 })), premises: [], conditions: [] };
  if (p.kind === 'probe') {
    const base = b.nodes[p.id.replace(/#probe$/, '')];
    const probe = base?.options.flatMap((o) => (o.probe ? [o.probe] : [])).find((pr) => pr.ask === p.text);
    return {
      options: p.options.map((o, i) => ({ id: o.id, score: score(probe?.options[i]?.evidence, t), cause: probe?.options[i]?.cause })),
      premises: [],
      conditions: [],
    };
  }
  const n = b.nodes[p.id]!;
  return {
    options: n.options.map((o) => ({ id: o.id, score: score(o.evidence, t), side: o.side?.dir, pressure: o.pressure, cause: o.cause })),
    premises: n.premises.map((x) => ({ id: x.id, score: score(x.evidence, t) })),
    conditions: n.conditions.map((x) => ({ id: x.id, score: score(x.evidence, t) })),
  };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

/** FNV-1a with a final avalanche, so that ids differing only in their last characters spread evenly. */
function unit(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function decide(b: Bundle, p: Prompt, persona: Persona) {
  if (persona.declineRate && unit(persona.id + p.id) < persona.declineRate && p.kind === 'node') return { node: p.id, affordance: 'decline' as const };
  if (p.allocate) {
    const n = b.nodes[p.id]!;
    const raw = n.allocate!.items.map((it) => ({ id: it.id, s: Math.max(0, score(it.evidence, effectiveTargets(b, persona))) + 0.01 }));
    const total = raw.reduce((a, z) => a + z.s, 0);
    const alloc: Record<string, number> = {};
    let left = p.allocate.budget;
    raw.forEach((r, i) => {
      const v = i === raw.length - 1 ? left : Math.min(left, Math.round((r.s / total) * p.allocate!.budget));
      alloc[r.id] = v;
      left -= v;
    });
    return { node: p.id, alloc };
  }
  if (p.multi) {
    const picks = p.options.filter((o) => persona.practice?.includes(o.id)).map((o) => o.id);
    return { node: p.id, options: picks.length ? picks : [p.options.find((o) => o.id === 'none')?.id ?? p.options[p.options.length - 1]!.id] };
  }
  if (p.type === 'trajectory') return { node: p.id, option: p.options[0]!.id };
  const { options, premises, conditions } = scoreOptions(b, p, persona);
  for (const o of options) {
    if (o.side && persona.breaks && o.side === persona.breaks) o.score += 0.75;
    if (o.pressure && persona.underPressure && o.pressure === persona.underPressure) o.score += 0.75;
    if (o.cause && persona.reachesFor && o.cause === persona.reachesFor) o.score += persona.causeBias ?? 0.5;
  }
  options.sort((a, z) => z.score - a.score || a.id.localeCompare(z.id));
  const best = options[0];
  const bestPremise = [...premises].sort((a, z) => z.score - a.score)[0];
  const bestCondition = [...conditions].sort((a, z) => z.score - a.score)[0];
  if (bestPremise && bestPremise.score > Math.max(1, best?.score ?? 0)) return { node: p.id, affordance: 'reject' as const, premise: bestPremise.id };
  if (bestCondition && bestCondition.score > Math.max(1, best?.score ?? 0)) return { node: p.id, affordance: 'depends' as const, condition: bestCondition.id };
  if (!best || (best.score <= 0 && p.kind === 'node' && !p.options.length)) return { node: p.id, affordance: 'decline' as const };
  return { node: p.id, option: best.id };
}

export function runPersona(persona: Persona, mode: Mode = 'survey', b: Bundle = realBundle()): { engine: Engine; result: Result } {
  const e = new Engine(b, newSession(b, { seed: 1000 + Math.floor(hash(persona.id) * 1000), mode, now: '2026-01-01T00:00:00Z', respondent: { kind: 'human', persona: persona.id } }));
  if (persona.situation) for (const [k, v] of Object.entries(persona.situation)) e.setSituation(k, v);
  else e.skipSituation();
  const cap = mode === 'sketch' ? 60 : mode === 'survey' ? 200 : 400;
  for (let i = 0; i < cap; i++) {
    const p = e.next().prompt;
    if (!p) break;
    e.answer(decide(b, p, persona));
  }
  return { engine: e, result: computeResult(b, e.session, { now: '2026-01-02T00:00:00Z' }) };
}
