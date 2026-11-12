/** Compare two results, and diff two dated results of the same person. */
import type { Bundle } from '@standpoint/content/schema';
import type { Result } from './result.js';

const PRIMARY_SIDE: Record<string, 'with-drain' | 'against-drain' | 'unclear'> = {
  'primary.defends': 'with-drain',
  'primary.humanizes': 'with-drain',
  'primary.ambivalent': 'unclear',
  'primary.ignores': 'unclear',
  'primary.unresolved': 'unclear',
  'primary.opposes-in-words': 'against-drain',
  'primary.opposes-in-practice': 'against-drain',
};
const LABOR = new Set(['core-workers', 'peripheral-workers', 'reserve-army', 'peasantry']);
const CAPITAL = new Set(['finance-capital', 'industrial-capital', 'landed-capital', 'comprador-capital']);

function sameSet(a: string[], b: string[]) {
  return a.length === b.length && a.every((x) => b.includes(x));
}

export function compare(b: Bundle, A: Result, B: Result) {
  const ha = new Map(A.holdings.map((h) => [h.position, h]));
  const hb = new Map(B.holdings.map((h) => [h.position, h]));
  const shared = A.holdings.filter((h) => hb.has(h.position)).map((h) => h.position);
  const real: { problematic: string; a: string; b: string; keystone: boolean }[] = [];
  const verbal: { problematic: string; a: string; b: string; why: string }[] = [];
  const byProbA = new Map<string, string[]>();
  for (const h of A.holdings) (byProbA.get(h.problematic) ?? byProbA.set(h.problematic, []).get(h.problematic)!).push(h.position);
  const keys = new Set([...A.keystones, ...B.keystones].map((k) => k.position));
  for (const h of B.holdings) {
    const as = byProbA.get(h.problematic);
    if (!as || as.includes(h.position)) continue;
    for (const a of as) {
      if (hb.has(a) || ha.has(h.position)) continue;
      const pa = b.positions[a]!;
      const pb = b.positions[h.position]!;
      const excl = pa.excludes.includes(pb.id) || pb.excludes.includes(pa.id);
      const sameEffect =
        pa.analysis.drain === pb.analysis.drain &&
        pa.analysis.law_of_value === pb.analysis.law_of_value &&
        sameSet(pa.analysis.gains, pb.analysis.gains) &&
        sameSet(pa.analysis.pays, pb.analysis.pays);
      if (!excl && sameEffect)
        verbal.push({ problematic: h.problematic, a, b: h.position, why: 'Different words, same class content and the same effect on the drain and on commodification.' });
      else real.push({ problematic: h.problematic, a, b: h.position, keystone: keys.has(a) || keys.has(h.position) });
    }
  }
  const ca = A.situation.location.primary;
  const cb = B.situation.location.primary;
  const classInterest =
    !ca || !cb
      ? { shared: null as boolean | null, text: 'One or both skipped the Situation questions; class interest cannot be compared.' }
      : ca === cb || (LABOR.has(ca) && LABOR.has(cb)) || (CAPITAL.has(ca) && CAPITAL.has(cb))
        ? { shared: true, text: `You share a class interest: ${A.situation.className} and ${B.situation.className}.` }
        : { shared: false, text: `Your class interests differ: ${A.situation.className} and ${B.situation.className}.` };
  const sideOf = (r: Result) => PRIMARY_SIDE[r.reading.find((c) => c.id.startsWith('primary.') && c.id in PRIMARY_SIDE)?.id ?? ''] ?? 'unclear';
  const sa = sideOf(A);
  const sb = sideOf(B);
  const primary =
    sa === 'unclear' || sb === 'unclear'
      ? { shared: null as boolean | null, text: 'At least one of you has an unclear stance toward the drain.' }
      : { shared: sa === sb, text: sa === sb ? `You stand on the same side of the primary contradiction (${sa === 'against-drain' ? 'against' : 'with'} the drain).` : 'You stand on opposite sides of the primary contradiction.' };
  const program = shared.filter((p) => {
    const layer = b.problematics[b.positions[p]!.problematic]!.layer;
    return layer === 'horizon' || layer === 'strategy' || layer === 'analysis';
  });
  return {
    shared,
    real,
    verbal,
    classInterest,
    primary,
    minimumProgram: program.map((p) => ({ position: p, label: b.positions[p]!.label, claim: b.positions[p]!.claim })),
    struggle: real
      .sort((x, y) => Number(y.keystone) - Number(x.keystone))
      .slice(0, 8)
      .map((r) => ({ ...r, question: b.problematics[r.problematic]!.question, aLabel: b.positions[r.a]!.label, bLabel: b.positions[r.b]!.label })),
  };
}

export function diff(b: Bundle, before: Result, after: Result) {
  const hb = new Map(before.holdings.map((h) => [h.position, h.weight]));
  const ha = new Map(after.holdings.map((h) => [h.position, h.weight]));
  const gained = after.holdings.filter((h) => !hb.has(h.position)).map((h) => ({ position: h.position, label: h.label, weight: h.weight }));
  const lost = before.holdings.filter((h) => !ha.has(h.position)).map((h) => ({ position: h.position, label: h.label, weight: h.weight }));
  const moved = after.holdings
    .filter((h) => hb.has(h.position) && Math.abs(h.weight - hb.get(h.position)!) >= 0.15)
    .map((h) => ({ position: h.position, label: h.label, from: hb.get(h.position)!, to: h.weight }));
  const tb = new Set(before.tensions.live.map((t) => t.rule));
  const ta = new Set(after.tensions.live.map((t) => t.rule));
  const headlines = (r: Result) => new Map(r.reading.map((c) => [c.section + ':' + c.id, c.headline]));
  const rb = headlines(before);
  const ra = headlines(after);
  const readingChanges = [...ra].filter(([k, v]) => rb.get(k) !== v).map(([k, v]) => ({ claim: k, before: rb.get(k) ?? null, after: v }));
  return {
    from: before.meta.date,
    to: after.meta.date,
    gained,
    lost,
    moved,
    tensionsOpened: [...ta].filter((t) => !tb.has(t)),
    tensionsClosed: [...tb].filter((t) => !ta.has(t)),
    readingChanges,
    keystonesBefore: before.keystones.map((k) => k.position),
    keystonesAfter: after.keystones.map((k) => k.position),
    _bundleVersion: b.version,
  };
}
