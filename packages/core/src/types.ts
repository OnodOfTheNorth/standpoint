import type { Cause, ClassId, Node, Option, Probe, TensionRule } from '@standpoint/content/schema';

export type Mode = 'sketch' | 'survey' | 'excavation';
export const MODE_TARGET: Record<Mode, number> = { sketch: 12, survey: 45, excavation: Infinity };

export interface Respondent {
  kind: 'human' | 'ai';
  model?: string;
  operator?: string;
  conditions?: string;
  persona?: string;
}

export type AffordanceKind = 'reject' | 'depends' | 'none' | 'decline';

export interface AnswerEvent {
  t: 'answer';
  /** node id, `challenge:<tension>`, `origin:<position>`, or `<id>#probe` */
  node: string;
  option?: string;
  options?: string[];
  alloc?: Record<string, number>;
  affordance?: AffordanceKind;
  premise?: string;
  condition?: string;
  text?: string;
  at?: string;
}

export type LogEvent =
  | AnswerEvent
  | { t: 'undo'; at?: string }
  | { t: 'situation'; field: string; value: string | string[] | null; at?: string }
  | { t: 'skip-situation'; at?: string }
  | { t: 'correct'; position: string; stance: 'hold' | 'reject' | 'clear'; at?: string }
  | { t: 'dispute'; claim: string; text: string; at?: string }
  | { t: 'mode'; mode: Mode; at?: string }
  | { t: 'descend'; descent: string; at?: string }
  | { t: 'note'; key: string; text: string; at?: string };

export interface Session {
  format: 'standpoint.session';
  formatVersion: 1;
  id: string;
  created: string;
  seed: number;
  mode: Mode;
  contentVersion: string;
  respondent: Respondent;
  log: LogEvent[];
}

export interface TrailItem {
  node: string;
  label: string; // human-readable: what was chosen
  w: number;
  kind: 'answer' | 'probe' | 'premise' | 'condition' | 'challenge' | 'correction' | 'allocation';
  index: number; // position of the answer in the effective log
}

export interface PressureRecord {
  node: string;
  tests: string;
  outcome: 'principle' | 'interest' | 'mixed' | 'evaded';
  option: string;
  cost?: string;
}

export interface SideRecord {
  node: string;
  arc?: string;
  axis: 'class' | 'empire';
  dir: 'order' | 'dispossessed' | 'neither' | 'declined';
  option: string;
}

export interface TensionRecord {
  rule: string;
  status: 'confronted';
  resolution: string;
  kind: 'yield' | 'hold' | 'reject' | 'condition' | 'declined';
  followup?: string;
  index: number;
}

export interface AffordanceRecord {
  node: string;
  kind: AffordanceKind;
  premise?: string;
  condition?: string;
  text?: string;
}

export interface State {
  /** bumped whenever evidence or corrections change; keys the holdings cache */
  rev: number;
  mode: Mode;
  respondent: Respondent;
  seed: number;
  /** effective answers after undo */
  answers: AnswerEvent[];
  visited: Set<string>;
  decisions: number;
  scores: Record<string, number>;
  trail: Record<string, TrailItem[]>;
  corrections: Record<string, 'hold' | 'reject'>;
  situation: Record<string, string | string[]>;
  situationSkipped: boolean;
  practice: Set<string>;
  practiceAnswered: number;
  flags: Record<string, string | number | boolean>;
  currentArc?: string;
  arcNext?: string; // node to go to next inside current arc
  arcsDone: string[];
  arcsStarted: string[];
  arcStartResolution: Record<string, Record<string, number>>;
  descentsDone: string[];
  descentsRequested: string[];
  currentDescent?: string;
  causes: Record<Cause, number>;
  causeTrail: { node: string; cause: Cause; label: string }[];
  sides: SideRecord[];
  pressures: PressureRecord[];
  tensions: Record<string, TensionRecord>;
  trajectory: Record<string, string | string[]>;
  origins: Record<string, string>;
  affordances: AffordanceRecord[];
  disputes: { claim: string; text: string; at?: string }[];
  notes: Record<string, string>;
  domainEngagement: Record<string, { answered: number; declined: number }>;
  pendingProbe?: { node: string; option: string; probe: Probe; label: string };
  notices: string[];
  standaloneEscalations: string[];
  kinds: Record<string, number>; // count of answered node kinds
  migrated: string[]; // answers dropped during replay because content changed
}

export interface PromptOption {
  id: string;
  text: string;
}

export interface Prompt {
  id: string;
  kind: 'node' | 'probe' | 'challenge' | 'origin';
  type: Node['type'] | 'challenge' | 'origin' | 'reason';
  role?: string;
  title?: string;
  text: string;
  voices?: { name: string; says: string }[];
  cases?: string[];
  allocate?: { budget: number; unit: string; items: PromptOption[] };
  multi?: boolean;
  options: PromptOption[];
  premises: PromptOption[];
  conditions: PromptOption[];
  context: {
    arc?: { id: string; title: string; role: string; place: string };
    descent?: { id: string; title: string };
    decisions: number;
    target: number | null;
    mode: Mode;
  };
}

export interface Holding {
  position: string;
  problematic: string;
  weight: number;
  score: number;
  confidence: number;
  corrected?: 'hold' | 'reject';
  trail: TrailItem[];
}

export type { Node, Option, Probe, TensionRule, ClassId, Cause };
