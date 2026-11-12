import type { Bundle, ClassId, Drain, LawOfValue } from '@standpoint/content/schema';
import { CLASS_IDS } from '@standpoint/content/schema';
import type { Holding, State } from '../types.js';
import { holdings } from '../holdings.js';

export interface EvidenceRef {
  kind: 'position' | 'node' | 'situation' | 'practice' | 'pressure' | 'side' | 'tension' | 'cause' | 'trajectory';
  id: string;
  label: string;
}

export interface Claim {
  id: string;
  section: 'serves' | 'primary' | 'pressure' | 'crisis' | 'method' | 'motion' | 'organization' | 'anomalies' | 'respondent';
  headline: string;
  body: string[];
  mechanism: string[];
  evidence: EvidenceRef[];
  disputed?: string;
  confidence: number;
  dispute?: { text: string; at?: string };
}

export const DRAIN_VALUE: Record<Drain, number> = { sustains: -1, softens: -0.4, none: 0, reduces: 0.6, breaks: 1 };
export const LOV_VALUE: Record<LawOfValue, number> = { extends: -1, regulates: 0.4, none: 0, suspends: 0.7, abolishes: 1 };

export function held(b: Bundle, s: State): Holding[] {
  return holdings(b, s).held;
}

export function posRef(b: Bundle, id: string): EvidenceRef {
  return { kind: 'position', id, label: b.positions[id]?.label ?? id };
}

export function lcFirst(s: string): string {
  return s ? s[0]!.toLowerCase() + s.slice(1) : s;
}

export function stripPeriod(s: string): string {
  return s.replace(/[.\s]+$/, '');
}

export function listJoin(xs: string[], conj = 'and'): string {
  if (xs.length <= 1) return xs[0] ?? '';
  if (xs.length === 2) return `${xs[0]} ${conj} ${xs[1]}`;
  return `${xs.slice(0, -1).join(', ')}, ${conj} ${xs[xs.length - 1]}`;
}

export function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

export interface ClassVector {
  v: Record<ClassId, number>;
  contrib: Record<ClassId, { position: string; w: number }[]>;
  mass: number;
}

export function classVector(b: Bundle, hs: Holding[]): ClassVector {
  const v = Object.fromEntries(CLASS_IDS.map((c) => [c, 0])) as Record<ClassId, number>;
  const contrib = Object.fromEntries(CLASS_IDS.map((c) => [c, [] as { position: string; w: number }[]])) as ClassVector['contrib'];
  let mass = 0;
  for (const h of hs) {
    const a = b.positions[h.position]!.analysis;
    if (a.gains.length || a.pays.length) mass += h.weight;
    for (const c of a.gains) {
      v[c] += h.weight;
      contrib[c].push({ position: h.position, w: h.weight });
    }
    for (const c of a.pays) {
      v[c] -= h.weight;
      contrib[c].push({ position: h.position, w: -h.weight });
    }
  }
  for (const c of CLASS_IDS) contrib[c].sort((a, z) => Math.abs(z.w) - Math.abs(a.w) || a.position.localeCompare(z.position));
  return { v, contrib, mass };
}

/** Mean resolution of a set of problematics, weighted by importance. */
export function resolutionOf(b: Bundle, s: State, problematics: string[]): number {
  const h = holdings(b, s);
  let num = 0;
  let den = 0;
  for (const p of problematics) {
    const imp = b.problematics[p]?.importance ?? 2;
    num += imp * (h.byProblematic[p]?.resolution ?? 0);
    den += imp;
  }
  return den ? num / den : 0;
}
