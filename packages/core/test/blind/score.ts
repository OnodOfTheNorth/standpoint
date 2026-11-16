/**
 * Score blind runs against the persona definitions (phase 2 brief, section 1, step 2).
 *
 *   npx tsx packages/core/test/blind/score.ts [run.json ...]     (default: every file in runs/)
 *
 * For each run: replays the saved session through the engine, then compares the result with the suite
 * persona of the same id (file name `<id>.<n>.json`): keystone recovery (`expect`), contradicted holdings
 * (`never`), agreement with the persona's targets, the rank of the persona's own tradition and of its
 * neighbor's, and the readings' headlines. The persona definitions are the answer-policy side of the same
 * brief, so a mismatch is either a policy that misdescribes the tradition or content that misreads a real
 * holder; the report shows which positions differ so the cause can be traced.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Engine, holdings, computeResult, type Session } from '../../src/index.js';
import { affinities } from '../../src/analysis/map.js';
import { realBundle, type Persona } from '../personas/policy.js';
import { leftPersonas } from '../personas/left.js';
import { rightPersonas } from '../personas/right.js';
import { otherPersonas } from '../personas/other.js';
import { incoherentPersonas } from '../personas/incoherent.js';
import { divergentPersonas } from '../personas/divergent.js';

const here = dirname(fileURLToPath(import.meta.url));
const b = realBundle();
const ALL: Persona[] = [...leftPersonas, ...rightPersonas, ...otherPersonas, ...incoherentPersonas, ...divergentPersonas];
const byId = new Map(ALL.map((p) => [p.id, p]));
// the neighbor pairs the suite separates; the blind runs must separate them too
const NEIGHBOR: Record<string, string> = {
  'council-communist': 'anarcho-syndicalist',
  'anarcho-syndicalist': 'council-communist',
  'liberal-technocrat': 'ordoliberal',
  ordoliberal: 'liberal-technocrat',
};

const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(join(here, 'runs')).filter((f) => f.endsWith('.json')).map((f) => join(here, 'runs', f));

const rows: unknown[] = [];
for (const file of files) {
  const run = JSON.parse(readFileSync(file, 'utf8')) as { session: Session };
  const id = basename(file).replace(/\.\d+\.json$/, '');
  const p = byId.get(id);
  const e = new Engine(b, run.session);
  const h = holdings(b, e.state);
  const held = new Set(h.held.map((x) => x.position));
  const res = computeResult(b, run.session);
  const aff = affinities(b, e.state);
  const rank = (t?: string) => (t ? aff.findIndex((a) => a.tradition === t) + 1 || null : null);
  const out: Record<string, unknown> = { run: basename(file), decisions: e.state.decisions };
  console.log(`\n=== ${basename(file)}  (${e.state.decisions} decisions)`);
  if (p) {
    const exp = p.expect ?? [];
    const got = exp.filter((x) => held.has(x));
    const never = (p.never ?? []).filter((x) => held.has(x));
    const pos = Object.entries(p.targets).filter(([, w]) => w > 0).map(([k]) => k);
    const neg = Object.entries(p.targets).filter(([, w]) => w < 0).map(([k]) => k);
    const posHeld = pos.filter((x) => held.has(x));
    const negHeld = neg.filter((x) => held.has(x));
    const own = p.traditions?.[0];
    const nb = NEIGHBOR[id] ? byId.get(NEIGHBOR[id]!)?.traditions?.[0] : undefined;
    console.log(`keystones recovered: ${got.length}/${exp.length}  ${exp.filter((x) => !held.has(x)).map((x) => `missing ${x}`).join('; ')}`);
    console.log(`never held (should be none): ${never.join(', ') || 'none'}`);
    console.log(`targets held: ${posHeld.length}/${pos.length} wanted; ${negHeld.length}/${neg.length} rejected ones held ${negHeld.join(', ')}`);
    console.log(`own tradition ${own} rank ${rank(own)}${nb ? `; neighbor ${nb} rank ${rank(nb)}` : ''}`);
    Object.assign(out, { keystones: `${got.length}/${exp.length}`, missing: exp.filter((x) => !held.has(x)), never, targetsHeld: `${posHeld.length}/${pos.length}`, rejectedHeld: negHeld, ownRank: rank(own), neighborRank: nb ? rank(nb) : undefined });
  } else console.log('(no suite persona with this id: scored by eye only)');
  console.log(`top traditions: ${aff.slice(0, 6).map((a) => `${a.tradition} ${a.score.toFixed(2)}`).join(', ')}`);
  console.log(`top keystones: ${res.keystones.slice(0, 5).map((k) => k.position).join(', ')}`);
  console.log('reading:');
  for (const c of res.reading) console.log(`  - [${c.id}] ${c.headline}`);
  console.log(`live tensions: ${res.tensions.live.map((t) => t.rule).join(', ') || 'none'}`);
  Object.assign(out, { topTraditions: aff.slice(0, 6).map((a) => a.tradition), topKeystones: res.keystones.slice(0, 5).map((k) => k.position), reading: res.reading.map((c) => c.headline) });
  rows.push(out);
}
writeFileSync(join(here, 'score.json'), JSON.stringify(rows, null, 2));
