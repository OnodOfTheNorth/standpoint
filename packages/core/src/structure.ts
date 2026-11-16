/** Structural analysis over holdings: keystones and tensions. */
import type { Bundle } from '@standpoint/content/schema';
import type { State } from './types.js';
import { holdings, HOLD_THRESHOLD } from './holdings.js';
import { evaluate } from './cond.js';

export interface Keystone {
  position: string;
  score: number;
  dependents: string[]; // held positions that (transitively) presuppose it
  tensions: string[];
}

/** Keystones: held positions whose reversal would reorganize the most others. */
export function keystones(b: Bundle, s: State, limit = 5): Keystone[] {
  const h = holdings(b, s);
  const held = new Map(h.held.map((x) => [x.position, x.weight]));
  // reverse presupposes graph restricted to held positions
  const dependentsOf = new Map<string, string[]>();
  for (const pid of held.keys()) {
    for (const pre of b.positions[pid]?.presupposes ?? []) {
      if (!held.has(pre)) continue;
      (dependentsOf.get(pre) ?? dependentsOf.set(pre, []).get(pre)!).push(pid);
    }
  }
  const out: Keystone[] = [];
  for (const [pid, w] of held) {
    const seen = new Set<string>();
    const stack = [...(dependentsOf.get(pid) ?? [])];
    while (stack.length) {
      const x = stack.pop()!;
      if (seen.has(x) || x === pid) continue;
      seen.add(x);
      stack.push(...(dependentsOf.get(x) ?? []));
    }
    const pos = b.positions[pid]!;
    const imp = b.problematics[pos.problematic]?.importance ?? 2;
    const tensions = pos.tension.filter((t) => held.has(t));
    // positions elsewhere that this one excludes but which carry evidence: reversal would free them
    const freed = pos.excludes.filter((x) => (s.scores[x] ?? 0) < 0).length;
    const depMass = [...seen].reduce((a, x) => a + (held.get(x) ?? 0), 0);
    const score = w * (1 + depMass * 1.5 + tensions.length * 0.3 + freed * 0.2) * (0.6 + imp * 0.2) * (0.5 + Math.min(1, (h.byPosition[pid]?.trail.length ?? 0) / 3) * 0.5);
    out.push({ position: pid, score, dependents: [...seen].sort(), tensions });
  }
  out.sort((a, z) => z.score - a.score || a.position.localeCompare(z.position));
  return out.slice(0, limit);
}

export interface LiveTension {
  rule: string;
  family: string;
  principal: boolean;
  weight: number;
}

/** Practices whose absence means the respondent belongs to no collective body that could act. */
const VEHICLE_PRACTICES = new Set([
  'practice.none',
  'practice.union-member',
  'practice.party-member',
  'practice.community-org',
  'practice.solidarity-org',
  'practice.peasant-movement',
  'practice.tenant-assoc',
  'practice.mutual-aid',
  'practice.strike',
  'practice.boycott-campaign',
]);

/**
 * The family a tension rule belongs to. Rules in one family express one contradiction, so a session gets at
 * most one challenge per family and the principal contradiction is chosen among families. A rule's explicit
 * `family` wins; otherwise a theory-practice rule about a missing collective body belongs to "no-vehicle",
 * another theory-practice rule to its practice, and any other rule is its own family.
 */
export function tensionFamily(b: Bundle, id: string): string {
  const t = b.tensions[id];
  if (!t) return id;
  const explicit = (t as { family?: string }).family;
  if (explicit) return explicit;
  if (t.type === 'theory-practice') {
    const p = t.between.find((x) => x.startsWith('practice.'));
    if (p && VEHICLE_PRACTICES.has(p)) return 'no-vehicle';
    if (p) return `practice:${p}`;
  }
  return id;
}

/** Tension rules whose condition currently holds. */
export function liveTensions(b: Bundle, s: State): LiveTension[] {
  const h = holdings(b, s);
  const ks = new Set(keystones(b, s, 5).map((k) => k.position));
  const out: LiveTension[] = [];
  for (const t of Object.values(b.tensions)) {
    if (!evaluate(b, s, t.when)) continue;
    let weight = 0;
    let keystone = false;
    for (const p of t.between) {
      const pos = b.positions[p];
      if (!pos) {
        weight += 0.5; // practice or situation term
        continue;
      }
      const imp = b.problematics[pos.problematic]?.importance ?? 2;
      weight += (h.byPosition[p]?.weight ?? 0) * imp;
      if (ks.has(p)) keystone = true;
    }
    out.push({ rule: t.id, family: tensionFamily(b, t.id), principal: false, weight: weight + (keystone ? 2 : 0) });
  }
  out.sort((a, z) => z.weight - a.weight || a.rule.localeCompare(z.rule));
  // The principal contradiction is chosen among families, by how many keystones the family touches
  // (then by weight); within the winning family, its heaviest rule stands for it.
  const fam = new Map<string, { keys: Set<string>; weight: number; top: LiveTension }>();
  for (const x of out) {
    let f = fam.get(x.family);
    if (!f) fam.set(x.family, (f = { keys: new Set(), weight: 0, top: x }));
    f.weight += x.weight;
    for (const p of b.tensions[x.rule]!.between) if (ks.has(p)) f.keys.add(p);
  }
  const best = [...fam.entries()].sort((a, z) => z[1].keys.size - a[1].keys.size || z[1].weight - a[1].weight || a[0].localeCompare(z[0]))[0];
  if (best) best[1].top.principal = true;
  return out;
}

export { HOLD_THRESHOLD };
