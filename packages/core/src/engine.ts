/**
 * Engine facade. Pure: no DOM, no network, no clock unless you pass one.
 */
import type { Bundle } from '@standpoint/content/schema';
import type { AnswerEvent, LogEvent, Mode, Prompt, Respondent, Session, State } from './types.js';
import { apply, effectiveLog, replay, nodeEvidence } from './state.js';
import { nextPrompt, promptById, type NextStep } from './select.js';
import { hash32, newId } from './rng.js';
import { holdings } from './holdings.js';

export interface NewSessionOptions {
  mode?: Mode;
  seed?: number;
  respondent?: Respondent;
  now?: string;
  id?: string;
}

export function newSession(b: Bundle, o: NewSessionOptions = {}): Session {
  const seed = o.seed ?? Math.floor(Math.random() * 2 ** 31);
  return {
    format: 'standpoint.session',
    formatVersion: 1,
    id: o.id ?? newId(seed),
    created: o.now ?? new Date(0).toISOString(),
    seed,
    mode: o.mode ?? 'survey',
    contentVersion: b.version,
    respondent: o.respondent ?? { kind: 'human' },
    log: [],
  };
}

export class Engine {
  readonly bundle: Bundle;
  session: Session;
  private _state: State;

  constructor(bundle: Bundle, session?: Session) {
    this.bundle = bundle;
    this.session = session ? migrate(bundle, session) : newSession(bundle);
    this._state = replay(bundle, this.session);
  }

  get state(): State {
    return this._state;
  }

  private push(ev: LogEvent) {
    this.session.log.push(ev);
    if (ev.t === 'undo') this._state = replay(this.bundle, this.session);
    else apply(this.bundle, this._state, ev);
  }

  next(): NextStep {
    return nextPrompt(this.bundle, this._state);
  }

  /** Validate and record an answer to the current prompt. */
  answer(a: Omit<AnswerEvent, 't'>): NextStep {
    const cur = this.next();
    if (!cur.prompt) throw new EngineError('no-prompt', 'The journey is complete; nothing to answer. Change mode or request a descent to continue.');
    if (a.node !== cur.prompt.id) throw new EngineError('wrong-node', `Expected an answer to "${cur.prompt.id}", got "${a.node}".`);
    validateAnswer(cur.prompt, a);
    this.push({ t: 'answer', ...a });
    return this.next();
  }

  undo(): NextStep {
    if (!effectiveLog(this.session.log).some((e) => e.t === 'answer')) throw new EngineError('nothing-to-undo', 'Nothing to undo.');
    this.push({ t: 'undo' });
    return this.next();
  }

  setSituation(field: string, value: string | string[] | null) {
    this.push({ t: 'situation', field, value });
  }
  skipSituation() {
    this.push({ t: 'skip-situation' });
  }
  correct(position: string, stance: 'hold' | 'reject' | 'clear') {
    if (!this.bundle.positions[position]) throw new EngineError('unknown-position', `Unknown position ${position}`);
    this.push({ t: 'correct', position, stance });
  }
  dispute(claim: string, text: string) {
    this.push({ t: 'dispute', claim, text });
  }
  setMode(mode: Mode) {
    this.session.mode = mode;
    this.push({ t: 'mode', mode });
  }
  descend(descent: string) {
    if (!this.bundle.descents[descent]) throw new EngineError('unknown-descent', `Unknown descent ${descent}`);
    this.push({ t: 'descend', descent });
  }
  note(key: string, text: string) {
    this.push({ t: 'note', key, text });
  }

  /** "Why was I asked this": what a node probes. */
  explain(id: string) {
    return explainNode(this.bundle, this._state, id);
  }

  prompt(id: string): Prompt | null {
    return promptById(this.bundle, this._state, id);
  }
}

export class EngineError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

function validateAnswer(p: Prompt, a: Omit<AnswerEvent, 't'>) {
  if (a.affordance) {
    if (!['reject', 'depends', 'none', 'decline'].includes(a.affordance)) throw new EngineError('bad-affordance', `Unknown affordance ${a.affordance}`);
    if (a.affordance === 'reject' && a.premise && p.premises.length && !p.premises.some((x) => x.id === a.premise) && a.premise !== 'other')
      throw new EngineError('bad-premise', `Unknown premise ${a.premise}. Options: ${p.premises.map((x) => x.id).join(', ')}, other`);
    if (a.affordance === 'depends' && a.condition && p.conditions.length && !p.conditions.some((x) => x.id === a.condition) && a.condition !== 'other')
      throw new EngineError('bad-condition', `Unknown condition ${a.condition}. Options: ${p.conditions.map((x) => x.id).join(', ')}, other`);
    return;
  }
  if (p.allocate) {
    if (!a.alloc) throw new EngineError('need-alloc', `This node is an allocation: send "alloc" mapping item ids to amounts summing to ${p.allocate.budget}.`);
    const sum = Object.values(a.alloc).reduce((x, y) => x + y, 0);
    for (const k of Object.keys(a.alloc)) if (!p.allocate.items.some((i) => i.id === k)) throw new EngineError('bad-alloc', `Unknown item ${k}`);
    if (Object.values(a.alloc).some((v) => v < 0 || !Number.isFinite(v))) throw new EngineError('bad-alloc', 'Amounts must be non-negative numbers.');
    if (Math.abs(sum - p.allocate.budget) > 1e-9) throw new EngineError('bad-alloc', `Amounts must sum to ${p.allocate.budget}; got ${sum}.`);
    return;
  }
  if (p.multi) {
    const ids = a.options ?? (a.option ? [a.option] : []);
    if (!ids.length) throw new EngineError('need-option', 'Choose one or more options.');
    for (const id of ids) if (!p.options.some((o) => o.id === id)) throw new EngineError('bad-option', `Unknown option ${id}`);
    return;
  }
  if (!a.option) throw new EngineError('need-option', `Choose an option: ${p.options.map((o) => o.id).join(', ')}; or an affordance.`);
  if (!p.options.some((o) => o.id === a.option)) throw new EngineError('bad-option', `Unknown option ${a.option}. Options: ${p.options.map((o) => o.id).join(', ')}`);
}

export function explainNode(b: Bundle, s: State, id: string) {
  const base = id.replace(/#probe$/, '');
  if (base.startsWith('challenge:')) {
    const t = b.tensions[base.slice(10)];
    return t ? { id, why: t.explain, probes: t.between.map((x) => b.positions[x]?.label ?? x), problematics: [] as string[] } : null;
  }
  if (base.startsWith('origin:')) {
    return { id, why: 'For each load-bearing commitment the instrument asks where it came from: lived experience, or an idea received from family, school, media, church, books or an organization.', probes: [b.positions[base.slice(7)]?.label ?? ''], problematics: [] as string[] };
  }
  const n = b.nodes[base];
  if (!n) return null;
  const probs = new Set<string>();
  for (const e of nodeEvidence(n)) {
    const p = b.positions[e.position];
    if (p) probs.add(p.problematic);
  }
  const h = holdings(b, s);
  return {
    id,
    why: n.why,
    problematics: [...probs],
    probes: [...probs].map((p) => `${b.problematics[p]!.question} (fog ${(h.byProblematic[p]?.fog ?? 1).toFixed(2)})`),
  };
}

/** Bring a session from an older content version forward. Answers to removed nodes are dropped at replay and reported. */
export function migrate(b: Bundle, session: Session): Session {
  if (session.format !== 'standpoint.session') throw new EngineError('bad-session', 'Not a Standpoint session document.');
  if (session.formatVersion !== 1) throw new EngineError('bad-session', `Unsupported session format version ${session.formatVersion}.`);
  return { ...session, log: [...session.log], contentVersion: b.version, respondent: { ...session.respondent } };
}

export function sessionFingerprint(session: Session): string {
  return hash32(JSON.stringify(session.log), session.seed).toString(36);
}
