import type { Bundle } from '@standpoint/content/schema';
import { DOMAINS } from '@standpoint/content/schema';
import type { Session, State, TensionRecord } from './types.js';
import { replay } from './state.js';
import { holdings, HOLD_THRESHOLD } from './holdings.js';
import { keystones, liveTensions } from './structure.js';
import { location, CLASS_NAMES } from './situation.js';
import { reading } from './analysis/reading.js';
import type { Claim } from './analysis/common.js';
import { resolutionOf } from './analysis/common.js';
import * as M from './analysis/map.js';

export const RESULT_FORMAT = 'standpoint.result';

export interface Result {
  format: typeof RESULT_FORMAT;
  formatVersion: 1;
  meta: {
    session: string;
    date: string;
    mode: Session['mode'];
    contentVersion: string;
    ontologyVersion: string;
    respondent: Session['respondent'];
    decisions: number;
  };
  coverage: {
    overall: number;
    byDomain: Record<string, number>;
    statement: string;
  };
  situation: {
    known: boolean;
    location: ReturnType<typeof location>;
    className: string | null;
    fields: Record<string, string | string[]>;
  };
  reading: Claim[];
  holdings: {
    position: string;
    problematic: string;
    label: string;
    weight: number;
    confidence: number;
    corrected?: string;
    evidence: { node: string; label: string; w: number; kind: string }[];
  }[];
  keystones: { position: string; label: string; you: string; score: number; dependents: string[]; strongestObjection: { from: string; text: string } | null; move: string | null }[];
  tensions: {
    live: { rule: string; type: string; principal: boolean; between: string[]; explain: string }[];
    confronted: (TensionRecord & { type: string; between: string[]; resolutionText: string })[];
  };
  portrait: string[];
  graph: ReturnType<typeof M.graph>;
  affinities: M.Affinity[];
  lineage: ReturnType<typeof M.lineageTree>;
  record: ReturnType<typeof M.record>;
  neighbors: ReturnType<typeof M.neighbors>;
  otherReadings: ReturnType<typeof M.otherReadings>;
  theoryPractice: ReturnType<typeof M.theoryPractice>;
  origins: ReturnType<typeof M.origins>;
  library: ReturnType<typeof M.library>;
  affordances: State['affordances'];
  disputes: State['disputes'];
  pressures: State['pressures'];
  sides: State['sides'];
  causes: State['causes'];
  trajectory: State['trajectory'];
  practice: string[];
  notes: Record<string, string>;
  migrated: string[];
}

const DOMAIN_NAMES: Record<string, string> = {
  method: 'method',
  economy: 'political economy',
  world: 'the world system',
  nation: 'nation and land',
  state: 'the state and power',
  history: 'historical judgments',
  strategy: 'strategy',
  culture: 'social reproduction and culture',
  ecology: 'ecology and technology',
  commonsense: 'common sense',
};

export function coverage(b: Bundle, s: State) {
  const byDomain: Record<string, number> = {};
  for (const d of DOMAINS) {
    const ps = Object.values(b.problematics).filter((p) => p.domain === d).map((p) => p.id);
    byDomain[d] = ps.length ? resolutionOf(b, s, ps) : 0;
  }
  const overall = resolutionOf(b, s, Object.keys(b.problematics));
  const sharp = Object.entries(byDomain).filter(([, v]) => v >= 0.35).map(([k]) => DOMAIN_NAMES[k]!);
  const fog = Object.entries(byDomain).filter(([, v]) => v < 0.15).map(([k]) => DOMAIN_NAMES[k]!);
  const modeWord = s.mode === 'sketch' ? 'This is a Sketch' : s.mode === 'survey' ? 'This is a Survey' : 'This is an Excavation';
  const statement = `${modeWord} from ${s.decisions} decisions. The instrument has resolved about ${Math.round(overall * 100)}% of the map${sharp.length ? `; sharpest on ${sharp.slice(0, 3).join(', ')}` : ''}${fog.length ? `; still fogged on ${fog.slice(0, 4).join(', ')}` : ''}.${s.mode === 'sketch' ? ' A Sketch knows little: treat every claim below as a first guess.' : ''}`;
  return { overall, byDomain, statement };
}

export function computeResult(b: Bundle, session: Session, opts: { now?: string; state?: State } = {}): Result {
  const s = opts.state ?? replay(b, session);
  const h = holdings(b, s);
  const ks = keystones(b, s, 5);
  const loc = location(s);
  const aff = M.affinities(b, s);
  const live = liveTensions(b, s);
  const lastAt = [...session.log].reverse().find((e) => e.at)?.at;
  return {
    format: RESULT_FORMAT,
    formatVersion: 1,
    meta: {
      session: session.id,
      date: opts.now ?? lastAt ?? session.created,
      mode: s.mode,
      contentVersion: b.version,
      ontologyVersion: b.ontologyVersion,
      respondent: session.respondent,
      decisions: s.decisions,
    },
    coverage: coverage(b, s),
    situation: { known: loc.known, location: loc, className: loc.primary ? CLASS_NAMES[loc.primary] : null, fields: { ...s.situation } },
    reading: reading(b, s),
    holdings: h.held.map((x) => ({
      position: x.position,
      problematic: x.problematic,
      label: b.positions[x.position]!.label,
      weight: round(x.weight),
      confidence: round(x.confidence),
      corrected: x.corrected,
      evidence: x.trail.map((t) => ({ node: t.node, label: t.label, w: t.w, kind: t.kind })),
    })),
    keystones: ks.map((k) => {
      const p = b.positions[k.position]!;
      const obj = p.against[0];
      return {
        position: k.position,
        label: p.label,
        you: p.you,
        score: round(k.score),
        dependents: k.dependents,
        strongestObjection: obj ? { from: obj.from, text: obj.text } : null,
        move: s.notes[`move:${k.position}`] ?? null,
      };
    }),
    tensions: {
      live: live.map((t) => {
        const r = b.tensions[t.rule]!;
        return { rule: r.id, type: r.type, principal: t.principal, between: r.between, explain: r.explain };
      }),
      confronted: Object.values(s.tensions).map((t) => {
        const r = b.tensions[t.rule];
        return {
          ...t,
          type: r?.type ?? 'logical',
          between: r?.between ?? [],
          resolutionText: r?.resolutions.find((x) => x.id === t.resolution)?.text ?? t.resolution,
        };
      }),
    },
    portrait: M.portrait(b, s),
    graph: M.graph(b, s, ks),
    affinities: aff.slice(0, 15),
    lineage: M.lineageTree(b, aff),
    record: M.record(b, s),
    neighbors: M.neighbors(b, s),
    otherReadings: M.otherReadings(b, s, aff),
    theoryPractice: M.theoryPractice(b, s),
    origins: M.origins(b, s, ks),
    library: M.library(b, s),
    affordances: s.affordances,
    disputes: s.disputes,
    pressures: s.pressures,
    sides: s.sides,
    causes: s.causes,
    trajectory: s.trajectory,
    practice: [...s.practice],
    notes: s.notes,
    migrated: s.migrated,
  };
}

function round(x: number) {
  return Math.round(x * 1000) / 1000;
}

export { HOLD_THRESHOLD };
