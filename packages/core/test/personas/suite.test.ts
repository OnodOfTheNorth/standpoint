/**
 * Persona suite (brief section 11): answer-policy personas run through the real compiled bundle.
 *
 * For every persona, Survey must complete without a dead end and recover most of the persona's keystone
 * positions; Sketch must complete too, and a subset also runs Excavation. Neighbor pairs that Survey must
 * separate are checked three ways (see `describe('neighbor pairs')`).
 */
import { describe, it, expect } from 'vitest';
import type { Mode } from '../../src/index.js';
import { holdings } from '../../src/index.js';
import { affinities } from '../../src/analysis/map.js';
import { realBundle, runPersona, type Persona } from './policy.js';
import { leftPersonas } from './left.js';
import { rightPersonas } from './right.js';
import { otherPersonas } from './other.js';
import { incoherentPersonas } from './incoherent.js';
import { divergentPersonas } from './divergent.js';

const b = realBundle();
const ALL: Persona[] = [...leftPersonas, ...rightPersonas, ...otherPersonas, ...incoherentPersonas, ...divergentPersonas];
const byId = new Map(ALL.map((p) => [p.id, p]));

type Run = ReturnType<typeof runPersona> & { held: Set<string>; aff: Map<string, number> };
const cache = new Map<string, Run>();
function run(id: string, mode: Mode = 'survey'): Run {
  const key = `${id}:${mode}`;
  let r = cache.get(key);
  if (!r) {
    const out = runPersona(byId.get(id)!, mode, b);
    const held = new Set(holdings(b, out.engine.state).held.map((h) => h.position));
    // the full ranking, not the result's top 15
    const aff = new Map(affinities(b, out.engine.state).map((a) => [a.tradition, a.score]));
    r = { ...out, held, aff };
    cache.set(key, r);
  }
  return r;
}

describe('persona suite: definitions', () => {
  it('has at least 36 personas with unique ids', () => {
    expect(ALL.length).toBeGreaterThanOrEqual(36);
    expect(byId.size).toBe(ALL.length);
  });

  it('includes incoherent and apolitical personas that decline often', () => {
    expect(incoherentPersonas.filter((p) => (p.declineRate ?? 0) >= 0.3).length).toBeGreaterThanOrEqual(2);
  });

  it('references only positions, traditions and Situation values that exist', () => {
    const sit = new Map(b.situation.map((f) => [f.id, new Set(f.options.map((o) => o.id))]));
    for (const p of ALL) {
      for (const t of Object.keys(p.targets)) expect(b.positions[t], `${p.id}: target ${t}`).toBeDefined();
      for (const t of p.expect ?? []) expect(p.targets[t], `${p.id}: expect ${t} must be a positive target`).toBeGreaterThan(0);
      for (const t of p.traditions ?? []) expect(b.traditions[t], `${p.id}: tradition ${t}`).toBeDefined();
      for (const [k, v] of Object.entries(p.situation ?? {})) {
        expect(sit.has(k), `${p.id}: situation field ${k}`).toBe(true);
        for (const x of Array.isArray(v) ? v : [v]) expect(sit.get(k)!.has(x), `${p.id}: ${k}=${x}`).toBe(true);
      }
    }
  });
});

describe('persona suite: Survey', () => {
  for (const p of ALL) {
    it(`${p.id}: completes without a dead end`, () => {
      const r = run(p.id);
      const end = r.engine.next();
      expect(end.prompt, 'the run stopped with prompts still pending (policy cap hit)').toBeNull();
      // 'budget' means the mode's decision budget was spent; 'exhausted' would mean the engine ran out of prompts
      expect('reason' in end ? end.reason : null).toBe('budget');
      expect(r.engine.state.decisions).toBeGreaterThanOrEqual(45);
      expect(r.result.reading.length).toBeGreaterThan(0);
      for (const c of r.result.reading) expect(c.headline.length, c.id).toBeGreaterThan(0);
    });

    if (p.expect?.length) {
      it(`${p.id}: recovers most keystones`, () => {
        const r = run(p.id);
        const got = p.expect!.filter((x) => r.held.has(x));
        // "most": at least half of the expected keystones are held at the end of Survey
        expect(got.length, `held ${got.join(', ') || 'none'} of ${p.expect!.join(', ')}`).toBeGreaterThanOrEqual(Math.ceil(p.expect!.length / 2));
      });
    }
  }
});

describe('persona suite: other modes', () => {
  for (const p of ALL) {
    it(`${p.id}: Sketch completes`, () => {
      const r = run(p.id, 'sketch');
      const end = r.engine.next();
      expect(end.prompt).toBeNull();
      expect('reason' in end ? end.reason : null).toBe('budget');
      expect(r.engine.state.decisions).toBeGreaterThanOrEqual(12);
      expect(r.result.reading.length).toBeGreaterThan(0);
    });
  }
  // Excavation is open-ended; a subset across families and the incoherent personas is enough to show it
  // runs long without throwing or getting stuck.
  for (const id of ['ml', 'anarcho-syndicalist', 'minarchist', 'integralist', 'nasserist', 'cs-anti-politics', 'cs-mixed-steward', 'div-comprador-liberal']) {
    it(`${id}: Excavation runs well past Survey`, () => {
      const r = run(id, 'excavation');
      expect(r.engine.state.decisions).toBeGreaterThan(90);
      expect(r.result.reading.length).toBeGreaterThan(0);
    });
  }
});

/**
 * Neighbor pairs Survey must separate. For personas A (tradition tA) and B (tradition tB):
 *
 * 1. Relative affinity: A sits closer to tA, relative to tB, than B does:
 *      aff(A,tA) - aff(A,tB)  >  aff(B,tA) - aff(B,tB).
 *    This holds even when two traditions share most of their positions and only the margin moves.
 * 2. Distinguishing holdings: each persona holds at least one position that is defining or typical for its
 *    own tradition, neither defining nor typical for the neighbor, and not held by the neighbor persona.
 *    This is the concrete evidence a reader of the two results would see differ.
 * 3. Nearest of the two: each ranks its own tradition above the neighbor's (the strict version of 1).
 *
 * Affinity is map.ts's tradition score over every held position (defining 3, typical 2, contested 1,
 * minus breaks and rejections), computed from the session, not the persona's declared tradition.
 */
const PAIRS: [string, string, string, string][] = [
  ['ml', 'marxism.ml', 'maoist', 'marxism.maoism'],
  ['ml', 'marxism.ml', 'trotskyist', 'marxism.trotskyism'],
  ['maoist', 'marxism.maoism', 'trotskyist', 'marxism.trotskyism'],
  ['council-communist', 'marxism.council-communism', 'anarcho-syndicalist', 'anarchism.syndicalist'],
  ['social-democrat', 'socdem.nordic', 'democratic-socialist', 'socdem.democratic-socialism'],
  ['minarchist', 'libertarianism.minarchist', 'ancap', 'libertarianism.ancap'],
  ['paleocon', 'conservatism.paleo', 'neocon', 'conservatism.neo'],
  ['paleocon', 'conservatism.paleo', 'national-conservative', 'conservatism.national'],
  ['neocon', 'conservatism.neo', 'national-conservative', 'conservatism.national'],
  ['integralist', 'conservatism.integralism', 'christian-democrat', 'conservatism.christian-democracy'],
  ['liberal-technocrat', 'liberalism.technocratic', 'ordoliberal', 'liberalism.ordoliberal'],
  ['nasserist', 'nationalism.nasserism', 'islamist', 'religious.islamism-brotherhood'],
  ['dependency-theorist', 'marxism.dependency', 'development-liberal', 'liberalism.technocratic'],
];

/**
 * Pairs whose strict ranking (check 3) would fail for reasons of content rather than engine; such a pair is
 * skipped for check 3 only, with the reason stated here, and checks 1 and 2 still run. Empty at present.
 * The integralist / Christian democrat pair is the closest: their shared Catholic social teaching positions
 * (natural law, the social function of property, stewardship, one body) are tagged typical for Christian
 * democracy and contested or untagged for integralism, so the pair separates only when Survey takes the
 * integralist into the religious-politics descent, where integralism's defining positions live.
 */
const STRICT_GAPS = new Set<string>([]);

const sc = (id: string, t: string) => run(id).aff.get(t) ?? 0;
function distinguishing(own: string, other: string): string[] {
  return Object.values(b.positions)
    .filter((p) => (p.traditions.defining?.includes(own) || p.traditions.typical?.includes(own)) && !p.traditions.defining?.includes(other) && !p.traditions.typical?.includes(other))
    .map((p) => p.id);
}

describe('neighbor pairs', () => {
  for (const [a, ta, z, tz] of PAIRS) {
    const name = `${a}/${z}`;
    it(`${name}: relative affinity moves the right way`, () => {
      expect(sc(a, ta) - sc(a, tz)).toBeGreaterThan(sc(z, ta) - sc(z, tz));
    });
    it(`${name}: each holds a distinguishing position the other does not`, () => {
      const ra = run(a);
      const rz = run(z);
      const da = distinguishing(ta, tz).filter((p) => ra.held.has(p) && !rz.held.has(p));
      const dz = distinguishing(tz, ta).filter((p) => rz.held.has(p) && !ra.held.has(p));
      expect(da.length, `${a} holds none of ${ta}'s distinguishing positions`).toBeGreaterThan(0);
      expect(dz.length, `${z} holds none of ${tz}'s distinguishing positions`).toBeGreaterThan(0);
    });
    (STRICT_GAPS.has(name) ? it.skip : it)(`${name}: each ranks its own tradition above the neighbor's`, () => {
      expect(sc(a, ta), `${a}: ${ta} vs ${tz}`).toBeGreaterThan(sc(a, tz));
      expect(sc(z, tz), `${z}: ${tz} vs ${ta}`).toBeGreaterThan(sc(z, ta));
    });
  }
});

describe('incoherent personas', () => {
  it('produce a reading as rich as a theorist’s: every section answered', () => {
    for (const p of incoherentPersonas) {
      const sections = new Set(run(p.id).result.reading.map((c) => c.section));
      for (const s of ['serves', 'primary', 'pressure', 'crisis', 'method', 'motion', 'organization', 'anomalies']) expect(sections.has(s as never), `${p.id}: ${s}`).toBe(true);
    }
  });

  it('report the hedging of heavy decliners', () => {
    for (const p of incoherentPersonas.filter((x) => (x.declineRate ?? 0) >= 0.3)) {
      expect(run(p.id).result.reading.map((c) => c.id), p.id).toContain('respondent.hedging');
    }
  });

  it('hold positions from more than one family', () => {
    const fam = (pid: string) => new Set([...(b.positions[pid]!.traditions.defining ?? [])].map((t) => b.traditions[t]?.family).filter(Boolean));
    for (const id of ['cs-mixed-steward', 'cs-rigged-cabbie']) {
      const families = new Set<string>();
      for (const pid of run(id).held) for (const f of fam(pid)) families.add(f as string);
      expect(families.size, id).toBeGreaterThanOrEqual(3);
    }
  });
});

