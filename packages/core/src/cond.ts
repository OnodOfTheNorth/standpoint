import type { Bundle, Cond } from '@standpoint/content/schema';
import type { State } from './types.js';
import { holds, weightOf } from './holdings.js';
import { location } from './situation.js';

export function evaluate(b: Bundle, s: State, c: Cond | undefined): boolean {
  if (!c) return true;
  if ('holds' in c) return holds(b, s, c.holds);
  if ('holdsAll' in c) return c.holdsAll.every((p) => holds(b, s, p));
  if ('holdsAny' in c) return c.holdsAny.some((p) => holds(b, s, p));
  if ('weight' in c) {
    const w = weightOf(b, s, c.weight.position);
    return (c.weight.gt === undefined || w > c.weight.gt) && (c.weight.lt === undefined || w < c.weight.lt);
  }
  if ('situation' in c) {
    const v = s.situation[c.situation.field];
    if (v === undefined) return false;
    const vals = Array.isArray(v) ? v : [v];
    return vals.some((x) => c.situation.in.includes(x));
  }
  if ('situationKnown' in c) return s.situation[c.situationKnown] !== undefined;
  if ('practice' in c) return s.practice.has(c.practice);
  if ('practiceAny' in c) return c.practiceAny.some((p) => s.practice.has(p));
  if ('flag' in c) return s.flags[c.flag.key] === c.flag.eq;
  if ('answered' in c)
    return s.answers.some((a) => a.node === c.answered.node && (c.answered.option === undefined || a.option === c.answered.option));
  if ('mode' in c) return c.mode.includes(s.mode);
  if ('classIs' in c) {
    const l = location(s);
    return !!l.primary && (c.classIs as string[]).includes(l.primary) || l.secondary.some((x) => (c.classIs as string[]).includes(x));
  }
  if ('worldIs' in c) {
    const l = location(s);
    return !!l.world && (c.worldIs as string[]).includes(l.world);
  }
  if ('respondentKind' in c) return c.respondentKind.includes(s.respondent.kind);
  if ('all' in c) return c.all.every((x) => evaluate(b, s, x));
  if ('any' in c) return c.any.some((x) => evaluate(b, s, x));
  if ('not' in c) return !evaluate(b, s, c.not);
  return false;
}
