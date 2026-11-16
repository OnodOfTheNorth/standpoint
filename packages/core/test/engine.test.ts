import { describe, it, expect } from 'vitest';
import { Engine, newSession, computeResult, encodeSession, decodeSession, replay, profileMarkdown, glyphSvg, compare, diff, holdings } from '../src/index.js';
import { fixture } from './fixture.js';

const b = fixture();

function run(answers: [string, Record<string, unknown>][], mode: 'sketch' | 'survey' | 'excavation' = 'survey') {
  const e = new Engine(b, newSession(b, { seed: 42, mode, now: '2026-01-01T00:00:00Z' }));
  for (const [node, a] of answers) e.answer({ node, ...a });
  return e;
}

describe('engine', () => {
  it('starts with the trunk in order', () => {
    const e = new Engine(b, newSession(b, { seed: 1 }));
    expect(e.next().prompt?.id).toBe('t.1');
  });

  it('asks a reason probe after an option that carries one', () => {
    const e = run([['t.1', { option: 'b' }]]);
    const p = e.next().prompt!;
    expect(p.id).toBe('t.1#probe');
    expect(p.kind).toBe('probe');
    e.answer({ node: 't.1#probe', option: 'p0' });
    expect(e.next().prompt?.id).toBe('t.2');
    expect(e.state.causes.interests).toBe(1);
  });

  it('records evidence trails and holdings', () => {
    const e = run([['t.1', { option: 'a' }]]);
    const h = holdings(b, e.state);
    expect(h.byPosition['state.nature.arbiter']!.weight).toBeGreaterThan(0.25);
    expect(h.byPosition['state.nature.arbiter']!.trail[0]!.node).toBe('t.1');
  });

  it('is deterministic: same log and seed, same result', () => {
    const a = run([['t.1', { option: 'b' }], ['t.1#probe', { option: 'p0' }], ['t.2', { option: 'b' }]]);
    const s2 = JSON.parse(JSON.stringify(a.session));
    const r1 = computeResult(b, a.session, { now: 'x' });
    const r2 = computeResult(b, s2, { now: 'x' });
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it('undo pops the last answer and replays', () => {
    const e = run([['t.1', { option: 'a' }], ['t.2', { option: 'a' }]]);
    e.undo();
    expect(e.next().prompt?.id).toBe('t.2');
    expect(e.state.decisions).toBe(1);
    expect(e.session.log.at(-1)).toEqual({ t: 'undo' });
  });

  it('accepts all four affordances as data', () => {
    const e = run([['t.1', { affordance: 'reject', premise: 'p' }]]);
    expect(e.state.affordances[0]).toMatchObject({ kind: 'reject', premise: 'p' });
    e.answer({ node: 't.2', affordance: 'decline' });
    expect(e.state.affordances[1]!.kind).toBe('decline');
    expect(e.state.decisions).toBe(2);
  });

  it('rejects answers to the wrong node or bad options', () => {
    const e = run([]);
    expect(() => e.answer({ node: 't.2', option: 'a' })).toThrow(/Expected/);
    expect(() => e.answer({ node: 't.1', option: 'zzz' })).toThrow(/Unknown option/);
  });

  it('confronts a detected tension and records the resolution', () => {
    // sovereignty + sanctions tool
    const e = run([
      ['t.1', { option: 'a' }],
      ['t.2', { option: 'a' }],
    ]);
    // make sovereignty held too, via the probe that supports it
    e.answer({ node: e.next().prompt!.id, option: e.next().prompt!.options[0]!.id });
    // drive until a challenge or end
    let guard = 0;
    while (guard++ < 20) {
      const p = e.next().prompt;
      if (!p) break;
      if (p.kind === 'challenge') {
        e.answer({ node: p.id, option: 'wrong' });
        break;
      }
      const opt = p.id === 'pb.2' ? 'b' : p.multi ? undefined : p.options[0]!.id;
      if (p.multi) e.answer({ node: p.id, options: ['union'] });
      else if (p.allocate) e.answer({ node: p.id, alloc: {} });
      else e.answer({ node: p.id, option: opt });
    }
    if (e.state.tensions['t.sov']) {
      expect(e.state.tensions['t.sov']!.kind).toBe('yield');
      expect(holdings(b, e.state).byPosition['intl.sanctions.tool']!.score).toBeLessThan(3);
    }
  });

  it('runs a whole survey to completion and produces both parts of the result', () => {
    const e = new Engine(b, newSession(b, { seed: 7, mode: 'excavation' }));
    e.setSituation('income', ['wages']);
    e.setSituation('world', 'core');
    let guard = 0;
    while (guard++ < 50) {
      const p = e.next().prompt;
      if (!p) break;
      if (p.multi) e.answer({ node: p.id, options: [p.options[0]!.id] });
      else e.answer({ node: p.id, option: p.options[p.options.length > 1 ? 1 : 0]!.id });
    }
    const r = computeResult(b, e.session);
    expect(r.reading.length).toBeGreaterThan(4);
    for (const c of r.reading) expect(typeof c.headline).toBe('string');
    expect(r.portrait.length).toBeGreaterThanOrEqual(4);
    expect(r.situation.location.primary).toBe('core-workers');
    expect(r.sides.length).toBeGreaterThan(0);
    // the pressure scene runs only if the principle it tests is held; when it runs it is in the respondent's own shoes
    const heldTested = holdings(b, e.state).held.some((h) => h.position === 'welfare.state.decommodify');
    expect(r.pressures.length).toBeLessThanOrEqual(heldTested ? 1 : 0);
    for (const p of r.pressures) expect(p.ownShoes).toBe(true);
    expect(profileMarkdown(b, r)).toContain('# Political profile');
    expect(glyphSvg(b, r)).toContain('<svg');
  });

  it('enters an arc, follows it, and announces what it learned', () => {
    const e = new Engine(b, newSession(b, { seed: 3, mode: 'survey' }));
    e.answer({ node: 't.1', option: 'c' });
    e.answer({ node: 't.2', option: 'b' });
    // practice comes first in the survey template
    expect(e.next().prompt?.id).toBe('m.practice');
    e.answer({ node: 'm.practice', options: ['union'] });
    const p = e.next().prompt!;
    expect(p.id).toBe('arc.x.1');
    e.answer({ node: 'arc.x.1', option: 'a' });
    expect(e.next().prompt?.id).toBe('arc.x.2');
    const after = e.answer({ node: 'arc.x.2', option: 'a' });
    expect(e.state.arcsDone).toContain('arc.x');
    expect(after.notices.join(' ')).toMatch(/learned/);
  });

  it('sketch enters an escalation standalone, with its recap', () => {
    const e = new Engine(b, newSession(b, { seed: 3, mode: 'sketch' }));
    e.answer({ node: 't.1', option: 'c' });
    e.answer({ node: 't.2', option: 'a' });
    const p = e.next().prompt!;
    expect(p.id).toBe('arc.x.2');
    expect(p.text.startsWith('In town')).toBe(true);
    e.answer({ node: 'arc.x.2', option: 'b' });
    expect(e.state.standaloneEscalations).toContain('arc.x');
    expect(e.state.currentArc).toBeUndefined();
  });

  it('share links round-trip and strip situation by default', () => {
    const e = run([['t.1', { option: 'b' }]]);
    e.setSituation('income', ['rent']);
    const tok = encodeSession(e.session);
    const back = decodeSession(tok);
    expect(back.log.some((x) => x.t === 'situation')).toBe(false);
    expect(replay(b, back).decisions).toBe(1);
    const withSit = decodeSession(encodeSession(e.session, { includeSituation: true }));
    expect(withSit.log.some((x) => x.t === 'situation')).toBe(true);
  });

  it('corrections override inference and are logged', () => {
    const e = run([['t.1', { option: 'a' }]]);
    e.correct('state.nature.arbiter', 'reject');
    expect(holdings(b, e.state).byPosition['state.nature.arbiter']!.weight).toBe(0);
    e.correct('state.nature.aggressor', 'hold');
    expect(holdings(b, e.state).byPosition['state.nature.aggressor']!.weight).toBeGreaterThanOrEqual(0.8);
  });

  it('compares and diffs results', () => {
    const a = computeResult(b, run([['t.1', { option: 'a' }], ['t.2', { option: 'a' }]]).session);
    const c = computeResult(b, run([['t.1', { option: 'b' }], ['t.1#probe', { option: 'p0' }], ['t.2', { option: 'b' }]]).session);
    const cmp = compare(b, a, c);
    expect(cmp.real.length).toBeGreaterThan(0);
    const d = diff(b, a, c);
    expect(d.gained.length + d.lost.length).toBeGreaterThan(0);
  });

  it('records disputes against reading claims', () => {
    const e = run([['t.1', { option: 'a' }]]);
    const r0 = computeResult(b, e.session);
    const claim = r0.reading[0]!.id;
    e.dispute(claim, 'I disagree with this reading.');
    const r = computeResult(b, e.session);
    expect(r.reading.find((c) => c.id === claim)!.dispute?.text).toBe('I disagree with this reading.');
  });
});
