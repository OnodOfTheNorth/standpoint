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
  principal: boolean;
  weight: number;
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
    out.push({ rule: t.id, principal: keystone, weight: weight + (keystone ? 2 : 0) });
  }
  out.sort((a, z) => z.weight - a.weight || a.rule.localeCompare(z.rule));
  if (out.length && !out.some((x) => x.principal)) out[0]!.principal = true;
  return out;
}

export { HOLD_THRESHOLD };
