import type { Bundle } from '@standpoint/content/schema';
import type { Holding, State } from './types.js';

/** Evidence mass at which a problematic counts as about 63% resolved. */
export const RESOLUTION_SCALE = 3;
export const HOLD_THRESHOLD = 0.25;

export interface ProblematicState {
  id: string;
  resolution: number; // 0..1
  fog: number; // 1 - resolution
  mass: number;
  holdings: Holding[]; // positions with weight > 0, sorted desc
  rejected: string[]; // positions with net negative evidence
}

export interface Holdings {
  byPosition: Record<string, Holding>;
  byProblematic: Record<string, ProblematicState>;
  held: Holding[]; // weight >= HOLD_THRESHOLD, sorted desc
}

const cache = new WeakMap<State, { rev: number; h: Holdings }>();

export function holdings(b: Bundle, s: State): Holdings {
  const c = cache.get(s);
  if (c && c.rev === s.rev) return c.h;
  const byPosition: Record<string, Holding> = {};
  const byProblematic: Record<string, ProblematicState> = {};
  for (const pr of Object.values(b.problematics)) {
    let mass = 0;
    let posSum = 0;
    for (const pid of pr.positions) {
      const sc = s.scores[pid] ?? 0;
      mass += Math.abs(sc);
      posSum += Math.max(sc, 0);
    }
    let resolution = 1 - Math.exp(-mass / RESOLUTION_SCALE);
    const corrected = pr.positions.filter((p) => s.corrections[p]);
    if (corrected.length) resolution = Math.max(resolution, 0.8);
    const hs: Holding[] = [];
    const rejected: string[] = [];
    for (const pid of pr.positions) {
      const sc = s.scores[pid] ?? 0;
      let weight = posSum > 0 ? (resolution * Math.max(sc, 0)) / posSum : 0;
      const corr = s.corrections[pid];
      if (corr === 'hold') weight = Math.max(weight, 0.8);
      if (corr === 'reject') weight = 0;
      if (sc < 0 || corr === 'reject') rejected.push(pid);
      const h: Holding = {
        position: pid,
        problematic: pr.id,
        weight,
        score: sc,
        confidence: resolution,
        corrected: corr,
        trail: s.trail[pid] ?? [],
      };
      byPosition[pid] = h;
      if (weight > 0) hs.push(h);
    }
    hs.sort((a, z) => z.weight - a.weight || a.position.localeCompare(z.position));
    byProblematic[pr.id] = { id: pr.id, resolution, fog: 1 - resolution, mass, holdings: hs, rejected };
  }
  const held = Object.values(byPosition)
    .filter((h) => h.weight >= HOLD_THRESHOLD)
    .sort((a, z) => z.weight - a.weight || a.position.localeCompare(z.position));
  const out = { byPosition, byProblematic, held };
  cache.set(s, { rev: s.rev, h: out });
  return out;
}

export function holds(b: Bundle, s: State, position: string): boolean {
  return (holdings(b, s).byPosition[position]?.weight ?? 0) >= HOLD_THRESHOLD;
}

export function weightOf(b: Bundle, s: State, position: string): number {
  return holdings(b, s).byPosition[position]?.weight ?? 0;
}
