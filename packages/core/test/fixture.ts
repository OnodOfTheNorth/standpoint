/** A tiny hand-built bundle for engine tests, independent of the real content. */
import type { Bundle, Node, Position, PositionIn } from '@standpoint/content/schema';
import { Node as NodeSchema, Position as PositionSchema, TensionRule } from '@standpoint/content/schema';

type Extra = Omit<Partial<PositionIn>, 'analysis'> & { analysis?: Partial<PositionIn['analysis']> };
function pos(problematic: string, slug: string, extra: Extra = {}): Position {
  const id = `${problematic}.${slug}`;
  const base = PositionSchema.parse({
    id,
    label: `${slug} label`,
    claim: `A plain claim about ${slug}.`,
    voiced: `"We hold the view called ${slug}."`,
    you: `You hold the view called ${slug}.`,
    because: `Because ${slug} is the strongest view on this question, for reasons.`,
    against: [{ from: 'liberalism.classical', text: `The objection to ${slug} is serious and strong.` }],
    sources: [{ author: 'A. Author', title: 'A Book', year: 1900 }],
    ...extra,
    analysis: {
      gains: [],
      pays: [],
      mechanism: `Mechanism for ${slug}: someone gains, someone pays, through prices.`,
      drain: 'none',
      law_of_value: 'none',
      ...(extra.analysis ?? {}),
    },
  });
  return { ...base, problematic };
}

const node = (n: Record<string, unknown>): Node => NodeSchema.parse(n);

export function fixture(): Bundle {
  const positions: Position[] = [
    pos('state.nature', 'arbiter', { traditions: { defining: ['liberalism.classical'] }, analysis: { gains: ['finance-capital'], pays: ['core-workers'], drain: 'sustains', law_of_value: 'extends' } }),
    pos('state.nature', 'instrument', { traditions: { defining: ['marxism.leninism'] }, presupposes: ['history.motor.class'], analysis: { gains: ['core-workers'], pays: ['finance-capital'], drain: 'reduces', law_of_value: 'suspends', method: 'materialist' } }),
    pos('state.nature', 'aggressor', { traditions: { defining: ['libertarianism.ancap'] } }),
    pos('history.motor', 'class', { analysis: { gains: [], pays: [], method: 'materialist' } }),
    pos('history.motor', 'ideas', { analysis: { gains: [], pays: [], method: 'idealist' } }),
    pos('history.motor', 'god', { analysis: { gains: [], pays: [], method: 'idealist' } }),
    pos('intl.sanctions', 'tool', { analysis: { gains: ['finance-capital'], pays: ['peripheral-workers'], drain: 'sustains', law_of_value: 'none' } }),
    pos('intl.sanctions', 'war', { analysis: { gains: ['peripheral-workers'], pays: ['finance-capital'], drain: 'reduces', law_of_value: 'none' } }),
    pos('intl.sovereignty', 'own-course', { analysis: { gains: ['peripheral-workers'], pays: [], drain: 'reduces', law_of_value: 'none' } }),
    pos('intl.sovereignty', 'conditional', { analysis: { gains: [], pays: ['peripheral-workers'], drain: 'softens', law_of_value: 'none' } }),
    pos('welfare.state', 'decommodify', { analysis: { gains: ['core-workers'], pays: ['industrial-capital'], drain: 'none', law_of_value: 'suspends' } }),
    pos('welfare.state', 'dependency', { analysis: { gains: ['industrial-capital'], pays: ['core-workers'], drain: 'none', law_of_value: 'extends' } }),
  ];
  const P = Object.fromEntries(positions.map((p) => [p.id, p]));
  const probs = [
    { id: 'state.nature', domain: 'state', layer: 'analysis', importance: 3 },
    { id: 'history.motor', domain: 'method', layer: 'method', importance: 3 },
    { id: 'intl.sanctions', domain: 'world', layer: 'strategy', importance: 2 },
    { id: 'intl.sovereignty', domain: 'world', layer: 'horizon', importance: 2 },
    { id: 'welfare.state', domain: 'economy', layer: 'analysis', importance: 2 },
  ] as const;
  const problematics = Object.fromEntries(
    probs.map((p) => [
      p.id,
      { ...p, question: `Question ${p.id}?`, plain: `Plain ${p.id}?`, short: p.id, positions: positions.filter((x) => x.problematic === p.id).map((x) => x.id) },
    ]),
  ) as Bundle['problematics'];

  const nodes: Node[] = [
    node({
      id: 't.1', type: 'scene', role: 'trunk', text: 'Soldiers unload the ships during the strike.', why: 'Asks what the state is.',
      premises: [{ id: 'p', text: 'There are no sides.' }],
      conditions: [{ id: 'c', text: 'Depends on the demands.' }],
      options: [
        { id: 'a', text: 'Neutral referee.', side: { axis: 'class', dir: 'order' }, evidence: [{ position: 'state.nature.arbiter', w: 3 }] },
        { id: 'b', text: 'Class instrument.', side: { axis: 'class', dir: 'dispossessed' }, evidence: [{ position: 'state.nature.instrument', w: 3 }],
          probe: { ask: 'Why?', options: [{ text: 'Owners own it.', cause: 'interests', evidence: [{ position: 'history.motor.class', w: 2 }] }, { text: 'Bad men.', cause: 'individuals', evidence: [] }] } },
        { id: 'c', text: 'Aggressor.', evidence: [{ position: 'state.nature.aggressor', w: 3 }] },
      ],
    }),
    node({
      id: 't.2', type: 'verdict', role: 'trunk', text: 'Copper is nationalized; sanctions follow.', why: 'Asks about sanctions.',
      options: [
        { id: 'a', text: 'Sanctions are fair.', side: { axis: 'empire', dir: 'order' }, evidence: [{ position: 'intl.sanctions.tool', w: 3 }] },
        { id: 'b', text: 'Economic war.', side: { axis: 'empire', dir: 'dispossessed' }, evidence: [{ position: 'intl.sanctions.war', w: 3 }, { position: 'intl.sovereignty.own-course', w: 2 }] },
      ],
    }),
    node({
      id: 'arc.x.1', type: 'scene', role: 'arc', arc: 'arc.x', text: 'Arc start scene.', why: 'Arc start scene.',
      options: [
        { id: 'a', text: 'Go left.', set: { left: true }, evidence: [{ position: 'welfare.state.decommodify', w: 2 }], next: 'arc.x.2' },
        { id: 'b', text: 'Go right.', evidence: [{ position: 'welfare.state.dependency', w: 2 }], next: 'arc.x.2' },
      ],
    }),
    node({
      id: 'arc.x.2', type: 'escalation', role: 'arc', arc: 'arc.x', recap: 'In town, a strike is building.', text: 'The center fails.', why: 'Escalation scene.',
      options: [
        { id: 'a', text: 'With labor.', side: { axis: 'class', dir: 'dispossessed' }, evidence: [{ position: 'history.motor.class', w: 1 }] },
        { id: 'b', text: 'With order.', side: { axis: 'class', dir: 'order' }, evidence: [{ position: 'state.nature.arbiter', w: 1 }] },
      ],
    }),
    node({
      id: 'pr.1', type: 'pressure', role: 'pressure', tests: 'welfare.state.decommodify', gate: { classIs: ['core-workers', 'professional-managerial'] },
      text: 'Your taxes rise to pay for it.', why: 'Pressure scene.',
      options: [
        { id: 'a', text: 'Pay.', pressure: 'principle', cost: 'You pay more.', evidence: [{ position: 'welfare.state.decommodify', w: 1 }] },
        { id: 'b', text: 'Refuse.', pressure: 'interest', cost: 'Others go without.', evidence: [{ position: 'welfare.state.dependency', w: 1 }] },
      ],
    }),
    node({
      id: 'pb.1', type: 'explanation', role: 'probe', text: 'Why did slavery end?', why: 'Probe of history.',
      options: [
        { id: 'a', text: 'Revolt.', cause: 'structures', evidence: [{ position: 'history.motor.class', w: 3 }] },
        { id: 'b', text: 'Ideas.', cause: 'ideas', evidence: [{ position: 'history.motor.ideas', w: 3 }] },
        { id: 'c', text: 'God.', cause: 'divine', evidence: [{ position: 'history.motor.god', w: 3 }] },
      ],
    }),
    node({
      id: 'pb.2', type: 'explanation', role: 'probe', text: 'Why are poor countries poor?', why: 'Probe of poverty.',
      options: [
        { id: 'a', text: 'Corrupt leaders.', cause: 'individuals', evidence: [{ position: 'intl.sovereignty.conditional', w: 2 }] },
        { id: 'b', text: 'Drain.', cause: 'structures', evidence: [{ position: 'intl.sovereignty.own-course', w: 2 }] },
      ],
    }),
    node({
      id: 'm.practice', type: 'practice', role: 'module', multi: true, text: 'What do you belong to?', why: 'Practice question.',
      options: [
        { id: 'union', text: 'A union', practice: ['practice.union-member'] },
        { id: 'none', text: 'None', practice: ['practice.none'] },
      ],
    }),
  ];
  const tensions = {
    't.sov': TensionRule.parse({
      id: 't.sov', type: 'principle-application', between: ['intl.sovereignty.own-course', 'intl.sanctions.tool'],
      when: { holdsAll: ['intl.sovereignty.own-course', 'intl.sanctions.tool'] },
      prompt: 'You back sovereignty and sanctions. Which holds?', explain: 'You back national sovereignty and sanctions on a sovereign country',
      resolutions: [
        { id: 'limits', text: 'Sovereignty has limits.', kind: 'condition', revise: 'intl.sovereignty.own-course' },
        { id: 'wrong', text: 'I was wrong about sanctions.', kind: 'yield', revise: 'intl.sanctions.tool' },
        { id: 'frame', text: 'Wrong framing.', kind: 'reject' },
      ],
    }),
  };
  return {
    version: '0.0.0-test',
    ontologyVersion: '1.0.0',
    base: 'https://example.org/ns/',
    problematics,
    positions: P,
    traditions: {
      'liberalism.classical': { id: 'liberalism.classical', name: 'Classical liberalism', family: 'liberalism', leaf: true, era: [1689, null], regions: [], self: 'We are the classical liberals and we believe in liberty under law, which is a long sentence.', record: [], descendsFrom: [], breaksWith: [], analysis: { conditions: 'Arose with merchant capital in England and the Netherlands.', class_base: 'Merchants, manufacturers and the professions.', function: 'Legitimates market order today for capital.' }, thinkers: [], keyTexts: [] },
      'marxism.leninism': { id: 'marxism.leninism', name: 'Leninism', family: 'marxism', leaf: true, era: [1902, null], regions: [], self: 'We are Leninists and we hold that the state is an organ of class rule, which is a long sentence.', record: [], descendsFrom: [], breaksWith: [], analysis: { conditions: 'Arose under Tsarist autocracy and late industrialization.', class_base: 'Industrial workers and revolutionary intelligentsia.', function: 'Organizes parties of revolutionary workers in the periphery.' }, thinkers: [], keyTexts: [] },
      'libertarianism.ancap': { id: 'libertarianism.ancap', name: 'Anarcho-capitalism', family: 'libertarianism', leaf: true, era: [1962, null], regions: [], self: 'We are anarcho-capitalists and we hold that the state is organized aggression, a long sentence.', record: [], descendsFrom: [], breaksWith: [], analysis: { conditions: 'Arose in the postwar United States among market radicals.', class_base: 'Small owners, tech workers and some finance.', function: 'Attacks public goods and labor law in the name of liberty.' }, thinkers: [], keyTexts: [] },
    },
    families: {},
    thinkers: {},
    events: {},
    debates: {},
    nodes: Object.fromEntries(nodes.map((n) => [n.id, n])),
    trunk: ['t.1', 't.2'],
    arcs: { 'arc.x': { id: 'arc.x', title: 'Arc X', blurb: 'A test arc with a strike.', role: 'You work here.', place: 'Somewhere', start: 'arc.x.1', escalation: 'arc.x.2', pressure: [], tags: ['economy'], nodes: ['arc.x.1', 'arc.x.2'] } },
    descents: {},
    probes: ['pb.1', 'pb.2'],
    pressure: ['pr.1'],
    modules: ['m.practice'],
    tensions,
    situation: [],
    practice: {
      'practice.union-member': { id: 'practice.union-member', text: 'A union', kind: 'organization', collective: true, drain: 'none', side: 'labor' },
      'practice.none': { id: 'practice.none', text: 'Nothing', kind: 'none', collective: false, drain: 'none', side: 'neutral' },
    },
    reach: {},
  };
}
