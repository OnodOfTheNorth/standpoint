/**
 * The agent protocol: operations shared by the CLI's JSON-lines mode, the MCP
 * server and the library API. Pure functions over an Engine.
 */
import type { Bundle } from '@standpoint/content/schema';
import { Engine, EngineError } from './engine.js';
import type { AnswerEvent, Mode, Prompt } from './types.js';
import { computeResult } from './result.js';
import { holdings } from './holdings.js';
import { liveTensions } from './structure.js';
import { coverage } from './result.js';

export type Op =
  | { op: 'next' }
  | ({ op: 'answer' } & Omit<AnswerEvent, 't' | 'node'> & { node?: string })
  | { op: 'undo' }
  | { op: 'state' }
  | { op: 'result'; sections?: string[] }
  | { op: 'explain'; id?: string }
  | { op: 'situation'; field: string; value: string | string[] | null }
  | { op: 'situation-fields' }
  | { op: 'skip-situation' }
  | { op: 'mode'; mode: Mode }
  | { op: 'descend'; descent?: string }
  | { op: 'correct'; position: string; stance: 'hold' | 'reject' | 'clear' }
  | { op: 'dispute'; claim: string; text: string }
  | { op: 'session' }
  | { op: 'lookup'; id: string }
  | { op: 'search'; q: string; limit?: number };

/** A prompt rendered for agents: everything needed to answer without the UI. */
export function describePrompt(p: Prompt) {
  return {
    id: p.id,
    kind: p.kind,
    type: p.type,
    title: p.title,
    text: p.text,
    voices: p.voices,
    cases: p.cases,
    allocate: p.allocate,
    multi: p.multi ?? false,
    options: p.options,
    premises: p.premises,
    conditions: p.conditions,
    affordances: ['reject', 'depends', 'none', 'decline'],
    context: p.context,
    how: p.allocate
      ? `answer with {"op":"answer","alloc":{${p.allocate.items.map((i) => `"${i.id}":n`).join(',')}}} summing to ${p.allocate.budget}`
      : p.multi
        ? 'answer with {"op":"answer","options":["id",...]}'
        : 'answer with {"op":"answer","option":"id"}; or {"op":"answer","affordance":"reject","premise":"id|other","text":"..."}, "depends"+"condition", "none"+"text", or "decline"',
  };
}

export function stateSummary(b: Bundle, e: Engine) {
  const s = e.state;
  const h = holdings(b, s);
  return {
    mode: s.mode,
    decisions: s.decisions,
    coverage: coverage(b, s),
    topHoldings: h.held.slice(0, 12).map((x) => ({ position: x.position, label: b.positions[x.position]!.label, weight: Math.round(x.weight * 100) / 100 })),
    liveTensions: liveTensions(b, s).map((t) => ({ rule: t.rule, principal: t.principal, explain: b.tensions[t.rule]!.explain })),
    arcsDone: s.arcsDone,
    descentsAvailable: Object.values(b.descents).map((d) => ({ id: d.id, title: d.title, done: s.descentsDone.includes(d.id) })),
  };
}

export function lookup(b: Bundle, id: string) {
  if (b.positions[id]) return { kind: 'position', ...b.positions[id] };
  if (b.problematics[id]) return { kind: 'problematic', ...b.problematics[id], positions: b.problematics[id]!.positions.map((p) => ({ id: p, label: b.positions[p]!.label, claim: b.positions[p]!.claim })) };
  if (b.traditions[id]) return { kind: 'tradition', ...b.traditions[id] };
  if (b.thinkers[id]) return { kind: 'thinker', ...b.thinkers[id] };
  if (b.events[id]) return { kind: 'event', ...b.events[id] };
  if (b.debates[id]) return { kind: 'debate', ...b.debates[id] };
  if (b.tensions[id]) return { kind: 'tension', ...b.tensions[id] };
  if (b.nodes[id]) return { kind: 'node', ...b.nodes[id] };
  if (b.arcs[id]) return { kind: 'arc', ...b.arcs[id] };
  if (b.descents[id]) return { kind: 'descent', ...b.descents[id] };
  return null;
}

export function search(b: Bundle, q: string, limit = 20) {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hits: { kind: string; id: string; label: string; score: number }[] = [];
  const consider = (kind: string, id: string, label: string, text: string) => {
    const hay = `${id} ${label} ${text}`.toLowerCase();
    let score = 0;
    for (const t of terms) {
      if (!hay.includes(t)) return;
      score += (label.toLowerCase().includes(t) ? 3 : 0) + (id.includes(t) ? 2 : 0) + 1;
    }
    hits.push({ kind, id, label, score });
  };
  for (const p of Object.values(b.problematics)) consider('problematic', p.id, p.question, p.plain);
  for (const p of Object.values(b.positions)) consider('position', p.id, p.label, `${p.claim} ${p.voiced}`);
  for (const t of Object.values(b.traditions)) consider('tradition', t.id, t.name, t.self);
  for (const t of Object.values(b.thinkers)) consider('thinker', t.id, t.name, t.summary);
  for (const e of Object.values(b.events)) consider('event', e.id, e.name, e.summary);
  for (const d of Object.values(b.debates)) consider('debate', d.id, d.name, d.summary);
  return hits.sort((a, z) => z.score - a.score || a.id.localeCompare(z.id)).slice(0, limit);
}

export function handle(b: Bundle, e: Engine, op: Op): Record<string, unknown> {
  try {
    switch (op.op) {
      case 'next': {
        const n = e.next();
        return n.prompt ? { ok: true, prompt: describePrompt(n.prompt), notices: n.notices } : { ok: true, prompt: null, done: true, reason: (n as { reason: string }).reason, notices: n.notices, hint: 'Ask for {"op":"result"}, switch {"op":"mode","mode":"excavation"}, or {"op":"descend"} to list descents.' };
      }
      case 'answer': {
        const cur = e.next();
        if (!cur.prompt) throw new EngineError('no-prompt', 'Nothing to answer.');
        const { op: _o, node, ...rest } = op;
        const n = e.answer({ node: node ?? cur.prompt.id, ...rest });
        const explain = e.explain(node ?? cur.prompt.id);
        return { ok: true, answered: node ?? cur.prompt.id, why: explain?.why, prompt: n.prompt ? describePrompt(n.prompt) : null, notices: n.notices, done: !n.prompt };
      }
      case 'undo': {
        const n = e.undo();
        return { ok: true, prompt: n.prompt ? describePrompt(n.prompt) : null };
      }
      case 'state':
        return { ok: true, state: stateSummary(b, e) };
      case 'result': {
        const r = computeResult(b, e.session);
        if (op.sections?.length) {
          const pick: Record<string, unknown> = {};
          for (const k of op.sections) pick[k] = (r as unknown as Record<string, unknown>)[k];
          return { ok: true, result: pick };
        }
        return { ok: true, result: r };
      }
      case 'explain': {
        const id = op.id ?? e.session.log.filter((x) => x.t === 'answer').at(-1)?.['node' as never];
        if (!id) throw new EngineError('no-id', 'Nothing to explain yet.');
        return { ok: true, explain: e.explain(String(id)) };
      }
      case 'situation-fields':
        return { ok: true, fields: b.situation.filter((f) => f.for === 'both' || f.for === e.state.respondent.kind) };
      case 'situation': {
        const f = b.situation.find((x) => x.id === op.field);
        if (!f) throw new EngineError('unknown-field', `Unknown situation field ${op.field}. Use {"op":"situation-fields"}.`);
        const vals = op.value === null ? [] : Array.isArray(op.value) ? op.value : [op.value];
        for (const v of vals) if (!f.options.some((o) => o.id === v)) throw new EngineError('bad-value', `Unknown value ${v} for ${op.field}. Options: ${f.options.map((o) => o.id).join(', ')}`);
        e.setSituation(op.field, f.multi ? vals : (vals[0] ?? null));
        return { ok: true };
      }
      case 'skip-situation':
        e.skipSituation();
        return { ok: true };
      case 'mode':
        e.setMode(op.mode);
        return { ok: true, mode: op.mode };
      case 'descend': {
        if (!op.descent) return { ok: true, descents: Object.values(b.descents).map((d) => ({ id: d.id, title: d.title, blurb: d.blurb, done: e.state.descentsDone.includes(d.id) })) };
        e.descend(op.descent);
        return { ok: true, descent: op.descent };
      }
      case 'correct':
        e.correct(op.position, op.stance);
        return { ok: true };
      case 'dispute':
        e.dispute(op.claim, op.text);
        return { ok: true };
      case 'session':
        return { ok: true, session: e.session };
      case 'lookup': {
        const x = lookup(b, op.id);
        return x ? { ok: true, item: x } : { ok: false, error: `Nothing with id ${op.id}` };
      }
      case 'search':
        return { ok: true, hits: search(b, op.q, op.limit) };
      default:
        return { ok: false, error: `Unknown op ${(op as { op: string }).op}` };
    }
  } catch (err) {
    const ee = err as EngineError;
    return { ok: false, error: ee.message, code: ee.code ?? 'error' };
  }
}
