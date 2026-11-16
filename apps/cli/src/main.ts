/**
 * standpoint: take the journey in a terminal, drive it as an agent over JSON lines,
 * or run a batch of answers; read, export, compare and diff results.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout, stderr, argv, exit } from 'node:process';
import type { Bundle } from '@standpoint/content/schema';
import bundleJson from '@standpoint/content/bundle.json';
import {
  Engine,
  newSession,
  computeResult,
  compare,
  diff,
  handle,
  describePrompt,
  lookup,
  search,
  type Mode,
  type Op,
  type Prompt,
  type Session,
  type Result,
} from '@standpoint/core';
import { blind } from './blind.js';
import { exportResult, ontologyJsonLd, ontologyTurtle, type ExportFormat } from '@standpoint/ontology';

const bundle = bundleJson as unknown as Bundle;

const HELP = `standpoint ${bundle.version}: map your political being.

Usage:
  standpoint [take] [--mode sketch|survey|excavation] [--session file.json] [--seed n]
      Take the journey interactively. Progress is saved to the session file.
  standpoint jsonl [--session file.json] [--mode m] [--kind ai --model M --operator O --persona P]
      JSON-lines protocol on stdin/stdout. One request per line:
        {"op":"next"}  {"op":"answer","option":"a"}  {"op":"answer","affordance":"reject","premise":"other","text":"..."}
        {"op":"undo"}  {"op":"state"}  {"op":"result"}  {"op":"explain","id":"node"}
        {"op":"situation-fields"} {"op":"situation","field":"income","value":["wages"]} {"op":"skip-situation"}
        {"op":"mode","mode":"excavation"} {"op":"descend"} {"op":"descend","descent":"id"}
        {"op":"correct","position":"id","stance":"hold|reject|clear"} {"op":"dispute","claim":"id","text":"..."}
        {"op":"lookup","id":"..."} {"op":"search","q":"..."} {"op":"session"} {"op":"export","format":"md"}
  standpoint batch --answers answers.json [--mode m] [--out session.json] [--format json|md|reading]
      answers.json is either a session log (array of answer events) or
      {"policy": {"<prompt id>": "<option id>" | {answer}}, "default": "first|decline|none", "situation": {...}}
  standpoint result <session.json> [--format json|jsonld|ttl|graphml|md|reading]
  standpoint compare <a.json> <b.json>     (sessions or results)
  standpoint diff <older.json> <newer.json>
  standpoint blind start|show|answer <run.json> ...
      Blind validation runs: one step per call, only what a person sees (see apps/cli/src/blind.ts).
  standpoint lookup <id>
  standpoint search <words...>
  standpoint ontology [--format ttl|jsonld]
Nothing is sent anywhere. Everything stays in local files.`;

function args() {
  const a = argv.slice(2);
  const flags: Record<string, string | boolean> = {};
  const pos: string[] = [];
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    if (x.startsWith('--')) {
      const k = x.slice(2);
      const v = a[i + 1];
      if (v !== undefined && !v.startsWith('--')) {
        flags[k] = v;
        i++;
      } else flags[k] = true;
    } else pos.push(x);
  }
  return { flags, pos };
}

function loadSession(path: string): Session {
  return JSON.parse(readFileSync(path, 'utf8')) as Session;
}

function toResult(path: string): Result {
  const x = JSON.parse(readFileSync(path, 'utf8')) as { format?: string };
  if (x.format === 'standpoint.result') return x as unknown as Result;
  return computeResult(bundle, x as Session);
}

function readingText(r: Result): string {
  const L: string[] = [];
  L.push(r.coverage.statement, '');
  L.push('PART ONE: THE READING (the instrument’s materialist analysis; every claim can be disputed)', '');
  for (const c of r.reading) {
    L.push(`[${c.section}] ${c.headline}`);
    for (const p of c.body) L.push(`    ${p}`);
    for (const m of c.mechanism) L.push(`    · ${m}`);
    for (const r of c.record ?? []) L.push(`    - ${r}`);
    if (c.disputed) L.push(`    (disputed among materialists) ${c.disputed}`);
    L.push('');
  }
  L.push('PART TWO: THE MAP (you, in your own terms)', '');
  for (const p of r.portrait) L.push(p, '');
  if (r.keystones.length) {
    L.push('Keystones:');
    for (const k of r.keystones) L.push(`  · ${k.label}`);
    L.push('');
  }
  if (r.tensions.live.length) {
    L.push('Live contradictions:');
    for (const t of r.tensions.live) L.push(`  · ${t.principal ? '(principal) ' : ''}${t.explain}`);
    L.push('');
  }
  if (r.affinities.length) {
    L.push('Nearest traditions (agreements / breaks):');
    for (const a of r.affinities.slice(0, 6)) L.push(`  · ${a.name}: ${a.agreements.length} / ${a.breaks.length}`);
  }
  return L.join('\n');
}

/* ------------------------------------------------------------------ */

async function interactive(flags: Record<string, string | boolean>) {
  const file = typeof flags.session === 'string' ? flags.session : 'standpoint-session.json';
  const rl = createInterface({ input: stdin, output: stdout });
  let engine: Engine;
  if (existsSync(file) && !flags.new) {
    engine = new Engine(bundle, loadSession(file));
    stdout.write(`Resuming ${file} (${engine.state.decisions} decisions so far).\n`);
  } else {
    let mode = flags.mode as Mode | undefined;
    if (!mode) {
      const m = (await rl.question('Depth? [1] Sketch ~5 min  [2] Survey ~20 min  [3] Excavation, open-ended  > ')).trim();
      mode = m === '1' ? 'sketch' : m === '3' ? 'excavation' : 'survey';
    }
    engine = new Engine(bundle, newSession(bundle, { mode, seed: flags.seed ? Number(flags.seed) : undefined, now: new Date().toISOString() }));
    const sit = (await rl.question('Answer a few optional questions about your situation (income, work, where you live)? It sharpens the reading. [y/N] > ')).trim().toLowerCase();
    if (sit === 'y') await situation(rl, engine);
    else engine.skipSituation();
  }
  const save = () => writeFileSync(file, JSON.stringify(engine.session, null, 2));
  for (;;) {
    const step = engine.next();
    for (const n of step.notices) stdout.write(`\n  ✦ ${n}\n`);
    if (!step.prompt) {
      save();
      stdout.write(`\nThat completes this ${engine.state.mode}. Session saved to ${file}.\n\n`);
      stdout.write(readingText(computeResult(bundle, engine.session)) + '\n');
      const more = (await rl.question('\nKeep going in Excavation mode? [y/N] > ')).trim().toLowerCase();
      if (more === 'y') {
        engine.setMode('excavation');
        continue;
      }
      break;
    }
    const done = await ask(rl, engine, step.prompt);
    save();
    if (done === 'quit') {
      stdout.write(`Saved to ${file}. Resume with: standpoint --session ${file}\n`);
      break;
    }
  }
  rl.close();
}

async function situation(rl: Awaited<ReturnType<typeof createInterface>>, engine: Engine) {
  stdout.write('\nSkip any question with Enter.\n');
  for (const f of bundle.situation.filter((x) => x.for !== 'ai')) {
    stdout.write(`\n${f.question}\n`);
    f.options.forEach((o, i) => stdout.write(`  ${i + 1}. ${o.text}\n`));
    const a = (await rl.question(f.multi ? '  (numbers, comma-separated) > ' : '  > ')).trim();
    if (!a) continue;
    const picks = a.split(/[ ,]+/).map((x) => f.options[Number(x) - 1]?.id).filter((x): x is string => !!x);
    if (picks.length) engine.setSituation(f.id, f.multi ? picks : picks[0]!);
  }
}

function render(p: Prompt) {
  const out: string[] = [''];
  const ctx = p.context;
  const where = ctx.arc ? `${ctx.arc.title} · ` : ctx.descent ? `Descent: ${ctx.descent.title} · ` : '';
  out.push(`── ${where}${p.title ?? p.type}${ctx.target ? `  [${ctx.decisions}/${ctx.target}]` : `  [${ctx.decisions}]`} ──`);
  if (ctx.arc && p.id === ctx.arc.id) out.push(ctx.arc.role);
  out.push(wrap(p.text));
  for (const v of p.voices ?? []) out.push(`  ${v.name}: ${wrap(v.says, 72, '    ')}`);
  for (const [i, c] of (p.cases ?? []).entries()) out.push(`  (${i + 1}) ${c}`);
  if (p.allocate) out.push(`  Divide ${p.allocate.budget} ${p.allocate.unit} among:`), p.allocate.items.forEach((it, i) => out.push(`   ${i + 1}. ${it.text}`));
  p.options.forEach((o, i) => out.push(`  ${String(i + 1).padStart(2)}. ${wrap(o.text, 72, '      ')}`));
  out.push(`  ${p.multi ? '(numbers, comma-separated)  ' : ''}r reject premise · d it depends · n none of these · x decline · u undo · w why · q save & quit`);
  return out.join('\n');
}

function wrap(s: string, w = 76, indent = ''): string {
  const words = s.replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const x of words) {
    if ((cur + ' ' + x).trim().length > w) {
      lines.push(cur);
      cur = x;
    } else cur = (cur + ' ' + x).trim();
  }
  if (cur) lines.push(cur);
  return lines.join('\n' + indent);
}

async function ask(rl: Awaited<ReturnType<typeof createInterface>>, engine: Engine, p: Prompt): Promise<'ok' | 'quit'> {
  stdout.write(render(p) + '\n');
  for (;;) {
    const a = (await rl.question('> ')).trim().toLowerCase();
    try {
      if (a === 'q') return 'quit';
      if (a === 'u') {
        engine.undo();
        return 'ok';
      }
      if (a === 'w') {
        const e = engine.explain(p.id);
        stdout.write(`  ${e?.why ?? ''}\n  Probes: ${(e?.probes ?? []).join('; ')}\n`);
        continue;
      }
      if (a === 'x') {
        engine.answer({ node: p.id, affordance: 'decline', at: new Date().toISOString() });
        return 'ok';
      }
      if (a === 'n') {
        const text = (await rl.question('  What would you say instead? (optional) > ')).trim();
        engine.answer({ node: p.id, affordance: 'none', text: text || undefined, at: new Date().toISOString() });
        return 'ok';
      }
      if (a === 'r' || a === 'd') {
        const list = a === 'r' ? p.premises : p.conditions;
        list.forEach((x, i) => stdout.write(`   ${i + 1}. ${x.text}\n`));
        stdout.write(`   ${list.length + 1}. Something else (type it)\n`);
        const k = (await rl.question(a === 'r' ? '  Which premise do you reject? > ' : '  It depends on what? > ')).trim();
        const pick = list[Number(k) - 1];
        const text = pick ? undefined : (await rl.question('  Say it in your words > ')).trim();
        engine.answer(
          a === 'r'
            ? { node: p.id, affordance: 'reject', premise: pick?.id ?? 'other', text, at: new Date().toISOString() }
            : { node: p.id, affordance: 'depends', condition: pick?.id ?? 'other', text, at: new Date().toISOString() },
        );
        return 'ok';
      }
      if (p.allocate) {
        const alloc: Record<string, number> = {};
        let left = p.allocate.budget;
        for (const it of p.allocate.items) {
          const v = Number((await rl.question(`  ${it.text} (${left} left) > `)).trim() || 0);
          alloc[it.id] = Math.max(0, Math.min(left, v));
          left -= alloc[it.id]!;
        }
        if (left > 0) alloc[p.allocate.items[p.allocate.items.length - 1]!.id]! += left;
        engine.answer({ node: p.id, alloc, at: new Date().toISOString() });
        return 'ok';
      }
      const nums = a.split(/[ ,]+/).map(Number).filter((n) => n >= 1 && n <= p.options.length);
      if (!nums.length) {
        stdout.write('  Pick an option number, or r/d/n/x/u/w/q.\n');
        continue;
      }
      if (p.multi) engine.answer({ node: p.id, options: nums.map((n) => p.options[n - 1]!.id), at: new Date().toISOString() });
      else engine.answer({ node: p.id, option: p.options[nums[0]! - 1]!.id, at: new Date().toISOString() });
      return 'ok';
    } catch (e) {
      stdout.write(`  ${(e as Error).message}\n`);
    }
  }
}

/* ------------------------------------------------------------------ */

async function jsonl(flags: Record<string, string | boolean>) {
  const file = typeof flags.session === 'string' ? flags.session : undefined;
  const engine =
    file && existsSync(file)
      ? new Engine(bundle, loadSession(file))
      : new Engine(
          bundle,
          newSession(bundle, {
            mode: (flags.mode as Mode) ?? 'survey',
            seed: flags.seed ? Number(flags.seed) : undefined,
            now: new Date().toISOString(),
            respondent:
              flags.kind === 'ai'
                ? { kind: 'ai', model: str(flags.model), operator: str(flags.operator), persona: str(flags.persona), conditions: str(flags.conditions) }
                : { kind: 'human' },
          }),
        );
  const rl = createInterface({ input: stdin, terminal: false });
  const write = (o: unknown) => stdout.write(JSON.stringify(o) + '\n');
  write({ ok: true, hello: 'standpoint', version: bundle.version, ontologyVersion: bundle.ontologyVersion, session: engine.session.id, mode: engine.state.mode, first: describeNext(engine) });
  for await (const line of rl) {
    if (!line.trim()) continue;
    let op: Op & { format?: ExportFormat };
    try {
      op = JSON.parse(line);
    } catch {
      write({ ok: false, error: 'invalid JSON' });
      continue;
    }
    if ((op as { op: string }).op === 'export') {
      const r = computeResult(bundle, engine.session);
      const x = exportResult(bundle, r, (op.format ?? 'json') as ExportFormat);
      write({ ok: true, format: op.format ?? 'json', mime: x.mime, body: x.body });
    } else write(handle(bundle, engine, op));
    if (file) writeFileSync(file, JSON.stringify(engine.session, null, 2));
  }
}

function describeNext(engine: Engine) {
  const n = engine.next();
  return n.prompt ? describePrompt(n.prompt) : null;
}

const str = (x: string | boolean | undefined) => (typeof x === 'string' ? x : undefined);

/* ------------------------------------------------------------------ */

type Policy = { policy?: Record<string, unknown>; default?: 'first' | 'decline' | 'none'; situation?: Record<string, string | string[]>; respondent?: Session['respondent'] };

function batch(flags: Record<string, string | boolean>) {
  if (typeof flags.answers !== 'string') throw new Error('--answers file required');
  const spec = JSON.parse(readFileSync(flags.answers, 'utf8')) as unknown;
  const mode = (flags.mode as Mode) ?? 'survey';
  let engine: Engine;
  if (Array.isArray(spec)) {
    const s = newSession(bundle, { mode, seed: flags.seed ? Number(flags.seed) : 1 });
    s.log = spec as Session['log'];
    engine = new Engine(bundle, s);
  } else {
    const p = spec as Policy;
    engine = new Engine(bundle, newSession(bundle, { mode, seed: flags.seed ? Number(flags.seed) : 1, respondent: p.respondent }));
    for (const [k, v] of Object.entries(p.situation ?? {})) engine.setSituation(k, v);
    let guard = 0;
    while (guard++ < 2000) {
      const n = engine.next();
      if (!n.prompt) break;
      const pr = n.prompt;
      const pol = p.policy?.[pr.id];
      if (pol && typeof pol === 'object') engine.answer({ node: pr.id, ...(pol as object) });
      else if (typeof pol === 'string') pr.multi ? engine.answer({ node: pr.id, options: [pol] }) : engine.answer({ node: pr.id, option: pol });
      else if (p.default === 'decline') engine.answer({ node: pr.id, affordance: 'decline' });
      else if (p.default === 'none') engine.answer({ node: pr.id, affordance: 'none' });
      else if (pr.allocate) engine.answer({ node: pr.id, alloc: Object.fromEntries(pr.allocate.items.map((it, i) => [it.id, i === 0 ? pr.allocate!.budget : 0])) });
      else if (pr.multi) engine.answer({ node: pr.id, options: [pr.options[0]!.id] });
      else engine.answer({ node: pr.id, option: pr.options[0]!.id });
    }
  }
  if (typeof flags.out === 'string') writeFileSync(flags.out, JSON.stringify(engine.session, null, 2));
  const r = computeResult(bundle, engine.session);
  output(r, (flags.format as string) ?? 'json');
}

function output(r: Result, format: string) {
  if (format === 'reading') stdout.write(readingText(r) + '\n');
  else stdout.write(exportResult(bundle, r, format as ExportFormat).body + '\n');
}

/* ------------------------------------------------------------------ */

async function main() {
  const { flags, pos } = args();
  const cmd = pos[0] ?? 'take';
  if (flags.help || cmd === 'help') return void stdout.write(HELP + '\n');
  if (flags.version) return void stdout.write(bundle.version + '\n');
  switch (cmd) {
    case 'take':
      return interactive(flags);
    case 'jsonl':
      return jsonl(flags);
    case 'blind':
      try {
        return void stdout.write(blind(bundle, pos.slice(1), flags) + '\n');
      } catch (err) {
        stderr.write(`${(err as Error).message}\n`);
        return exit(1);
      }
    case 'batch':
      return batch(flags);
    case 'result': {
      if (!pos[1]) throw new Error('usage: standpoint result <session.json>');
      return output(toResult(pos[1]), (flags.format as string) ?? 'reading');
    }
    case 'compare': {
      if (!pos[1] || !pos[2]) throw new Error('usage: standpoint compare <a.json> <b.json>');
      return void stdout.write(JSON.stringify(compare(bundle, toResult(pos[1]), toResult(pos[2])), null, 2) + '\n');
    }
    case 'diff': {
      if (!pos[1] || !pos[2]) throw new Error('usage: standpoint diff <older.json> <newer.json>');
      return void stdout.write(JSON.stringify(diff(bundle, toResult(pos[1]), toResult(pos[2])), null, 2) + '\n');
    }
    case 'lookup':
      return void stdout.write(JSON.stringify(lookup(bundle, pos[1] ?? ''), null, 2) + '\n');
    case 'search':
      return void stdout.write(JSON.stringify(search(bundle, pos.slice(1).join(' ')), null, 2) + '\n');
    case 'ontology':
      return void stdout.write((flags.format === 'jsonld' ? JSON.stringify(ontologyJsonLd(bundle), null, 2) : ontologyTurtle(bundle)) + '\n');
    default:
      stdout.write(HELP + '\n');
      exit(2);
  }
}

main().catch((e) => {
  stderr.write(`standpoint: ${(e as Error).message}\n`);
  exit(1);
});
