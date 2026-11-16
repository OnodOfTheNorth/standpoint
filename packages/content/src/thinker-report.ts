/** Lists thinker-coverage gaps (brief section 6) from dist/bundle.json. Run after compile. */
import { readFileSync } from 'node:fs';
import { thinkerCoverage } from './lint.js';
const b = JSON.parse(readFileSync(new URL('../dist/bundle.json', import.meta.url), 'utf8'));
const c = thinkerCoverage(b);
const only = process.argv[2];
for (const k of ['traditions', 'problematics', 'debates'] as const) {
  if (only && only !== k) continue;
  console.log(`## ${k}: ${c[k].length} gap(s)`);
  for (const m of c[k]) console.log(m);
}
const one = (Object.values(b.traditions) as any[]).filter((t) => t.oneAuthor);
console.log(`
## one-author exceptions: ${one.length}`);
for (const t of one) console.log(`${t.id} (${t.thinkers.join(', ')}): ${t.oneAuthor}`);
const th = Object.values(b.thinkers) as any[];
const ps = Object.keys(b.positions).length;
const argued = new Set(th.flatMap((t) => t.argues.map((a: any) => a.position)));
console.log(`\nthinkers ${th.length}; positions argued ${argued.size}/${ps} (${Math.round((100 * argued.size) / ps)}%)`);
