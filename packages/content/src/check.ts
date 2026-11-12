/**
 * Validate one or more content files in isolation, for authors.
 *   npx tsx src/check.ts data/problematics/economy-1.yaml [more files...]
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { parse } from 'yaml';
import * as S from './schema.js';
import { loadedTerms } from './lint.js';
import { contentRoot, loadRegistry, reservedCoreIds } from './registry.js';

const files = process.argv.slice(2);
if (!files.length) {
  console.error('usage: tsx src/check.ts <file.yaml> [...]');
  process.exit(2);
}

function allYaml(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? allYaml(p) : /\.ya?ml$/.test(n) ? [p] : [];
  });
}

function tryParse<T>(f: string): T | null {
  try {
    return parse(readFileSync(f, 'utf8'), { maxAliasCount: -1 }) as T;
  } catch {
    return null;
  }
}

const registry = loadRegistry();
const traditionIds = new Set(registry.traditions.map((t) => t.id));
const knownPositions = new Set(reservedCoreIds());
const knownProblematics = new Set<string>();
const knownThinkers = new Set<string>();
const knownPractice = new Set<string>();
for (const f of allYaml(join(contentRoot, 'data', 'problematics'))) {
  const d = tryParse<{ problematics?: { id: string; positions?: { id: string }[] }[] }>(f);
  for (const p of d?.problematics ?? []) {
    knownProblematics.add(p.id);
    for (const x of p.positions ?? []) knownPositions.add(x.id);
  }
}
for (const f of allYaml(join(contentRoot, 'data', 'thinkers'))) {
  const d = tryParse<{ thinkers?: { id: string }[] }>(f);
  for (const t of d?.thinkers ?? []) knownThinkers.add(t.id);
}
const sit = tryParse<{ practice?: { id: string }[] }>(join(contentRoot, 'data', 'situation.yaml'));
for (const p of sit?.practice ?? []) knownPractice.add(p.id);

type Schema = { safeParse: (x: unknown) => { success: boolean; error?: { issues: { path: (string | number)[]; message: string }[] } } };

let failed = 0;
for (const file of files) {
  const abs = resolve(file);
  const rel = relative(contentRoot, abs).replace(/\\/g, '/');
  const errs: string[] = [];
  const warns: string[] = [];
  let raw: unknown;
  try {
    raw = parse(readFileSync(abs, 'utf8'), { maxAliasCount: -1 });
  } catch (e) {
    console.log(`✗ ${rel}: YAML parse error: ${(e as Error).message}`);
    failed++;
    continue;
  }
  const parts = rel.split('/');
  const kind = parts[1] ?? '';
  const schema: Schema = (
    kind === 'problematics' ? S.ProblematicFile
    : kind === 'traditions' ? S.TraditionFile
    : kind === 'thinkers' ? S.ThinkerFile
    : kind === 'events' ? S.EventFile
    : kind === 'debates' ? S.DebateFile
    : kind === 'arcs' ? S.ArcFile
    : kind === 'descents' ? S.DescentFile
    : kind === 'tensions' ? S.TensionFile
    : kind === 'situation.yaml' ? S.SituationFile
    : S.NodeFile
  ) as unknown as Schema;
  const r = schema.safeParse(raw);
  if (!r.success) for (const i of r.error!.issues.slice(0, 60)) errs.push(`schema: ${i.path.join('.')}: ${i.message}`);

  // tradition references
  const tradRefs = new Set<string>();
  const posRefs = new Set<string>();
  const narrator: { field: string; val: string }[] = [];
  const walk = (x: unknown, parent = '') => {
    if (Array.isArray(x)) {
      for (const y of x) walk(y, parent);
      return;
    }
    if (!x || typeof x !== 'object') return;
    for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
      if (['defining', 'typical', 'contested', 'rejects'].includes(k) && Array.isArray(v)) v.forEach((t) => tradRefs.add(String(t)));
      if (k === 'from' && typeof v === 'string' && parent === 'against') tradRefs.add(v);
      if (k === 'tradition' && typeof v === 'string') tradRefs.add(v);
      if ((k === 'descendsFrom' || k === 'breaksWith') && Array.isArray(v)) v.forEach((l) => tradRefs.add(String((l as { id: string }).id)));
      if (k === 'traditions' && Array.isArray(v) && kind !== 'traditions') v.forEach((t) => typeof t === 'string' && tradRefs.add(t));
      if (['position', 'revise', 'holds', 'tests'].includes(k) && typeof v === 'string') posRefs.add(v);
      if (['presupposes', 'excludes', 'tension', 'holdsAll', 'holdsAny', 'between'].includes(k) && Array.isArray(v)) v.forEach((t) => typeof t === 'string' && posRefs.add(t));
      if (k === 'positions' && Array.isArray(v) && kind !== 'problematics') v.forEach((t) => typeof t === 'string' && posRefs.add(t));
      if (k === 'weight' && v && typeof v === 'object' && 'position' in v) posRefs.add(String((v as { position: string }).position));
      if (['claim', 'you', 'mechanism', 'consequence', 'summary', 'recap'].includes(k) && typeof v === 'string') narrator.push({ field: k, val: v });
      if (k === 'text' && typeof v === 'string' && parent !== 'against' && kind !== 'problematics' && kind !== 'debates' && kind !== 'traditions') narrator.push({ field: k, val: v });
      if (k === 'record' && Array.isArray(v)) v.forEach((it) => narrator.push({ field: 'record', val: String((it as { text: string }).text) }));
      if (k === 'analysis' && kind === 'traditions' && v && typeof v === 'object')
        for (const f of ['conditions', 'class_base', 'function']) narrator.push({ field: `analysis.${f}`, val: String((v as Record<string, string>)[f] ?? '') });
      walk(v, k);
    }
  };
  walk(raw);
  for (const t of tradRefs) if (!traditionIds.has(t)) errs.push(`unknown tradition id "${t}"`);
  if (kind === 'traditions') for (const t of (raw as { traditions?: { id: string }[] }).traditions ?? []) if (!traditionIds.has(t.id)) errs.push(`tradition ${t.id} not in registry`);
  const local = new Set<string>();
  if (kind === 'problematics') for (const p of (raw as { problematics?: { positions?: { id: string }[] }[] }).problematics ?? []) for (const x of p.positions ?? []) local.add(x.id);
  for (const p of posRefs) if (!knownPositions.has(p) && !local.has(p)) errs.push(`unknown position "${p}"`);
  for (const n of narrator) {
    const hits = loadedTerms(n.val);
    if (hits.length) errs.push(`narrator-voice loaded term(s) [${hits.join(', ')}] in ${n.field}: "${n.val.slice(0, 90)}…"`);
  }
  if (kind === 'problematics') {
    for (const p of (raw as { problematics?: { id: string; positions?: { id: string }[] }[] }).problematics ?? []) {
      if ((p.positions?.length ?? 0) < 4) warns.push(`${p.id}: only ${p.positions?.length ?? 0} positions (aim for 5–8)`);
      for (const x of p.positions ?? []) if (!x.id.startsWith(p.id + '.')) errs.push(`${x.id} must start with "${p.id}."`);
    }
  }
  if (kind === 'debates')
    for (const d of (raw as { debates?: { sides?: { thinkers?: string[] }[] }[] }).debates ?? [])
      for (const s of d.sides ?? []) for (const t of s.thinkers ?? []) if (!knownThinkers.has(t)) errs.push(`unknown thinker "${t}"`);
  const practiceRe = /"practice":\[([^\]]*)\]/g;
  let m: RegExpExecArray | null;
  const text = JSON.stringify(raw);
  while (kind !== "situation.yaml" && (m = practiceRe.exec(text))) for (const x of m[1]!.split(',')) {
    const id = x.replace(/"/g, '').trim();
    if (id && knownPractice.size && !knownPractice.has(id)) errs.push(`unknown practice item "${id}"`);
  }
  void knownProblematics;
  if (errs.length) {
    failed++;
    console.log(`✗ ${rel}: ${errs.length} error(s)`);
    for (const e of errs) console.log('   ' + e);
  } else console.log(`✓ ${rel}`);
  for (const w of warns) console.log('   warn ' + w);
}
process.exit(failed ? 1 : 0);
