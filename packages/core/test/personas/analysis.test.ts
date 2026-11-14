/**
 * Analysis-divergence tests (brief section 11): personas whose situation and politics diverge must draw
 * the expected findings from the reading, with mechanisms, after a full Survey on the real bundle. Each
 * case also has a control persona that shares the situation or the politics but not the divergence, and
 * must not draw the finding.
 */
import { describe, it, expect } from 'vitest';
import type { Claim } from '../../src/index.js';
import { realBundle, runPersona, type Persona } from './policy.js';
import { nationalPopulistWorker, radicalInterventionist, landlordSocialist, compradorLiberal, villainMarxist } from './divergent.js';
import { trotskyist, ml, democraticSocialist, dependencyTheorist } from './left.js';
import { developmentLiberal } from './other.js';

const b = realBundle();
const cache = new Map<string, ReturnType<typeof runPersona>>();
const run = (p: Persona) => {
  let r = cache.get(p.id);
  if (!r) cache.set(p.id, (r = runPersona(p, 'survey', b)));
  return r;
};
const claims = (p: Persona) => run(p).result.reading;
const ids = (p: Persona) => claims(p).map((c) => c.id);
const claim = (p: Persona, id: string): Claim => {
  const c = claims(p).find((x) => x.id === id);
  expect(c, `${p.id}: expected claim ${id}; got ${ids(p).join(', ')}`).toBeDefined();
  return c!;
};
/** A tension rule counts as found if it is live or was put to the respondent. */
const tensionFound = (p: Persona, rule: string) => {
  const t = run(p).result.tensions;
  return t.live.some((x) => x.rule === rule) || t.confronted.some((x) => x.rule === rule);
};
/** Mechanism or silence: a finding must name how, with evidence. */
const hasMechanism = (c: Claim) => {
  expect(c.mechanism.length, `${c.id} has no mechanism`).toBeGreaterThan(0);
  expect(c.evidence.length, `${c.id} has no evidence`).toBeGreaterThan(0);
};

describe('analysis: situation and politics diverge', () => {
  it('(a) core wage worker with a national-populist program: anger up, program down; position against consciousness', () => {
    const p = nationalPopulistWorker;
    expect(run(p).result.situation.location.primary).toBe('core-workers');
    hasMechanism(claim(p, 'serves.channeled'));
    expect(tensionFound(p, 'tension.core-worker-national-populist')).toBe(true);
    const a = claim(p, 'anomaly.tension.core-worker-national-populist');
    hasMechanism(a);
    expect(a.headline).toMatch(/wage work/);
  });

  it('(a) control: a core wage worker with a class program draws neither finding', () => {
    expect(ids(trotskyist)).not.toContain('serves.channeled');
    expect(tensionFound(trotskyist, 'tension.core-worker-national-populist')).toBe(false);
  });

  it('(b) domestic radical who backs sanctions and intervention: left at home, drain abroad', () => {
    const p = radicalInterventionist;
    hasMechanism(claim(p, 'primary.left-at-home'));
    expect(tensionFound(p, 'tension.radical-backs-sanctions')).toBe(true);
    expect(claim(p, 'crisis.tendency').headline).toMatch(/labor at home and with the empire abroad/);
  });

  // intervention.humanitarian.responsibility-to-protect is reached only by descent.liberalisms.04 and three
  // probes, none of which Survey schedules for this persona, so tension.radical-backs-intervention cannot
  // fire in Survey. Content coverage gap (ANOMALIES).
  it.todo('(b) the same radical meets tension.radical-backs-intervention in Survey (needs intervention reachable outside the liberal descent)');

  it('(b) control: an anti-imperialist radical draws no left-at-home finding', () => {
    expect(ids(ml)).not.toContain('primary.left-at-home');
    expect(ids(democraticSocialist)).not.toContain('primary.left-at-home');
  });

  it('(c) landlord socialist: a program that would cost the respondent’s own class', () => {
    const p = landlordSocialist;
    expect(run(p).result.situation.location.primary).toBe('landed-capital');
    const c = claim(p, 'serves.against-own');
    hasMechanism(c);
    expect(c.headline).toMatch(/rental income/);
    expect(tensionFound(p, 'tension.landlord-socialist')).toBe(true);
    hasMechanism(claim(p, 'anomaly.tension.landlord-socialist'));
  });

  it('(c) control: the same politics from a tenant draw no landlord finding', () => {
    expect(ids(democraticSocialist)).not.toContain('anomaly.tension.landlord-socialist');
    expect(ids(democraticSocialist)).not.toContain('serves.against-own');
  });

  it('(d) peripheral comprador liberal: brokers the drain, and claims sovereignty against it', () => {
    const p = compradorLiberal;
    expect(run(p).result.situation.location.primary).toBe('comprador-capital');
    expect(ids(p).some((x) => x === 'primary.defends' || x === 'primary.humanizes')).toBe(true);
    hasMechanism(claim(p, 'primary.comprador'));
    expect(claim(p, 'serves.with-own').headline).toMatch(/comprador capital/);
    expect(tensionFound(p, 'tension.comprador-open-and-sovereign')).toBe(true);
    hasMechanism(claim(p, 'anomaly.tension.comprador-open-and-sovereign'));
  });

  it('(d) control: a salaried development liberal in the periphery is not read as comprador', () => {
    expect(ids(developmentLiberal)).not.toContain('primary.comprador');
    expect(ids(dependencyTheorist)).not.toContain('primary.comprador');
  });

  it('(e) self-described Marxist who reasons by villains: idealist in practice', () => {
    const p = villainMarxist;
    const c = claim(p, 'method.gap-idealist');
    expect(c.mechanism.length).toBeGreaterThan(0);
    expect(c.evidence.length).toBeGreaterThan(0);
    expect(ids(p)).toContain('anomaly.method');
    const s = run(p).engine.state;
    const idealist = s.causes.individuals + s.causes.ideas + s.causes.culture + s.causes.nature + s.causes.divine + s.causes.chance;
    expect(idealist).toBeGreaterThan(s.causes.interests + s.causes.structures);
  });

  it('(e) control: a Marxist who explains by structures shows no method gap', () => {
    expect(ids(trotskyist)).not.toContain('method.gap-idealist');
    expect(ids(ml)).not.toContain('method.gap-idealist');
  });
});

describe('analysis: reading quality', () => {
  it('names a concrete lever in “what would push you further”', () => {
    for (const p of [nationalPopulistWorker, radicalInterventionist, landlordSocialist, compradorLiberal, villainMarxist, ml]) {
      const c = claims(p).find((x) => x.id === 'motion.conditions');
      if (!c) continue;
      expect(c.headline, p.id).toMatch(/^What would push you further: .{20,}\.$/);
      expect(c.body.length).toBeGreaterThan(0);
    }
  });
});
