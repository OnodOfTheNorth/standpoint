/**
 * Adaptive selection on the real bundle, across the persona suite: Survey must not send every respondent
 * down the same road, must reach targeted probes, and must stay deterministic.
 */
import { describe, it, expect } from 'vitest';
import type { Bundle } from '@standpoint/content/schema';
import { emptyState } from '../../src/state.js';
import { situationRelevance } from '../../src/relevance.js';
import { realBundle, runPersona, type Persona } from './policy.js';
import { leftPersonas } from './left.js';
import { rightPersonas } from './right.js';
import { otherPersonas } from './other.js';
import { incoherentPersonas } from './incoherent.js';
import { divergentPersonas } from './divergent.js';

const b: Bundle = realBundle();
const ALL: Persona[] = [...leftPersonas, ...rightPersonas, ...otherPersonas, ...incoherentPersonas, ...divergentPersonas];
const runs = new Map(ALL.map((p) => [p.id, runPersona(p, 'survey', b)]));
const state = (id: string) => runs.get(id)!.engine.state;
const probesAnswered = (id: string) => state(id).answers.filter((a) => b.probes.includes(a.node));

describe('selection: first arc', () => {
  it('varies across respondents: at least 8 distinct first arcs, none taken by more than a third', () => {
    const first = new Map<string, number>();
    for (const p of ALL) {
      const a = state(p.id).arcsStarted[0];
      expect(a, `${p.id} started no arc`).toBeDefined();
      first.set(a!, (first.get(a!) ?? 0) + 1);
    }
    expect(first.size, JSON.stringify(Object.fromEntries(first))).toBeGreaterThanOrEqual(8);
    for (const [arc, n] of first) expect(n, `${arc} is first for ${n} of ${ALL.length}`).toBeLessThanOrEqual(Math.ceil(ALL.length / 3));
  });

  it('follows the Situation: a landlord is matched to the landlord arc, a devout Hindu to the temple arc', () => {
    const s = emptyState({ mode: 'survey', respondent: { kind: 'human' }, seed: 1 });
    s.situation = { income: 'rent', housing: 'landlord', assets: ['property-many'] };
    expect(situationRelevance(s, 'arc.rentstrike')).toBe(1);
    expect(situationRelevance(s, 'arc.dock')).toBe(0);
    s.situation = { religion: 'hindu', caste: 'dominant', place: 'rural' };
    expect(situationRelevance(s, 'arc.temple')).toBe(1);
    expect(situationRelevance(s, 'arc.parish')).toBe(0);
  });

  it('is deterministic: the same answers give the same journey', () => {
    for (const p of [ALL[0]!, ALL[ALL.length - 1]!]) {
      const again = runPersona(p, 'survey', b).engine.state.answers.map((a) => a.node);
      expect(again).toEqual(state(p.id).answers.map((a) => a.node));
    }
  });
});

describe('selection: targeted probes in Survey', () => {
  it('every Survey run reaches standalone probes (three targeted slots)', () => {
    for (const p of ALL) expect(probesAnswered(p.id).length, p.id).toBeGreaterThanOrEqual(2);
    const mean = ALL.reduce((a, p) => a + probesAnswered(p.id).length, 0) / ALL.length;
    expect(mean).toBeGreaterThanOrEqual(2.5);
  });

  it('the probes are not the same three for everyone', () => {
    const distinct = new Set(ALL.flatMap((p) => probesAnswered(p.id).map((a) => a.node)));
    expect(distinct.size).toBeGreaterThanOrEqual(30);
  });

  it('Survey stays close to its budget', () => {
    for (const p of ALL) expect(state(p.id).decisions, p.id).toBeLessThanOrEqual(55);
  });
});
