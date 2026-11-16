/**
 * Blind stepping mode for validation runs (phase 2 brief, section 1).
 *
 * A thin, one-step-per-call layer over the JSON-lines protocol. It shows a respondent
 * exactly what a person sees in the web app (Situation questions, prompt text, voices,
 * cases, options, notices) and nothing else: no node ids, no option ids, no evidence,
 * no "why" after an answer, no lookup or search. Options are lettered a, b, c...; premises
 * p1, p2...; conditions c1, c2... The run file keeps the full session log, so a finished
 * run is a fixture that replays deterministically with `new Engine(bundle, run.session)`.
 *
 *   standpoint blind start <run.json> [--mode survey] [--seed n]
 *   standpoint blind show <run.json>
 *   standpoint blind answer <run.json> <letter> | --multi a,c | --alloc a=2,b=3
 *       | --reject p1|other --text "..." | --depends c1 | --none "..." | --decline | --skip
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import type { Bundle } from '@standpoint/content/schema';
import { Engine, newSession, type Mode, type Prompt, type Session } from '@standpoint/core';

interface Run {
  format: 'standpoint.blind-run';
  createdAt: string;
  situationIndex: number; // next Situation field to ask; -1 when the Situation step is over
  steps: number;
  session: Session;
}

const L = 'abcdefghijklmnopqrstuvwxyz';
const letter = (i: number) => L[i] ?? `z${i}`;

function fields(b: Bundle) {
  return b.situation.filter((f) => f.for === 'both' || f.for === 'human');
}

function load(file: string): Run {
  return JSON.parse(readFileSync(file, 'utf8')) as Run;
}
function save(file: string, r: Run) {
  writeFileSync(file, JSON.stringify(r, null, 2));
}

function renderPrompt(p: Prompt, notices: string[]): string {
  const out: string[] = [];
  for (const n of notices) out.push(`(${n})`, '');
  const c = p.context;
  const where = [c.arc ? `${c.arc.title}: ${c.arc.role}, ${c.arc.place}` : '', c.descent ? c.descent.title : ''].filter(Boolean).join(' / ');
  out.push(`Decision ${c.decisions + 1}${c.target ? ` of about ${c.target}` : ''}${where ? `  [${where}]` : ''}`);
  if (p.title) out.push(p.title.toUpperCase());
  out.push(p.text);
  if (p.voices?.length) {
    out.push('', 'Voices:');
    for (const v of p.voices) out.push(`  ${v.name}: "${v.says}"`);
  }
  if (p.cases?.length) {
    out.push('', 'Cases:');
    for (const k of p.cases) out.push(`  - ${k}`);
  }
  out.push('');
  if (p.allocate) {
    out.push(`Divide ${p.allocate.budget} ${p.allocate.unit} among:`);
    p.allocate.items.forEach((it, i) => out.push(`  ${letter(i)}) ${it.text}`));
    out.push('', `Answer: blind answer <run> --alloc a=1,b=2,... (must sum to ${p.allocate.budget})`);
  } else {
    out.push(p.multi ? 'Options (pick one or more):' : 'Options:');
    p.options.forEach((o, i) => out.push(`  ${letter(i)}) ${o.text}`));
    out.push('', p.multi ? 'Answer: blind answer <run> --multi a,c' : 'Answer: blind answer <run> <letter>');
  }
  const extra: string[] = [];
  if (p.premises.length) extra.push(`reject a premise: --reject p1..p${p.premises.length} or --reject other, with --text "why"`);
  if (p.conditions.length) extra.push(`"it depends": --depends c1..c${p.conditions.length}`);
  extra.push('"none of these": --none "what you would say instead"', '--decline');
  if (p.premises.length) {
    out.push('', 'Premises you can reject:');
    p.premises.forEach((x, i) => out.push(`  p${i + 1}) ${x.text}`));
  }
  if (p.conditions.length) {
    out.push('', 'It depends on:');
    p.conditions.forEach((x, i) => out.push(`  c${i + 1}) ${x.text}`));
  }
  out.push('', `Other answers: ${extra.join('; ')}`);
  return out.join('\n');
}

function show(b: Bundle, r: Run): string {
  if (r.situationIndex >= 0) {
    const fs = fields(b);
    const f = fs[r.situationIndex];
    if (f) {
      const out = [`ABOUT YOU (${r.situationIndex + 1} of ${fs.length}; optional)`, f.question, ''];
      f.options.forEach((o, i) => out.push(`  ${letter(i)}) ${o.text}`));
      out.push('', f.multi ? 'Answer: blind answer <run> --multi a,c  (or --skip)' : 'Answer: blind answer <run> <letter>  (or --skip)');
      return out.join('\n');
    }
  }
  const e = new Engine(b, r.session);
  const n = e.next();
  if (!n.prompt) return `${n.notices.map((x) => `(${x})`).join('\n')}\nThe journey is complete (${n.reason}). ${e.state.decisions} decisions.`;
  return renderPrompt(n.prompt, n.notices);
}

function pick(letters: string, n: number): number[] {
  const idx = letters.split(',').map((s) => L.indexOf(s.trim().toLowerCase()));
  for (const i of idx) if (i < 0 || i >= n) throw new Error(`No option "${letters}". Use the letters shown.`);
  return idx;
}

function answer(b: Bundle, r: Run, pos: string[], flags: Record<string, string | boolean>) {
  if (r.situationIndex >= 0) {
    const fs = fields(b);
    const f = fs[r.situationIndex]!;
    const e = new Engine(b, r.session);
    if (!flags.skip) {
      const raw = typeof flags.multi === 'string' ? flags.multi : pos[0];
      if (!raw) throw new Error('Give a letter, --multi a,c, or --skip.');
      const ids = pick(raw, f.options.length).map((i) => f.options[i]!.id);
      e.setSituation(f.id, f.multi ? ids : ids[0]!);
    }
    r.situationIndex++;
    if (r.situationIndex >= fs.length) {
      r.situationIndex = -1;
      if (!Object.keys(e.state.situation ?? {}).length) e.skipSituation();
    }
    r.session = e.session;
    return;
  }
  const e = new Engine(b, r.session);
  const n = e.next();
  if (!n.prompt) throw new Error('The journey is complete.');
  const p = n.prompt;
  const node = p.id;
  if (flags.decline) e.answer({ node, affordance: 'decline' });
  else if (typeof flags.none === 'string') e.answer({ node, affordance: 'none', text: flags.none });
  else if (typeof flags.depends === 'string') {
    const i = Number(flags.depends.replace(/^c/i, '')) - 1;
    const c = p.conditions[i];
    if (!c) throw new Error(`No condition ${flags.depends}.`);
    e.answer({ node, affordance: 'depends', condition: c.id });
  } else if (typeof flags.reject === 'string') {
    const premise = flags.reject === 'other' ? 'other' : p.premises[Number(flags.reject.replace(/^p/i, '')) - 1]?.id;
    if (!premise) throw new Error(`No premise ${flags.reject}.`);
    e.answer({ node, affordance: 'reject', premise, text: typeof flags.text === 'string' ? flags.text : undefined });
  } else if (typeof flags.alloc === 'string' && p.allocate) {
    const alloc: Record<string, number> = {};
    for (const part of flags.alloc.split(',')) {
      const [k, v] = part.split('=');
      const i = pick(k!, p.allocate.items.length)[0]!;
      alloc[p.allocate.items[i]!.id] = Number(v);
    }
    e.answer({ node, alloc });
  } else if (typeof flags.multi === 'string') {
    e.answer({ node, options: pick(flags.multi, p.options.length).map((i) => p.options[i]!.id) });
  } else if (pos[0]) {
    const i = pick(pos[0], p.options.length)[0]!;
    if (p.multi) e.answer({ node, options: [p.options[i]!.id] });
    else e.answer({ node, option: p.options[i]!.id });
  } else throw new Error('Give an answer: a letter, --multi, --alloc, --reject, --depends, --none or --decline.');
  r.session = e.session;
}

export function blind(b: Bundle, pos: string[], flags: Record<string, string | boolean>): string {
  const [sub, file, ...rest] = pos;
  if (!file) throw new Error('Usage: standpoint blind start|show|answer <run.json> ...');
  if (sub === 'start') {
    if (existsSync(file) && !flags.force) throw new Error(`${file} exists; use --force to overwrite.`);
    const r: Run = {
      format: 'standpoint.blind-run',
      createdAt: new Date().toISOString(),
      situationIndex: 0,
      steps: 0,
      session: newSession(b, { mode: (flags.mode as Mode) ?? 'survey', seed: flags.seed ? Number(flags.seed) : 1, now: new Date().toISOString(), respondent: { kind: 'human' } }),
    };
    save(file, r);
    return show(b, r);
  }
  const r = load(file);
  if (sub === 'show') return show(b, r);
  if (sub === 'answer') {
    answer(b, r, rest, flags);
    r.steps++;
    save(file, r);
    return show(b, r);
  }
  throw new Error(`Unknown blind command ${sub}.`);
}
