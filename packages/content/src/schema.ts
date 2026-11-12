/**
 * Content schema for Standpoint.
 *
 * Every YAML file under packages/content/data is validated against these
 * schemas, then compiled into one JSON bundle consumed by the engine.
 */
import { z } from 'zod';

export const ONTOLOGY_VERSION = '1.0.0';
export const ONTOLOGY_BASE = 'https://onodofthenorth.github.io/standpoint/ns/';

export const Id = z
  .string()
  .regex(/^[a-z0-9][a-z0-9._-]*$/, 'ids are lowercase dotted slugs');
export type Id = z.infer<typeof Id>;

/* ------------------------------------------------------------------ */
/* Vocabularies                                                         */
/* ------------------------------------------------------------------ */

export const CLASS_IDS = [
  'finance-capital',
  'industrial-capital',
  'landed-capital',
  'comprador-capital',
  'petty-bourgeoisie',
  'professional-managerial',
  'core-workers',
  'peripheral-workers',
  'peasantry',
  'reserve-army',
] as const;
export const ClassId = z.enum(CLASS_IDS);
export type ClassId = z.infer<typeof ClassId>;

export const DRAIN = ['sustains', 'softens', 'none', 'reduces', 'breaks'] as const;
export const Drain = z.enum(DRAIN);
export type Drain = z.infer<typeof Drain>;

export const LAW_OF_VALUE = ['extends', 'regulates', 'none', 'suspends', 'abolishes'] as const;
export const LawOfValue = z.enum(LAW_OF_VALUE);
export type LawOfValue = z.infer<typeof LawOfValue>;

export const CONSCIOUSNESS = ['economic-corporate', 'class-economic', 'hegemonic'] as const;
export const Consciousness = z.enum(CONSCIOUSNESS);

/** Kinds of cause a respondent reaches for when explaining events. */
export const CAUSES = [
  'individuals',
  'ideas',
  'culture',
  'nature',
  'divine',
  'chance',
  'interests',
  'structures',
] as const;
export const Cause = z.enum(CAUSES);
export type Cause = z.infer<typeof Cause>;
export const IDEALIST_CAUSES: readonly Cause[] = ['individuals', 'ideas', 'culture', 'nature', 'divine', 'chance'];
export const MATERIALIST_CAUSES: readonly Cause[] = ['interests', 'structures'];

export const LAYERS = ['method', 'analysis', 'horizon', 'strategy', 'priority'] as const;
export const Layer = z.enum(LAYERS);
export type Layer = z.infer<typeof Layer>;

export const DOMAINS = [
  'method',
  'economy',
  'world',
  'nation',
  'state',
  'history',
  'strategy',
  'culture',
  'ecology',
  'commonsense',
] as const;
export const Domain = z.enum(DOMAINS);
export type Domain = z.infer<typeof Domain>;

/* ------------------------------------------------------------------ */
/* Shared pieces                                                        */
/* ------------------------------------------------------------------ */

export const Source = z.object({
  author: z.string().min(2),
  title: z.string().min(2),
  year: z.union([z.number().int(), z.string().regex(/^-?\d{1,4}(\s?BCE)?$|^c\. ?-?\d{1,4}$/)]),
  note: z.string().optional(),
});
export type Source = z.infer<typeof Source>;

export const Evidence = z.object({
  position: Id,
  w: z.number().min(-5).max(5),
});
export type Evidence = z.infer<typeof Evidence>;

/** A small condition language used for gates, tension rules and branching. */
export type Cond =
  | { holds: string }
  | { holdsAll: string[] }
  | { holdsAny: string[] }
  | { weight: { position: string; gt?: number; lt?: number } }
  | { situation: { field: string; in: string[] } }
  | { situationKnown: string }
  | { practice: string }
  | { practiceAny: string[] }
  | { flag: { key: string; eq: string | number | boolean } }
  | { answered: { node: string; option?: string } }
  | { mode: string[] }
  | { classIs: string[] }
  | { worldIs: string[] }
  | { respondentKind: string[] }
  | { all: Cond[] }
  | { any: Cond[] }
  | { not: Cond };

export const Cond: z.ZodType<Cond> = z.lazy(() =>
  z.union([
    z.object({ holds: Id }).strict(),
    z.object({ holdsAll: z.array(Id).min(1) }).strict(),
    z.object({ holdsAny: z.array(Id).min(1) }).strict(),
    z
      .object({
        weight: z.object({ position: Id, gt: z.number().optional(), lt: z.number().optional() }).strict(),
      })
      .strict(),
    z.object({ situation: z.object({ field: z.string(), in: z.array(z.string()).min(1) }).strict() }).strict(),
    z.object({ situationKnown: z.string() }).strict(),
    z.object({ practice: Id }).strict(),
    z.object({ practiceAny: z.array(Id).min(1) }).strict(),
    z
      .object({
        flag: z.object({ key: z.string(), eq: z.union([z.string(), z.number(), z.boolean()]) }).strict(),
      })
      .strict(),
    z.object({ answered: z.object({ node: Id, option: z.string().optional() }).strict() }).strict(),
    z.object({ mode: z.array(z.enum(['sketch', 'survey', 'excavation'])) }).strict(),
    z.object({ classIs: z.array(ClassId) }).strict(),
    z.object({ worldIs: z.array(z.enum(['core', 'semi-periphery', 'periphery'])) }).strict(),
    z.object({ respondentKind: z.array(z.enum(['human', 'ai'])) }).strict(),
    z.object({ all: z.array(Cond).min(1) }).strict(),
    z.object({ any: z.array(Cond).min(1) }).strict(),
    z.object({ not: Cond }).strict(),
  ]),
);

/* ------------------------------------------------------------------ */
/* Ontology                                                             */
/* ------------------------------------------------------------------ */

export const Against = z.object({
  from: Id, // tradition id that makes this objection
  text: z.string().min(20),
});

export const PositionAnalysis = z.object({
  gains: z.array(ClassId),
  pays: z.array(ClassId),
  mechanism: z.string().min(30),
  drain: Drain,
  law_of_value: LawOfValue,
  disputed: z.string().optional(),
  consciousness: Consciousness.optional(),
  method: z.enum(['materialist', 'idealist', 'mixed']).optional(),
});

export const TraditionStance = z.object({
  defining: z.array(Id).optional(),
  typical: z.array(Id).optional(),
  contested: z.array(Id).optional(),
  rejects: z.array(Id).optional(),
});

export const Position = z.object({
  id: Id,
  label: z.string().min(2).max(80), // short name for maps
  claim: z.string().min(15),
  voiced: z.string().min(15),
  you: z.string().min(15), // second-person sentence for the portrait
  because: z.string().min(30),
  against: z.array(Against).min(1),
  sources: z.array(Source).min(1),
  traditions: TraditionStance.default({}),
  presupposes: z.array(Id).default([]),
  excludes: z.array(Id).default([]),
  tension: z.array(Id).default([]),
  tags: z.array(z.string()).default([]),
  analysis: PositionAnalysis,
});
export type PositionIn = z.input<typeof Position>;
export type Position = z.infer<typeof Position> & { problematic: string };

export const Problematic = z.object({
  id: Id,
  domain: Domain,
  layer: Layer,
  question: z.string().min(8),
  plain: z.string().min(8),
  short: z.string().min(2), // noun phrase: "the state", "the motor of history"
  importance: z.number().int().min(1).max(3).default(2),
  region: z.string().optional(), // descent region
  positions: z.array(Position).min(2),
});
export type ProblematicIn = z.input<typeof Problematic>;
export type Problematic = Omit<z.infer<typeof Problematic>, 'positions'> & { positions: string[] };

export const Lineage = z.object({
  id: Id,
  event: z.string().optional(),
  date: z.union([z.number().int(), z.string()]).optional(),
});

export const Tradition = z.object({
  id: Id,
  name: z.string(),
  family: z.string(), // top-level family id, e.g. "marxism"
  parent: Id.optional(), // taxonomic parent (SKOS broader)
  leaf: z.boolean().default(true),
  era: z.tuple([z.number().int(), z.number().int().nullable()]),
  regions: z.array(z.string()).default([]),
  self: z.string().min(40), // self-description in its own voice
  record: z
    .array(z.object({ text: z.string().min(10), disputed: z.boolean().default(false), date: z.union([z.number(), z.string()]).optional() }))
    .default([]),
  descendsFrom: z.array(Lineage).default([]),
  breaksWith: z.array(Lineage).default([]),
  analysis: z.object({
    conditions: z.string().min(30),
    class_base: z.string().min(30),
    function: z.string().min(30),
    disputed: z.string().optional(),
  }),
  thinkers: z.array(Id).default([]),
  keyTexts: z.array(Source).default([]),
});
export type Tradition = z.infer<typeof Tradition>;

export const Argues = z.object({
  position: Id,
  in: Source,
  note: z.string().optional(),
});

export const Thinker = z.object({
  id: Id,
  name: z.string(),
  born: z.number().int().optional(),
  died: z.number().int().nullable().optional(),
  region: z.string(),
  traditions: z.array(Id).min(1),
  summary: z.string().min(20),
  argues: z.array(Argues).default([]),
});
export type Thinker = z.infer<typeof Thinker>;

export const HistEvent = z.object({
  id: Id,
  name: z.string(),
  date: z.union([z.number().int(), z.string()]),
  end: z.union([z.number().int(), z.string()]).optional(),
  place: z.string(),
  summary: z.string().min(30),
  problematic: Id.optional(), // the historical-assessment problematic it anchors
  disputed: z.string().optional(),
  stances: z
    .array(z.object({ tradition: Id, position: Id.optional(), note: z.string() }))
    .default([]),
});
export type HistEvent = z.infer<typeof HistEvent>;

export const Debate = z.object({
  id: Id,
  name: z.string(),
  date: z.union([z.number().int(), z.string()]),
  summary: z.string().min(30),
  problematic: Id.optional(),
  sides: z
    .array(
      z.object({
        label: z.string(),
        thinkers: z.array(Id).default([]),
        positions: z.array(Id).default([]),
        argument: z.string().min(20),
        texts: z.array(Source).default([]),
      }),
    )
    .min(2),
  outcome: z.string().optional(),
});
export type Debate = z.infer<typeof Debate>;

/* ------------------------------------------------------------------ */
/* Journey content                                                      */
/* ------------------------------------------------------------------ */

export const NODE_TYPES = [
  'scene',
  'reason',
  'tradeoff',
  'verdict',
  'explanation',
  'allocation',
  'line',
  'voices',
  'situation',
  'practice',
  'trajectory',
  'pressure',
  'escalation',
] as const;
export const NodeType = z.enum(NODE_TYPES);
export type NodeType = z.infer<typeof NodeType>;

export const ROLES = ['trunk', 'arc', 'probe', 'descent', 'pressure', 'module'] as const;

export const Side = z.object({
  axis: z.enum(['class', 'empire']),
  dir: z.enum(['order', 'dispossessed', 'neither']),
});
export type Side = z.infer<typeof Side>;

export const ProbeOption = z.object({
  id: z.string().optional(),
  text: z.string().min(2),
  evidence: z.array(Evidence).default([]),
  cause: Cause.optional(),
});

export const Probe = z.object({
  ask: z.string().min(4),
  options: z.array(ProbeOption).min(2),
});
export type Probe = z.infer<typeof Probe>;

export const Next = z.union([
  Id,
  z.array(z.object({ if: Cond.optional(), to: Id })).min(1),
]);

export const Option = z.object({
  id: z.string().regex(/^[a-z0-9_-]+$/),
  text: z.string().min(2),
  evidence: z.array(Evidence).default([]),
  cause: Cause.optional(),
  side: Side.optional(),
  pressure: z.enum(['principle', 'interest', 'mixed']).optional(),
  cost: z.string().optional(),
  probe: Probe.optional(),
  consequence: z.string().optional(),
  next: Next.optional(),
  end: z.boolean().optional(),
  set: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  practice: z.array(Id).optional(), // practice item ids this option records
  value: z.string().optional(), // situation/trajectory value recorded
});
export type Option = z.infer<typeof Option>;

export const Affordance = z.object({
  id: z.string().regex(/^[a-z0-9_-]+$/),
  text: z.string().min(2),
  evidence: z.array(Evidence).default([]),
});

export const Node = z.object({
  id: Id,
  type: NodeType,
  role: z.enum(ROLES).optional(), // filled by the compiler from file location
  arc: Id.optional(),
  descent: Id.optional(),
  title: z.string().optional(),
  text: z.string().min(10),
  recap: z.string().optional(), // standalone setup line for escalations entered outside their arc
  why: z.string().min(10), // shown after answering: what this probed
  gate: Cond.optional(),
  premises: z.array(Affordance).default([]), // for "reject the premise"
  conditions: z.array(Affordance).default([]), // for "it depends"
  voices: z.array(z.object({ name: z.string(), says: z.string() })).optional(),
  cases: z.array(z.string()).optional(), // line-drawing series
  allocate: z
    .object({
      budget: z.number().int().min(2),
      unit: z.string().default('points'),
      items: z.array(z.object({ id: z.string(), text: z.string(), evidence: z.array(Evidence).default([]) })).min(2),
    })
    .optional(),
  multi: z.boolean().optional(), // multi-select (practice)
  field: z.string().optional(), // situation/trajectory field written by this node
  tests: Id.optional(), // pressure: the principle under test
  options: z.array(Option).default([]),
  set: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});
export type NodeIn = z.input<typeof Node>;
export type Node = z.infer<typeof Node>;

export const Arc = z.object({
  id: Id,
  title: z.string(),
  blurb: z.string().min(20),
  role: z.string().min(5), // who you play
  place: z.string(), // where in the world
  start: Id,
  escalation: Id,
  pressure: z.array(Id).default([]),
  tags: z.array(Domain).default([]),
  nodes: z.array(Node).min(3),
});
export type ArcIn = z.input<typeof Arc>;
export type Arc = Omit<z.infer<typeof Arc>, 'nodes'> & { nodes: string[] };

export const Descent = z.object({
  id: Id,
  title: z.string(),
  blurb: z.string().min(20),
  region: z.string(),
  gate: Cond,
  entry: Id,
  nodes: z.array(Node).min(2),
});
export type Descent = Omit<z.infer<typeof Descent>, 'nodes'> & { nodes: string[] };

export const Resolution = z.object({
  id: z.string().regex(/^[a-z0-9_-]+$/),
  text: z.string().min(2),
  kind: z.enum(['yield', 'hold', 'reject', 'condition']),
  revise: Id.optional(), // position that gives way
  evidence: z.array(Evidence).default([]),
  followup: Probe.optional(),
});

export const TENSION_TYPES = [
  'logical',
  'principle-application',
  'strategy-horizon',
  'theory-practice',
  'position-consciousness',
] as const;

export const TensionRule = z.object({
  id: Id,
  type: z.enum(TENSION_TYPES),
  between: z.array(Id).min(1), // positions (or practice/situation ids) in tension
  when: Cond,
  prompt: z.string().min(20),
  explain: z.string().min(20), // the instrument's plain account of the tension
  resolutions: z.array(Resolution).min(3),
});
export type TensionRule = z.infer<typeof TensionRule>;

export const SituationField = z.object({
  id: z.string(),
  group: z.enum(['class', 'world', 'group', 'life', 'ai']),
  question: z.string(),
  multi: z.boolean().default(false),
  options: z.array(z.object({ id: z.string(), text: z.string() })).min(2),
  for: z.enum(['human', 'ai', 'both']).default('human'),
});
export type SituationField = z.infer<typeof SituationField>;

export const PracticeItem = z.object({
  id: Id,
  text: z.string(),
  kind: z.enum(['organization', 'action', 'individual', 'none']),
  collective: z.boolean(),
  drain: Drain.default('none'),
  side: z.enum(['labor', 'capital', 'neutral']).default('neutral'),
});
export type PracticeItem = z.infer<typeof PracticeItem>;

/* ------------------------------------------------------------------ */
/* File shapes                                                          */
/* ------------------------------------------------------------------ */

export const ProblematicFile = z.object({ problematics: z.array(Problematic) });
/** In data files, name/family/parent/era may be omitted: they are merged from registry/traditions.yaml. */
export const TraditionData = Tradition.extend({
  name: z.string().optional(),
  family: z.string().optional(),
  era: z.tuple([z.number().int(), z.number().int().nullable()]).optional(),
});
export const TraditionFile = z.object({ traditions: z.array(TraditionData) });
export const ThinkerFile = z.object({ thinkers: z.array(Thinker) });
export const EventFile = z.object({ events: z.array(HistEvent) });
export const DebateFile = z.object({ debates: z.array(Debate) });
export const NodeFile = z.object({ nodes: z.array(Node) });
export const ArcFile = Arc;
export const DescentFile = Descent;
export const TensionFile = z.object({ tensions: z.array(TensionRule) });
export const SituationFile = z.object({
  situation: z.array(SituationField),
  practice: z.array(PracticeItem),
});

/* ------------------------------------------------------------------ */
/* Compiled bundle                                                      */
/* ------------------------------------------------------------------ */

export interface Bundle {
  version: string;
  ontologyVersion: string;
  base: string;
  problematics: Record<string, Problematic>;
  positions: Record<string, Position>;
  traditions: Record<string, Tradition>;
  families: Record<string, { id: string; name: string }>;
  thinkers: Record<string, Thinker>;
  events: Record<string, HistEvent>;
  debates: Record<string, Debate>;
  nodes: Record<string, Node>;
  trunk: string[];
  arcs: Record<string, Arc>;
  descents: Record<string, Descent>;
  probes: string[];
  pressure: string[];
  modules: string[];
  tensions: Record<string, TensionRule>;
  situation: SituationField[];
  practice: Record<string, PracticeItem>;
  /** reverse index: position id -> node ids that carry evidence for it */
  reach: Record<string, string[]>;
}
