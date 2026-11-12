/**
 * Compile YAML content into dist/bundle.json, running every content lint.
 *
 *   tsx src/compile.ts            compile + lint (fails on lint errors)
 *   tsx src/compile.ts --lint-only
 *   tsx src/compile.ts --stats    print coverage against the floors
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import * as S from './schema.js';
import { lintBundle, FLOORS } from './lint.js';
import { loadRegistry } from './registry.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const dataDir = join(root, 'data');
const distDir = join(root, 'dist');

function yamlFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...yamlFiles(p));
    else if (/\.ya?ml$/.test(name)) out.push(p);
  }
  return out;
}

export interface CompileResult {
  bundle: S.Bundle;
  errors: string[];
  warnings: string[];
}

function load<T>(file: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>, errors: string[]): T | null {
  let raw: unknown;
  try {
    raw = parse(readFileSync(file, 'utf8'), { maxAliasCount: -1 });
  } catch (e) {
    errors.push(`${rel(file)}: YAML parse error: ${(e as Error).message.split('\n')[0]}`);
    return null;
  }
  const r = schema.safeParse(raw);
  if (!r.success) {
    for (const issue of r.error.issues.slice(0, 25)) {
      errors.push(`${rel(file)}: ${issue.path.join('.')}: ${issue.message}`);
    }
    if (r.error.issues.length > 25) errors.push(`${rel(file)}: ...and ${r.error.issues.length - 25} more issues`);
    return null;
  }
  return r.data;
}

const rel = (f: string) => relative(root, f).replace(/\\/g, '/');

export function compile(): CompileResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version: string };
  const b: S.Bundle = {
    version: pkg.version,
    ontologyVersion: S.ONTOLOGY_VERSION,
    base: S.ONTOLOGY_BASE,
    problematics: {},
    positions: {},
    traditions: {},
    families: {},
    thinkers: {},
    events: {},
    debates: {},
    nodes: {},
    trunk: [],
    arcs: {},
    descents: {},
    probes: [],
    pressure: [],
    modules: [],
    tensions: {},
    situation: [],
    practice: {},
    reach: {},
  };
  const seen = new Map<string, string>();
  const claim = (kind: string, id: string, file: string) => {
    const key = `${kind}:${id}`;
    if (seen.has(key)) errors.push(`${rel(file)}: duplicate ${kind} id "${id}" (also in ${seen.get(key)})`);
    seen.set(key, rel(file));
  };

  for (const f of yamlFiles(join(dataDir, 'problematics'))) {
    const d = load(f, S.ProblematicFile, errors);
    if (!d) continue;
    for (const p of d.problematics) {
      claim('problematic', p.id, f);
      const ids: string[] = [];
      for (const pos of p.positions) {
        claim('position', pos.id, f);
        if (!pos.id.startsWith(p.id + '.')) errors.push(`${rel(f)}: position ${pos.id} must be prefixed by its problematic ${p.id}.`);
        b.positions[pos.id] = { ...pos, problematic: p.id };
        ids.push(pos.id);
      }
      b.problematics[p.id] = { ...p, positions: ids };
    }
  }
  const registry = loadRegistry();
  for (const fam of registry.families) b.families[fam.id] = fam;
  const reg = new Map(registry.traditions.map((t) => [t.id, t]));
  for (const f of yamlFiles(join(dataDir, 'traditions'))) {
    const d = load(f, S.TraditionFile, errors);
    if (!d) continue;
    for (const t of d.traditions) {
      claim('tradition', t.id, f);
      const r = reg.get(t.id);
      if (!r) {
        errors.push(`${rel(f)}: tradition "${t.id}" is not in registry/traditions.yaml`);
        continue;
      }
      b.traditions[t.id] = { ...t, name: t.name ?? r.name, family: r.family, parent: t.parent ?? r.parent, era: t.era ?? r.era } as S.Tradition;
    }
  }
  for (const r of registry.traditions) if (!b.traditions[r.id]) warnings.push(`tradition ${r.id}: registry entry has no full entry yet`);
  for (const f of yamlFiles(join(dataDir, 'thinkers'))) {
    const d = load(f, S.ThinkerFile, errors);
    if (!d) continue;
    for (const t of d.thinkers) {
      claim('thinker', t.id, f);
      b.thinkers[t.id] = t;
    }
  }
  for (const f of yamlFiles(join(dataDir, 'events'))) {
    const d = load(f, S.EventFile, errors);
    if (!d) continue;
    for (const e of d.events) {
      claim('event', e.id, f);
      b.events[e.id] = e;
    }
  }
  for (const f of yamlFiles(join(dataDir, 'debates'))) {
    const d = load(f, S.DebateFile, errors);
    if (!d) continue;
    for (const e of d.debates) {
      claim('debate', e.id, f);
      b.debates[e.id] = e;
    }
  }
  const addNode = (n: S.Node, role: S.Node['role'], f: string, extra: Partial<S.Node> = {}) => {
    claim('node', n.id, f);
    b.nodes[n.id] = { ...n, role, ...extra };
  };
  const trunkFile = join(dataDir, 'trunk.yaml');
  if (existsSync(trunkFile)) {
    const d = load(trunkFile, S.NodeFile, errors);
    if (d)
      for (const n of d.nodes) {
        addNode(n, 'trunk', trunkFile);
        b.trunk.push(n.id);
      }
  }
  for (const f of yamlFiles(join(dataDir, 'arcs'))) {
    const d = load(f, S.ArcFile, errors);
    if (!d) continue;
    claim('arc', d.id, f);
    const { nodes, ...arc } = d;
    for (const n of nodes) addNode(n, 'arc', f, { arc: d.id });
    b.arcs[d.id] = { ...arc, nodes: nodes.map((n) => n.id) };
  }
  for (const f of yamlFiles(join(dataDir, 'descents'))) {
    const d = load(f, S.DescentFile, errors);
    if (!d) continue;
    claim('descent', d.id, f);
    const { nodes, ...desc } = d;
    for (const n of nodes) addNode(n, 'descent', f, { descent: d.id });
    b.descents[d.id] = { ...desc, nodes: nodes.map((n) => n.id) };
  }
  for (const f of yamlFiles(join(dataDir, 'probes'))) {
    const d = load(f, S.NodeFile, errors);
    if (!d) continue;
    for (const n of d.nodes) {
      addNode(n, 'probe', f);
      b.probes.push(n.id);
    }
  }
  for (const f of yamlFiles(join(dataDir, 'pressure'))) {
    const d = load(f, S.NodeFile, errors);
    if (!d) continue;
    for (const n of d.nodes) {
      addNode(n, 'pressure', f);
      b.pressure.push(n.id);
    }
  }
  for (const f of yamlFiles(join(dataDir, 'modules'))) {
    const d = load(f, S.NodeFile, errors);
    if (!d) continue;
    for (const n of d.nodes) {
      addNode(n, 'module', f);
      b.modules.push(n.id);
    }
  }
  for (const f of yamlFiles(join(dataDir, 'tensions'))) {
    const d = load(f, S.TensionFile, errors);
    if (!d) continue;
    for (const t of d.tensions) {
      claim('tension', t.id, f);
      b.tensions[t.id] = t;
    }
  }
  const sitFile = join(dataDir, 'situation.yaml');
  if (existsSync(sitFile)) {
    const d = load(sitFile, S.SituationFile, errors);
    if (d) {
      b.situation = d.situation;
      for (const p of d.practice) b.practice[p.id] = p;
    }
  }

  // reverse reach index
  const reach: Record<string, Set<string>> = {};
  const touch = (pos: string, node: string) => (reach[pos] ??= new Set()).add(node);
  for (const n of Object.values(b.nodes)) {
    for (const o of n.options) {
      for (const e of o.evidence) touch(e.position, n.id);
      for (const po of o.probe?.options ?? []) for (const e of po.evidence) touch(e.position, n.id);
    }
    for (const a of [...n.premises, ...n.conditions]) for (const e of a.evidence) touch(e.position, n.id);
    for (const it of n.allocate?.items ?? []) for (const e of it.evidence) touch(e.position, n.id);
  }
  for (const [k, v] of Object.entries(reach)) b.reach[k] = [...v].sort();

  // tradition -> thinkers, derived from thinker entries
  for (const th of Object.values(b.thinkers))
    for (const t of th.traditions) {
      const tr = b.traditions[t];
      if (tr && !tr.thinkers.includes(th.id)) tr.thinkers.push(th.id);
    }
  lintBundle(b, errors, warnings, new Set(registry.traditions.map((t) => t.id)));
  return { bundle: b, errors, warnings };
}

function stats(b: S.Bundle) {
  const leafTraditions = Object.values(b.traditions).filter((t) => t.leaf).length;
  const nodes = Object.keys(b.nodes).length;
  const rows: [string, number, number][] = [
    ['problematics', Object.keys(b.problematics).length, FLOORS.problematics],
    ['positions', Object.keys(b.positions).length, FLOORS.positions],
    ['traditions (leaf)', leafTraditions, FLOORS.traditions],
    ['thinkers', Object.keys(b.thinkers).length, FLOORS.thinkers],
    ['events', Object.keys(b.events).length, FLOORS.events],
    ['debates', Object.keys(b.debates).length, FLOORS.debates],
    ['arcs', Object.keys(b.arcs).length, FLOORS.arcs],
    ['nodes', nodes, FLOORS.nodes],
    ['tension rules', Object.keys(b.tensions).length, FLOORS.tensions],
  ];
  return rows;
}

function writeSchemas() {
  const out = join(distDir, 'schemas');
  mkdirSync(out, { recursive: true });
  const pairs: [string, z.ZodTypeAny][] = [
    ['problematic-file', S.ProblematicFile],
    ['tradition-file', S.TraditionFile],
    ['thinker-file', S.ThinkerFile],
    ['event-file', S.EventFile],
    ['debate-file', S.DebateFile],
    ['node-file', S.NodeFile],
    ['arc', S.ArcFile],
    ['descent', S.DescentFile],
    ['tension-file', S.TensionFile],
    ['situation-file', S.SituationFile],
  ];
  for (const [name, schema] of pairs) {
    writeFileSync(join(out, `${name}.schema.json`), JSON.stringify(zodToJsonSchema(schema, { name, $refStrategy: 'root' }), null, 2));
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const args = new Set(process.argv.slice(2));
  const { bundle, errors, warnings } = compile();
  if (args.has('--stats') || !args.has('--lint-only')) {
    console.log('coverage against floors:');
    for (const [k, v, f] of stats(bundle)) console.log(`  ${v >= f ? 'ok ' : '.. '} ${k.padEnd(18)} ${String(v).padStart(5)} / ${f}`);
  }
  if (warnings.length) {
    console.log(`\n${warnings.length} warnings`);
    if (args.has('--verbose') || warnings.length <= 40) for (const w of warnings) console.log('  warn ' + w);
    else for (const w of warnings.slice(0, 40)) console.log('  warn ' + w);
  }
  if (errors.length) {
    console.error(`\n${errors.length} errors`);
    for (const e of errors.slice(0, args.has('--verbose') ? 100000 : 150)) console.error('  ' + e);
    if (!args.has('--force')) process.exit(1);
    console.error('--force: writing the bundle despite errors (development only)');
  }
  if (!args.has('--lint-only')) {
    mkdirSync(distDir, { recursive: true });
    writeFileSync(join(distDir, 'bundle.json'), JSON.stringify(bundle));
    writeSchemas();
    console.log(`\nwrote dist/bundle.json (${(JSON.stringify(bundle).length / 1024).toFixed(0)} KB)`);
  } else console.log('\nlint ok');
}
