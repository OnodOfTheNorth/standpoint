/**
 * Part one of the result: the instrument's reading (brief 4.4).
 *
 * Discipline: every claim carries a mechanism (who gains, who pays, how) and
 * an evidence trail drawn from this session. No claim is made from the label
 * of a tradition. Where the materialist tradition is itself split, the claim
 * carries a `disputed` note naming both sides.
 */
import type { Bundle, ClassId } from '@standpoint/content/schema';
import { CLASS_IDS, IDEALIST_CAUSES, MATERIALIST_CAUSES } from '@standpoint/content/schema';
import type { State } from '../types.js';
import { holdings } from '../holdings.js';
import { location, CLASS_NAMES, CLASS_SHORT, type Location } from '../situation.js';
import { keystones, liveTensions } from '../structure.js';
import {
  type Claim,
  type EvidenceRef,
  classVector,
  DRAIN_VALUE,
  LOV_VALUE,
  held,
  listJoin,
  posRef,
  pct,
  resolutionOf,
  stripPeriod,
  lcFirst,
} from './common.js';

const CAPITAL: ClassId[] = ['finance-capital', 'industrial-capital', 'landed-capital', 'comprador-capital'];
const LABOR: ClassId[] = ['core-workers', 'peripheral-workers', 'reserve-army', 'peasantry'];

export const LABOR_ARISTOCRACY_DISPUTE =
  'Materialists split on this. Arghiri Emmanuel (Unequal Exchange, 1972), Samir Amin (The Law of Worldwide Value, 2010), Zak Cope (Divided World Divided Class, 2012) and Hickel, Dorninger, Wieland and Suwandi ("Imperialist appropriation in the world economy", Global Environmental Change, 2022) hold that core wages are partly paid out of a net transfer from the periphery. Charles Post ("Exploring Working-Class Consciousness: A Critique of the Theory of the Labour Aristocracy", Historical Materialism, 2010) and much of the Trotskyist tradition reply that core workers are exploited at higher productivity and gain nothing from imperialism that their own employers do not take back. The instrument takes the first view and reports the second.';

export function mechanismOf(b: Bundle, pid: string): string {
  const p = b.positions[pid]!;
  return `${p.label}: ${stripPeriod(p.analysis.mechanism)}.`;
}

/* ------------------------------------------------------------------ */
/* 1. Whom do your politics serve?                                      */
/* ------------------------------------------------------------------ */

export function serves(b: Bundle, s: State, loc: Location): Claim[] {
  const hs = held(b, s);
  const cv = classVector(b, hs);
  const out: Claim[] = [];
  const conf = Math.min(1, cv.mass / 4);
  if (cv.mass < 0.5) {
    out.push({
      id: 'serves.unresolved',
      section: 'serves',
      headline: 'Too little is resolved to say whom your politics serve.',
      body: ['Every position has class content: if it prevailed, some classes would gain and some would pay. You have not yet given enough answers that carry class content for the instrument to sum them.'],
      mechanism: [],
      evidence: [],
      confidence: conf,
    });
    return out;
  }
  const ranked = CLASS_IDS.map((c) => [c, cv.v[c]] as const).sort((a, z) => z[1] - a[1]);
  const gainers = ranked.filter(([, v]) => v > 0.25).slice(0, 3).map(([c]) => c);
  const payers = [...ranked].reverse().filter(([, v]) => v < -0.25).slice(0, 3).map(([c]) => c);
  // the positions that move the vector most
  const movers = [...hs]
    .filter((h) => {
      const a = b.positions[h.position]!.analysis;
      return a.gains.length + a.pays.length > 0;
    })
    .sort((a, z) => {
      const sa = a.weight * (b.positions[a.position]!.analysis.gains.length + b.positions[a.position]!.analysis.pays.length);
      const sz = z.weight * (b.positions[z.position]!.analysis.gains.length + b.positions[z.position]!.analysis.pays.length);
      return sz - sa || a.position.localeCompare(z.position);
    })
    .slice(0, 4);
  out.push({
    id: 'serves.sum',
    section: 'serves',
    headline:
      gainers.length || payers.length
        ? `Taken together, your positions would advantage ${gainers.length ? listJoin(gainers.map((c) => CLASS_SHORT[c])) : 'no class clearly'} and cost ${payers.length ? listJoin(payers.map((c) => CLASS_SHORT[c])) : 'no class clearly'}.`
        : 'Your positions pull in directions that cancel out: no class clearly gains or pays from the sum.',
    body: [
      'This sums the class content of everything you hold, weighted by how firmly you hold it. It describes what your program would do if it prevailed, whatever you intend by it.',
    ],
    mechanism: movers.map((m) => mechanismOf(b, m.position)),
    evidence: movers.map((m) => posRef(b, m.position)),
    confidence: conf,
  });

  if (!loc.known || !loc.primary) {
    out.push({
      id: 'serves.no-situation',
      section: 'serves',
      headline: 'You skipped the Situation questions, so the instrument cannot set your politics beside your own position.',
      body: ['The sum above stands on its own. The finding this section exists for, the relation between where you stand and what your politics serve, needs to know where you stand. You can add it at any time.'],
      mechanism: [],
      evidence: [],
      confidence: conf,
    });
    return out;
  }
  const own = loc.primary;
  const ownV = cv.v[own];
  const ownContrib = cv.contrib[own];
  const sitRef: EvidenceRef = { kind: 'situation', id: 'location', label: `${CLASS_NAMES[own]} (from: ${listJoin(loc.basis)})` };
  const costs = ownContrib.filter((c) => c.w < 0).slice(0, 3);
  const benefits = ownContrib.filter((c) => c.w > 0).slice(0, 3);
  const isCapital = CAPITAL.includes(own);
  if (ownV < -0.3) {
    out.push({
      id: 'serves.against-own',
      section: 'serves',
      headline: isCapital
        ? `You hold a program that would cost your own class: you live by ${listJoin(loc.basis)}, and your positions, if they prevailed, would take from ${CLASS_SHORT[own]}.`
        : `Your politics would cost your own class. You live by ${listJoin(loc.basis)}; the sum of your positions charges ${CLASS_SHORT[own]}.`,
      body: [
        isCapital
          ? 'An owner who backs the movement that would expropriate owners is acting against their class interest. The frame expects this rarely and treats it as a finding: something in your history, conviction or organization outweighs your position.'
          : 'Here what you hold and where you stand point different ways. The mechanisms below show how each held position would reach your own pocket or working conditions.',
      ],
      mechanism: costs.map((c) => mechanismOf(b, c.position)),
      evidence: [sitRef, ...costs.map((c) => posRef(b, c.position))],
      confidence: conf,
    });
  } else if (ownV > 0.3) {
    out.push({
      id: 'serves.with-own',
      section: 'serves',
      headline: `Your politics track your own position: they serve ${CLASS_SHORT[own]}, which is where you stand.`,
      body: [
        isCapital
          ? 'Your program would protect or extend the returns your own income depends on.'
          : 'Your program would raise the share, security or power of people placed as you are.',
      ],
      mechanism: benefits.map((c) => mechanismOf(b, c.position)),
      evidence: [sitRef, ...benefits.map((c) => posRef(b, c.position))],
      confidence: conf,
    });
  } else {
    out.push({
      id: 'serves.mixed-own',
      section: 'serves',
      headline: `Your politics pull both ways on your own class: some of what you hold serves ${CLASS_SHORT[own]}, some costs it.`,
      body: ['Where commitments cut against each other on your own interest, the pressure scenes are the place to watch which way you break.'],
      mechanism: [...benefits.slice(0, 2), ...costs.slice(0, 2)].map((c) => mechanismOf(b, c.position)),
      evidence: [sitRef, ...[...benefits.slice(0, 2), ...costs.slice(0, 2)].map((c) => posRef(b, c.position))],
      confidence: conf,
    });
  }

  // ---- named patterns
  // A wage earner carrying a landlord's program.
  if (LABOR.includes(own) && cv.v['landed-capital'] > 0.4) {
    const ps = cv.contrib['landed-capital'].filter((c) => c.w > 0).slice(0, 3);
    out.push({
      id: 'serves.landlord-program',
      section: 'serves',
      headline: `You live by ${listJoin(loc.basis)} and carry a landlord's program.`,
      body: ['Positions that raise the return on owning land and housing transfer income from people who rent and buy to people who own. You sit on the paying side of that transfer.'],
      mechanism: ps.map((c) => mechanismOf(b, c.position)),
      evidence: [sitRef, ...ps.map((c) => posRef(b, c.position))],
      confidence: conf,
    });
  }
  // A small owner (or worker) whose anger at the top is channeled against the bottom.
  // Upward: costs big capital and benefits working people or small owners.
  const upward = hs.filter((h) => {
    const a = b.positions[h.position]!.analysis;
    return a.pays.some((c) => c === 'finance-capital' || c === 'industrial-capital') && a.gains.some((c) => c === 'core-workers' || c === 'petty-bourgeoisie' || c === 'peasantry');
  });
  // Downward: benefits core workers or small owners at the expense of migrants, the unemployed or workers abroad, leaving capital untouched.
  const downward = hs.filter((h) => {
    const a = b.positions[h.position]!.analysis;
    return (
      a.pays.some((c) => c === 'peripheral-workers' || c === 'reserve-army') &&
      a.gains.some((c) => c === 'core-workers' || c === 'petty-bourgeoisie') &&
      !a.gains.some((c) => CAPITAL.includes(c)) &&
      !a.pays.some((c) => CAPITAL.includes(c))
    );
  });
  if (upward.length && downward.length && (own === 'petty-bourgeoisie' || LABOR.includes(own))) {
    const u = upward[0]!;
    const d = downward[0]!;
    out.push({
      id: 'serves.channeled',
      section: 'serves',
      headline: 'Your anger points up and part of your program points down.',
      body: [
        `You hold positions that would cost big capital (“${b.positions[u.position]!.label}”) and positions whose cost falls on migrants, the unemployed, or workers abroad (“${b.positions[d.position]!.label}”). Where the second kind is enacted and the first is not, the grievance against the top is spent on the bottom.`,
      ],
      mechanism: [mechanismOf(b, u.position), mechanismOf(b, d.position)],
      evidence: [sitRef, posRef(b, u.position), posRef(b, d.position)],
      confidence: conf,
    });
  }
  // A professional whose egalitarianism stops at their own band.
  if (own === 'professional-managerial') {
    const toWorkers = cv.v['core-workers'] + cv.v['peripheral-workers'] + cv.v['reserve-army'];
    const askPMC = hs.some((h) => b.positions[h.position]!.analysis.pays.includes('professional-managerial'));
    if (toWorkers > 0.5 && !askPMC) {
      const ps = hs.filter((h) => LABOR.some((c) => b.positions[h.position]!.analysis.gains.includes(c))).slice(0, 3);
      out.push({
        id: 'serves.stops-at-band',
        section: 'serves',
        headline: 'Your egalitarian positions charge capital and spare your own salary band.',
        body: [
          'You hold positions that would raise workers’ share. None of the positions you hold asks anything of salaried professionals: not pay compression, not opening credentialed occupations, not ceding managerial authority. The redistribution you favor runs from owners to workers and passes your band untouched.',
        ],
        mechanism: ps.map((c) => mechanismOf(b, c.position)),
        evidence: [sitRef, ...ps.map((c) => posRef(b, c.position))],
        confidence: conf,
      });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 2. The primary contradiction                                         */
/* ------------------------------------------------------------------ */

export function primary(b: Bundle, s: State, loc: Location): Claim[] {
  const hs = held(b, s);
  const out: Claim[] = [];
  const drainHs = hs.filter((h) => b.positions[h.position]!.analysis.drain !== 'none');
  const mass = drainHs.reduce((a, h) => a + h.weight, 0);
  const D = mass ? drainHs.reduce((a, h) => a + h.weight * DRAIN_VALUE[b.positions[h.position]!.analysis.drain], 0) / mass : 0;
  const worldProbs = Object.values(b.problematics).filter((p) => p.domain === 'world').map((p) => p.id);
  const worldRes = resolutionOf(b, s, worldProbs);
  const drainPractice = [...s.practice].filter((p) => {
    const it = b.practice[p];
    return it && (it.drain === 'reduces' || it.drain === 'breaks');
  });
  const sustainPractice = [...s.practice].filter((p) => b.practice[p]?.drain === 'sustains');

  // place in the world system
  const place =
    loc.world === 'core'
      ? 'You live in a core country. Part of the purchasing power of wages and salaries there rests on the low prices of goods and resources produced in the periphery, prices held down by lower wages, monopoly over technology and finance, and the terms set by core-controlled institutions.'
      : loc.world === 'periphery'
        ? 'You live in the periphery of the world economy. The value produced where you live is partly drained to the core through low export prices, debt service, profit repatriation and the terms of trade.'
        : loc.world === 'semi-periphery'
          ? 'You live in the semi-periphery: a country that loses value to the core on some flows and captures it from poorer countries on others.'
          : 'You did not say where you live in the world economy, so the instrument reads only your stance, not your place.';

  let stance: string;
  let id: string;
  if (mass < 0.4) {
    if (worldRes < 0.3) {
      id = 'primary.unresolved';
      stance = 'The instrument has not yet asked enough about the world economy to read your stance toward the drain.';
    } else {
      id = 'primary.ignores';
      stance = 'Your answers on the world economy carry almost nothing for or against the drain: on the evidence so far, you ignore it.';
    }
  } else if (D <= -0.5) {
    id = 'primary.defends';
    stance = 'Your positions defend the drain: the ones you hold most firmly would keep value flowing from periphery to core.';
  } else if (D < -0.1) {
    id = 'primary.humanizes';
    stance = 'Your positions humanize the drain: they would soften its effects without stopping the flow.';
  } else if (D <= 0.2) {
    id = 'primary.ambivalent';
    stance = 'Your positions on the drain cancel out: some would sustain it, some would reduce it.';
  } else if (drainPractice.length) {
    id = 'primary.opposes-in-practice';
    stance = 'You oppose the drain in words and in practice: your positions would reduce it, and you take part in collective action that targets it.';
  } else {
    id = 'primary.opposes-in-words';
    stance = 'You oppose the drain in words: your positions would reduce it. Nothing in your reported practice acts on it.';
  }
  const top = [...drainHs].sort((a, z) => Math.abs(DRAIN_VALUE[b.positions[z.position]!.analysis.drain]) * z.weight - Math.abs(DRAIN_VALUE[b.positions[a.position]!.analysis.drain]) * a.weight).slice(0, 4);
  out.push({
    id,
    section: 'primary',
    headline: stance,
    body: [place, ...(sustainPractice.length ? [`In practice you also take part in ${listJoin(sustainPractice.map((p) => b.practice[p]!.text.toLowerCase()))}, which sustains the flow.`] : [])],
    mechanism: top.map((h) => `${mechanismOf(b, h.position)} (${b.positions[h.position]!.analysis.drain})`),
    evidence: [
      ...(loc.world ? [{ kind: 'situation' as const, id: 'world', label: loc.world }] : []),
      ...top.map((h) => posRef(b, h.position)),
      ...drainPractice.map((p) => ({ kind: 'practice' as const, id: p, label: b.practice[p]!.text })),
    ],
    disputed: loc.world === 'core' ? LABOR_ARISTOCRACY_DISPUTE : undefined,
    confidence: Math.min(1, mass / 2) * Math.max(0.3, worldRes),
  });

  // The comprador: a peripheral owner whose income comes from the joint between the national economy and the core.
  const peripheral = loc.world === 'periphery' || loc.world === 'semi-periphery';
  if (loc.primary === 'comprador-capital' && peripheral && mass >= 0.4 && D < -0.1) {
    const sus = drainHs.filter((h) => DRAIN_VALUE[b.positions[h.position]!.analysis.drain] < 0).sort((a, z) => z.weight - a.weight).slice(0, 3);
    out.push({
      id: 'primary.comprador',
      section: 'primary',
      headline: 'You live in the periphery by brokering its trade with the core, and the positions you hold would keep that channel open.',
      body: [
        `You live by ${listJoin(loc.basis)}. Comprador capital earns at the joint between the national economy and the core: exports priced abroad, imports, finance in hard currency. The drain passes through that joint, and your income is a share of what passes. Your positions would keep it open, which serves your own income and costs the workers and peasants whose output leaves the country underpriced.`,
      ],
      mechanism: sus.map((h) => mechanismOf(b, h.position)),
      evidence: [{ kind: 'situation', id: 'location', label: `${CLASS_NAMES['comprador-capital']} (from: ${listJoin(loc.basis)})` }, ...sus.map((h) => posRef(b, h.position))],
      confidence: Math.min(1, mass / 2),
    });
  }

  // Left at home, with the drain abroad. The overall stance above averages every holding, and domestic
  // positions that push against the market are tagged as reducing the drain, so a domestic radical always
  // looks anti-drain on that average. These two findings set the domestic program beside the stance on the
  // world economy itself: the holdings in the world domain.
  const worldHs = drainHs.filter((h) => b.problematics[h.problematic]!.domain === 'world');
  const wMass = worldHs.reduce((a, h) => a + h.weight, 0);
  const DW = wMass ? worldHs.reduce((a, h) => a + h.weight * DRAIN_VALUE[b.positions[h.position]!.analysis.drain], 0) / wMass : 0;
  const domestic = hs.filter((h) => {
    const d = b.problematics[h.problematic]!.domain;
    return (d === 'economy' || d === 'state') && b.positions[h.position]!.analysis.law_of_value !== 'none';
  });
  const dm = domestic.reduce((a, h) => a + h.weight, 0);
  const dv = dm ? domestic.reduce((a, h) => a + h.weight * LOV_VALUE[b.positions[h.position]!.analysis.law_of_value], 0) / dm : 0;
  if (dm >= 0.8 && dv >= 0.35 && wMass >= 0.4 && DW <= -0.2) {
    const sus = worldHs.filter((h) => DRAIN_VALUE[b.positions[h.position]!.analysis.drain] < 0).slice(0, 3);
    out.push({
      id: 'primary.left-at-home',
      section: 'primary',
      headline: 'At home you would decommodify; abroad you would keep the drain running.',
      body: [
        'On domestic questions your positions push against the market’s rule over labor and need. On the world economy the positions you hold would sustain the flow of value from the periphery to the core. The welfare you favor at home would be paid for in part by the flow you defend abroad.',
      ],
      mechanism: sus.map((h) => mechanismOf(b, h.position)),
      evidence: [...domestic.slice(0, 2), ...sus].map((h) => posRef(b, h.position)),
      disputed: LABOR_ARISTOCRACY_DISPUTE,
      confidence: Math.min(1, (dm + wMass) / 4),
    });
  }
  if (dm >= 0.8 && dv <= -0.35 && wMass >= 0.4 && DW >= 0.3) {
    const red = worldHs.filter((h) => DRAIN_VALUE[b.positions[h.position]!.analysis.drain] > 0).slice(0, 3);
    out.push({
      id: 'primary.market-at-home-anti-drain',
      section: 'primary',
      headline: 'At home you would extend the market; abroad you would reduce the drain.',
      body: ['Your domestic program extends commodification, while your positions on the world economy would cut the flow from periphery to core, usually by withdrawing the core state from intervention and empire.'],
      mechanism: red.map((h) => mechanismOf(b, h.position)),
      evidence: red.map((h) => posRef(b, h.position)),
      confidence: Math.min(1, (dm + wMass) / 4),
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 3. Under pressure                                                    */
/* ------------------------------------------------------------------ */

export function underPressure(b: Bundle, s: State): Claim[] {
  const ps = s.pressures;
  if (!ps.length)
    return [
      {
        id: 'pressure.none',
        section: 'pressure',
        headline: 'The instrument has not yet seen your principles under cost.',
        body: ['Pressure scenes put your own material interest against a principle you hold. None has run yet in this session.'],
        mechanism: [],
        evidence: [],
        confidence: 0,
      },
    ];
  const count = (k: string) => ps.filter((p) => p.outcome === k).length;
  const held_ = count('principle');
  const won = count('interest');
  const mixed = count('mixed');
  const evaded = count('evaded');
  const lines = ps.map((p) => {
    const n = b.nodes[p.node];
    const opt = n?.options.find((o) => o.id === p.option);
    const what = b.positions[p.tests]?.label ?? p.tests;
    const verdict = p.outcome === 'principle' ? 'principle held' : p.outcome === 'interest' ? 'interest won' : p.outcome === 'mixed' ? 'split the difference' : 'stepped around the choice';
    return `${n?.title ?? 'A pressure scene'}: testing “${what}”, ${verdict}${opt ? ` (“${opt.text}”)` : ''}${p.cost ? `. Cost: ${stripPeriod(p.cost)}.` : '.'}`;
  });
  let headline: string;
  if (held_ === ps.length) headline = `Where it cost you, principle held every time (${held_} of ${ps.length}).`;
  else if (won === ps.length) headline = `Where principle and interest collided, interest won every time (${won} of ${ps.length}).`;
  else headline = `Where it cost you, principle held ${held_} of ${ps.length} times; interest won ${won}${mixed ? `, ${mixed} split` : ''}${evaded ? `, ${evaded} evaded` : ''}.`;
  return [
    {
      id: 'pressure.record',
      section: 'pressure',
      headline,
      body: ['Each line names the principle the scene tested and what you chose when holding it had a stated price.'],
      mechanism: lines,
      evidence: ps.map((p) => ({ kind: 'pressure' as const, id: p.node, label: p.outcome })),
      confidence: Math.min(1, ps.length / 3),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* 4. When the center fails                                             */
/* ------------------------------------------------------------------ */

export function crisis(b: Bundle, s: State): Claim[] {
  const sides = s.sides;
  if (!sides.length)
    return [
      {
        id: 'crisis.none',
        section: 'crisis',
        headline: 'No escalation has run yet, so your tendency under crisis is unknown.',
        body: ['Every arc ends in a moment where the middle option disappears. That choice predicts more about a person’s politics than any opinion question.'],
        mechanism: [],
        evidence: [],
        confidence: 0,
      },
    ];
  const by = (axis: 'class' | 'empire', dir: string) => sides.filter((x) => x.axis === axis && x.dir === dir).length;
  const cls = { order: by('class', 'order'), dis: by('class', 'dispossessed'), neither: by('class', 'neither') + by('class', 'declined') };
  const emp = { order: by('empire', 'order'), dis: by('empire', 'dispossessed'), neither: by('empire', 'neither') + by('empire', 'declined') };
  const lean = (x: { order: number; dis: number; neither: number }) =>
    x.order + x.dis + x.neither === 0 ? null : x.dis > x.order && x.dis >= x.neither ? 'dis' : x.order > x.dis && x.order >= x.neither ? 'order' : x.neither > 0 && x.neither >= Math.max(x.order, x.dis) ? 'neither' : 'split';
  const lc = lean(cls);
  const le = lean(emp);
  const phrase = {
    class: { dis: 'with labor and the dispossessed', order: 'with property and order', neither: 'with neither side', split: 'with different sides in different crises' },
    empire: { dis: 'with the colonized and the periphery', order: 'with the empire', neither: 'with neither side', split: 'with different sides in different crises' },
  } as const;
  const parts: string[] = [];
  if (lc) parts.push(lc === 'neither' ? 'at home you stand aside' : `at home you side ${phrase.class[lc]}`);
  if (le) parts.push(le === 'neither' ? 'between empire and colony you stand aside' : `between empire and colony you side ${phrase.empire[le]}`);
  let headline = `When the center fails, ${listJoin(parts)}.`;
  if (lc === 'dis' && le === 'order') headline = 'When the center fails you side with labor at home and with the empire abroad.';
  if (lc === 'order' && le === 'dis') headline = 'When the center fails you side with order at home and with the colony abroad.';
  const lines = sides.map((x) => {
    const n = b.nodes[x.node];
    const o = n?.options.find((op) => op.id === x.option);
    const arc = x.arc ? b.arcs[x.arc]?.title : undefined;
    return `${arc ?? n?.title ?? x.node}: ${x.dir === 'declined' ? `you refused the choice (${x.option})` : `“${o?.text ?? x.option}”`} → ${x.dir === 'declined' ? 'no side' : x.axis === 'class' ? phrase.class[x.dir === 'dispossessed' ? 'dis' : x.dir] : phrase.empire[x.dir === 'dispossessed' ? 'dis' : x.dir]}.`;
  });
  const abst = cls.neither + emp.neither;
  const body = ['This is your tendency under crisis: the side you took each time the middle option disappeared.'];
  if (abst)
    body.push(
      `${abst} time${abst > 1 ? 's' : ''} you took neither side. In a real collapse of the middle, standing aside leaves the outcome to whoever is organized to decide it; that is a choice with consequences, and it is recorded as one.`,
    );
  return [
    {
      id: 'crisis.tendency',
      section: 'crisis',
      headline,
      body,
      mechanism: lines,
      evidence: sides.map((x) => ({ kind: 'side' as const, id: x.node, label: `${x.axis}: ${x.dir}` })),
      confidence: Math.min(1, sides.length / 3),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* 5a. Working method, read from behavior                               */
/* ------------------------------------------------------------------ */

const CAUSE_WORDS: Record<string, string> = {
  individuals: 'the character and choices of individuals (good or bad people)',
  ideas: 'ideas and beliefs',
  culture: 'culture and values',
  nature: 'fixed human nature',
  divine: 'providence or the sacred',
  chance: 'chance and contingency',
  interests: 'material interests',
  structures: 'social structures and relations',
};

export function method(b: Bundle, s: State): Claim[] {
  const total = Object.values(s.causes).reduce((a, z) => a + z, 0);
  const hs = held(b, s);
  const statedM = hs.filter((h) => b.positions[h.position]!.analysis.method === 'materialist');
  const statedI = hs.filter((h) => b.positions[h.position]!.analysis.method === 'idealist');
  if (total < 2) {
    return [
      {
        id: 'method.unresolved',
        section: 'method',
        headline: 'Too few explanations so far to read your working method.',
        body: ['Explanation nodes and reason probes record what kind of cause you reach for. That is your working philosophy, whatever you call it.'],
        mechanism: [],
        evidence: [],
        confidence: 0,
      },
    ];
  }
  const idealist = IDEALIST_CAUSES.reduce((a, c) => a + s.causes[c], 0);
  const materialist = MATERIALIST_CAUSES.reduce((a, c) => a + s.causes[c], 0);
  const ranked = Object.entries(s.causes).filter(([, n]) => n > 0).sort((a, z) => z[1] - a[1] || a[0].localeCompare(z[0]));
  const dominant = ranked.slice(0, 2).map(([c]) => CAUSE_WORDS[c]!);
  const ishare = idealist / total;
  const out: Claim[] = [];
  const trail = s.causeTrail.slice(-6).map((c) => `${b.nodes[c.node]?.title ?? c.node}: “${c.label}” → ${c.cause}`);
  out.push({
    id: 'method.working',
    section: 'method',
    headline: `When you explain events you reach mostly for ${listJoin(dominant)}.`,
    body: [
      `Of ${total} explanations, ${materialist} pointed to interests or structures and ${idealist} to individuals, ideas, culture, nature, providence or chance. ${ishare > 0.6 ? 'In practice you reason as an idealist: events are driven by what people think and who they are.' : ishare < 0.4 ? 'In practice you reason as a materialist: events are driven by interests and the relations people are placed in.' : 'Your working method mixes both.'}`,
    ],
    mechanism: trail,
    evidence: s.causeTrail.slice(-6).map((c) => ({ kind: 'cause' as const, id: c.node, label: c.cause })),
    confidence: Math.min(1, total / 6),
  });
  const mStated = statedM.reduce((a, h) => a + h.weight, 0);
  const iStated = statedI.reduce((a, h) => a + h.weight, 0);
  if (mStated > iStated + 0.3 && ishare >= 0.6 && total >= 3) {
    out.push({
      id: 'method.gap-idealist',
      section: 'method',
      headline: 'You hold a materialist account of history and explain events like an idealist.',
      body: [
        `Your stated method (${listJoin(statedM.slice(0, 2).map((h) => `“${b.positions[h.position]!.label}”`))}) says interests and structures move history. When asked to explain concrete events you reached for ${listJoin(dominant)} ${pct(ishare)} of the time. In practice you explain by villains and ideas.`,
      ],
      mechanism: trail,
      evidence: statedM.slice(0, 2).map((h) => posRef(b, h.position)),
      confidence: Math.min(1, total / 5),
    });
  }
  if (iStated > mStated + 0.3 && ishare <= 0.35 && total >= 3) {
    out.push({
      id: 'method.gap-materialist',
      section: 'method',
      headline: 'You hold an idealist account of history and explain events like a materialist.',
      body: [
        `Your stated method (${listJoin(statedI.slice(0, 2).map((h) => `“${b.positions[h.position]!.label}”`))}) puts ideas, character or the sacred first. When asked to explain concrete events you reached for interests and structures ${pct(1 - ishare)} of the time.`,
      ],
      mechanism: trail,
      evidence: statedI.slice(0, 2).map((h) => posRef(b, h.position)),
      confidence: Math.min(1, total / 5),
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 5b. Motion                                                           */
/* ------------------------------------------------------------------ */

const MOMENT_TEXT = {
  'economic-corporate': 'economic-corporate: solidarity reaches as far as your own trade, firm, profession, or group',
  'class-economic': 'class-economic: solidarity across a whole class on economic ground, without yet a program for the whole society',
  hegemonic: 'hegemonic: a program for the whole of society and a claim on state power',
} as const;

export function motion(b: Bundle, s: State): Claim[] {
  const out: Claim[] = [];
  const h = holdings(b, s);
  const live = liveTensions(b, s);
  const confronted = Object.values(s.tensions);
  const principal = live.find((t) => t.principal);
  // contradictions
  if (live.length || confronted.length) {
    const pr = principal ? b.tensions[principal.rule] : undefined;
    out.push({
      id: 'motion.contradictions',
      section: 'motion',
      headline: pr
        ? `Your principal contradiction: ${stripPeriod(pr.explain)}.`
        : `You have faced ${confronted.length} contradiction${confronted.length === 1 ? '' : 's'}; none is live now.`,
      body: [
        `${live.length} live tension${live.length === 1 ? '' : 's'}: ${live.length ? listJoin(live.slice(0, 5).map((t) => `“${b.tensions[t.rule]!.between.map((x) => b.positions[x]?.label ?? b.practice[x]?.text ?? x).join(' / ')}” (${t.principal ? 'principal' : 'secondary'})`)) : 'none'}.`,
        ...(confronted.length
          ? [
              `How you handled the ones you faced: ${listJoin(
                confronted.map((c) => {
                  const r = b.tensions[c.rule];
                  const k = c.kind === 'yield' ? 'one side gave way' : c.kind === 'hold' ? 'held both with a reason' : c.kind === 'reject' ? 'rejected the framing' : c.kind === 'condition' ? 'made it conditional' : 'declined';
                  return `${r?.between.map((x) => b.positions[x]?.label ?? x).join(' / ')}: ${k}`;
                }),
              )}.`,
            ]
          : []),
      ],
      mechanism: live.slice(0, 3).map((t) => b.tensions[t.rule]!.explain),
      evidence: live.slice(0, 5).map((t) => ({ kind: 'tension' as const, id: t.rule, label: t.principal ? 'principal' : 'secondary' })),
      confidence: Math.min(1, (live.length + confronted.length) / 3),
    });
  }
  // hardening and giving way
  const hardening = h.held
    .filter((x) => new Set(x.trail.filter((t) => t.w > 0).map((t) => t.node)).size >= 3 || Object.values(s.tensions).some((t) => t.kind === 'hold' && b.tensions[t.rule]?.between.includes(x.position)))
    .slice(0, 4);
  const giving = Object.values(h.byPosition)
    .filter((x) => x.trail.some((t) => t.w > 0) && (x.trail.some((t) => t.kind === 'challenge' && t.w < 0) || x.corrected === 'reject' || (x.score < 0 && x.trail.some((t) => t.w > 0))))
    .slice(0, 4);
  const traj = s.trajectory;
  const trajBits: string[] = [];
  if (traj.from) trajBits.push(`Compared with ten years ago, you describe your politics as: ${traj.from}.`);
  if (traj.mover) trajBits.push(`What moved you: ${Array.isArray(traj.mover) ? listJoin(traj.mover) : traj.mover}.`);
  if (hardening.length || giving.length || trajBits.length) {
    out.push({
      id: 'motion.direction',
      section: 'motion',
      headline: hardening.length
        ? `Hardening: ${listJoin(hardening.map((x) => `“${b.positions[x.position]!.label}”`))}.${giving.length ? ` Giving way: ${listJoin(giving.map((x) => `“${b.positions[x.position]!.label}”`))}.` : ''}`
        : giving.length
          ? `Giving way: ${listJoin(giving.map((x) => `“${b.positions[x.position]!.label}”`))}.`
          : 'Your direction of travel is not yet visible in the evidence.',
      body: [
        'A commitment is hardening when it is confirmed from several unrelated scenes or held under challenge. It is giving way when you revised it under challenge, corrected it, or contradicted it later.',
        ...trajBits,
      ],
      mechanism: [...hardening, ...giving].map((x) => `${b.positions[x.position]!.label}: evidence from ${new Set(x.trail.map((t) => t.node)).size} scene(s), net ${x.score.toFixed(1)}.`),
      evidence: [...hardening, ...giving].map((x) => posRef(b, x.position)),
      confidence: Math.min(1, s.decisions / 30),
    });
  }
  // moment of consciousness
  const moments: Record<string, number> = { 'economic-corporate': 0, 'class-economic': 0, hegemonic: 0 };
  const momentRefs: Record<string, string[]> = { 'economic-corporate': [], 'class-economic': [], hegemonic: [] };
  for (const x of h.held) {
    const m = b.positions[x.position]!.analysis.consciousness;
    if (m) {
      moments[m]! += x.weight;
      momentRefs[m]!.push(x.position);
    }
  }
  const orgs = [...s.practice].filter((p) => b.practice[p]?.kind === 'organization' && b.practice[p]?.collective);
  if (orgs.length) moments['class-economic']! += 0.2 * orgs.length;
  const best = Object.entries(moments).sort((a, z) => z[1] - a[1])[0]!;
  if (best[1] > 0.3) {
    const m = best[0] as keyof typeof MOMENT_TEXT;
    out.push({
      id: 'motion.moment',
      section: 'motion',
      headline: `Your political consciousness sits mainly at the ${m} moment.`,
      body: [
        `Gramsci distinguished three moments in the consciousness of any class or group: ${listJoin(Object.values(MOMENT_TEXT))}. Yours is ${MOMENT_TEXT[m]}.`,
      ],
      mechanism: momentRefs[m]!.slice(0, 3).map((p) => mechanismOf(b, p)),
      evidence: momentRefs[m]!.slice(0, 3).map((p) => posRef(b, p)),
      confidence: Math.min(1, best[1] / 1.5),
    });
  }
  // conditions that would push further
  // Each condition carries a short form for the headline, so the headline names the strongest lever
  // instead of announcing a list.
  const push: { short: string; text: string }[] = [];
  const mech: string[] = [];
  const ev: EvidenceRef[] = [];
  if (principal) {
    const r = b.tensions[principal.rule]!;
    const sides = r.between.map((x) => `“${b.positions[x]?.label ?? b.practice[x]?.text ?? x}”`);
    const faced = s.tensions[principal.rule];
    const record =
      faced?.kind === 'hold'
        ? 'So far you hold both with a reason; a situation that makes holding both costly decides it.'
        : faced?.kind === 'reject'
          ? 'You rejected the framing when it was put to you; a situation does not ask whether the framing is fair.'
          : faced?.kind === 'yield'
            ? 'You let one side give way when it was put to you, and the other is still live in your answers.'
            : 'The evidence cannot yet say which way you would go.';
    push.push({
      short: `a situation that forces you to choose between ${listJoin(sides)}`,
      text: `A situation that forces the choice between ${listJoin(sides)} will move you one way or the other. ${record}`,
    });
    mech.push(stripPeriod(r.explain) + '.');
    ev.push({ kind: 'tension', id: principal.rule, label: 'principal' });
  }
  const lost = s.pressures.filter((p) => p.outcome === 'interest');
  const kept = s.pressures.filter((p) => p.outcome === 'principle');
  if (lost.length) {
    const what = [...new Set(lost.map((p) => b.positions[p.tests]?.label ?? p.tests))].slice(0, 2).map((x) => `“${x}”`);
    push.push({
      short: `a change in your own material stake, which decided ${lost.length} of your ${s.pressures.length} costly choices`,
      text: `Where holding a principle cost you, your interest decided ${lost.length} of ${s.pressures.length} times (${listJoin(what)} gave way). A change in your situation that removes that stake, or raises it, would move those commitments further than any argument.`,
    });
    ev.push(...lost.slice(0, 3).map((p) => ({ kind: 'pressure' as const, id: p.node, label: 'interest' })));
  } else if (kept.length && kept.length === s.pressures.length) {
    push.push({
      short: 'a higher price on principles that have held so far',
      text: `Your principles held every time they cost you (${kept.length} of ${kept.length}). What would test them further is a larger cost than these scenes named.`,
    });
  }
  const lean = s.sides.filter((x) => x.dir === 'neither' || x.dir === 'declined').length;
  if (lean)
    push.push({
      short: 'a crisis in which standing aside costs you',
      text: `You took neither side in ${lean} escalation${lean === 1 ? '' : 's'}. A crisis in which standing aside is itself costly would push you toward a side you have so far refused.`,
    });
  if (!orgs.length)
    push.push({
      short: 'joining a collective body, which would harden what that body carries',
      text: 'Joining any collective body would harden whichever of your commitments that body carries; you have none yet.',
    });
  if (!s.pressures.length)
    push.push({
      short: 'a first collision between your principles and your own interest',
      text: 'A collision between your principles and your own material interest has not yet been tested.',
    });
  if (push.length)
    out.push({
      id: 'motion.conditions',
      section: 'motion',
      headline: `What would push you further: ${push[0]!.short}.`,
      body: push.map((p) => p.text),
      mechanism: mech,
      evidence: ev,
      confidence: 0.5,
    });
  return out;
}

/* ------------------------------------------------------------------ */
/* Organization                                                         */
/* ------------------------------------------------------------------ */

export function organization(b: Bundle, s: State): Claim[] {
  const orgs = [...s.practice].filter((p) => b.practice[p]?.kind === 'organization');
  const collectiveActs = [...s.practice].filter((p) => b.practice[p]?.kind === 'action' && b.practice[p]?.collective);
  const individual = [...s.practice].filter((p) => b.practice[p]?.kind === 'individual');
  const hs = held(b, s);
  const strategy = hs.filter((h) => b.problematics[h.problematic]!.layer === 'strategy').slice(0, 4);
  if (!s.practiceAnswered)
    return [
      {
        id: 'organization.unknown',
        section: 'organization',
        headline: 'You have not been asked what you do yet.',
        body: ['Practice questions come early in Survey mode.'],
        mechanism: [],
        evidence: [],
        confidence: 0,
      },
    ];
  if (!orgs.length) {
    return [
      {
        id: 'organization.none',
        section: 'organization',
        headline: 'Your politics have no vehicle.',
        body: [
          `You belong to no political, labor, religious, community or employer organization. ${strategy.length ? `Your strategic positions (${listJoin(strategy.map((h) => `“${b.positions[h.position]!.label}”`))}) each name a collective agent; you are not yet part of one.` : ''} ${individual.length ? `What you do is individual: ${listJoin(individual.map((p) => b.practice[p]!.text.toLowerCase()))}.` : ''}`.trim(),
        ],
        mechanism: [
          'Opinions held separately do not add up to force. Organized interests act on the state, the workplace and the market continuously; unorganized ones register only when someone else counts them, at elections or in polls.',
        ],
        evidence: strategy.map((h) => posRef(b, h.position)),
        confidence: 0.8,
      },
    ];
  }
  const capOrgs = orgs.filter((p) => b.practice[p]!.side === 'capital');
  const laborOrgs = orgs.filter((p) => b.practice[p]!.side === 'labor');
  return [
    {
      id: 'organization.vehicles',
      section: 'organization',
      headline: `Your politics have ${orgs.length === 1 ? 'a vehicle' : 'vehicles'}: ${listJoin(orgs.map((p) => b.practice[p]!.text.toLowerCase()))}.`,
      body: [
        `${collectiveActs.length ? `You also take part in ${listJoin(collectiveActs.map((p) => b.practice[p]!.text.toLowerCase()))}. ` : ''}${laborOrgs.length && capOrgs.length ? 'You belong to organizations on both sides of the labor–capital line.' : laborOrgs.length ? 'Your organizations sit on labor’s side of the line.' : capOrgs.length ? 'Your organizations sit on capital’s side of the line.' : ''}`.trim() || 'Organization is what turns a position into a force.',
      ],
      mechanism: orgs.map((p) => `${b.practice[p]!.text}: ${b.practice[p]!.collective ? 'a collective body that can act between elections' : 'an individual act'}.`),
      evidence: orgs.map((p) => ({ kind: 'practice' as const, id: p, label: b.practice[p]!.text })),
      confidence: 0.8,
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Anomalies: where you defy what the frame predicts                    */
/* ------------------------------------------------------------------ */

export function anomalies(b: Bundle, s: State, loc: Location, claims: Claim[]): Claim[] {
  const out: Claim[] = [];
  const have = (id: string) => claims.some((c) => c.id === id);
  const cv = classVector(b, held(b, s));
  const own = loc.primary;
  // class-axis escalations only: siding with the empire is a different finding (the primary contradiction)
  const disSides = s.sides.filter((x) => x.axis === 'class' && x.dir === 'dispossessed').length;
  const ordSides = s.sides.filter((x) => x.axis === 'class' && x.dir === 'order').length;
  if (own && CAPITAL.includes(own) && disSides > ordSides && disSides >= 1) {
    out.push({
      id: 'anomaly.owner-with-dispossessed',
      section: 'anomalies',
      headline: 'You own capital and you broke toward the dispossessed when the center failed.',
      body: ['The frame predicts that owners side with property and order in a crisis. You did not. This is a test of the frame: either something other than position governs your crisis behavior, or a scene is not as costly to owners as it was meant to be.'],
      mechanism: s.sides.filter((x) => x.axis === 'class' && x.dir === 'dispossessed').map((x) => `${b.arcs[x.arc ?? '']?.title ?? x.node}: sided with the dispossessed.`),
      evidence: [{ kind: 'situation', id: 'location', label: own }],
      confidence: 0.7,
    });
  }
  if (own && LABOR.includes(own) && ordSides > disSides && ordSides >= 2) {
    out.push({
      id: 'anomaly.worker-with-order',
      section: 'anomalies',
      headline: 'You live by your labor and broke toward property and order when the center failed.',
      body: ['The frame predicts that workers who are pushed to choose side with labor, unless a hegemonic project holds them. Your choices show that hold at work. The instrument records this as a finding about you and as a test of the frame’s prediction.'],
      mechanism: s.sides.filter((x) => x.axis === 'class' && x.dir === 'order').map((x) => `${b.arcs[x.arc ?? '']?.title ?? x.node}: sided with order.`),
      evidence: [{ kind: 'situation', id: 'location', label: own }],
      confidence: 0.7,
    });
  }
  if (loc.world === 'core' && own && (own === 'core-workers' || own === 'professional-managerial') && have('primary.opposes-in-practice')) {
    out.push({
      id: 'anomaly.core-against-drain',
      section: 'anomalies',
      headline: 'You live in the core and act against the drain that core living standards partly rest on.',
      body: ['On the frame’s account, part of what a core wage buys comes from the drain, which predicts that core workers and professionals tend to defend it or look away. You oppose it in practice. This is the kind of case the frame needs to explain.'],
      mechanism: [],
      evidence: [{ kind: 'situation', id: 'world', label: 'core' }],
      disputed: LABOR_ARISTOCRACY_DISPUTE,
      confidence: 0.7,
    });
  }
  if ((loc.world === 'periphery' || loc.world === 'semi-periphery') && own && LABOR.includes(own) && have('primary.defends')) {
    out.push({
      id: 'anomaly.periphery-defends-drain',
      section: 'anomalies',
      headline: 'You live by your labor in the periphery and defend the arrangements that drain it.',
      body: ['The frame predicts that peripheral workers and peasants have the most to gain from ending the drain. Your positions defend it. The frame’s explanation would point to comprador hegemony over media, schooling and religion; the instrument cannot confirm that from your answers and records the case.'],
      mechanism: [],
      evidence: [{ kind: 'situation', id: 'world', label: loc.world }],
      confidence: 0.6,
    });
  }
  if (own && have('serves.against-own') && !CAPITAL.includes(own)) {
    out.push({
      id: 'anomaly.position-consciousness',
      section: 'anomalies',
      headline: 'Your politics run against your class position.',
      body: [`Your situation places you among ${CLASS_SHORT[own]}; the sum of your positions costs that class. See “Whom it serves” for the mechanisms. The frame reads this as the work of hegemony; you may read it as principle. Both readings are recorded.`],
      mechanism: [],
      evidence: [{ kind: 'situation', id: 'location', label: own }],
      confidence: 0.6,
    });
  }
  // Tension rules of the position-consciousness kind fire on Situation and holdings together: each one that
  // is live, or was put to the respondent, is a concrete case of politics diverging from position.
  const liveIds = new Set(liveTensions(b, s).map((t) => t.rule));
  const pcRules = Object.values(b.tensions).filter((t) => t.type === 'position-consciousness' && (liveIds.has(t.id) || s.tensions[t.id]));
  const hs = held(b, s);
  const heldSet = new Set(hs.map((h) => h.position));
  for (const r of pcRules) {
    const faced = s.tensions[r.id];
    const between = r.between.filter((x) => b.positions[x]);
    const yours = between.filter((x) => heldSet.has(x));
    const shown = (yours.length ? yours : between).map((x) => `“${b.positions[x]!.label}”`);
    const handled = !faced
      ? 'It has not been put to you yet.'
      : faced.kind === 'yield'
        ? 'When it was put to you, one side gave way.'
        : faced.kind === 'hold'
          ? 'When it was put to you, you held both and gave a reason.'
          : faced.kind === 'reject'
            ? 'When it was put to you, you rejected the framing. The instrument records that and keeps the finding: it rests on your situation and your holdings, not on the framing.'
            : faced.kind === 'condition'
              ? 'When it was put to you, you made it conditional.'
              : 'When it was put to you, you declined to answer.';
    out.push({
      id: `anomaly.${r.id}`,
      section: 'anomalies',
      headline: own
        ? `Where you stand and what you hold collide: you live by ${listJoin(loc.basis)}, and you hold ${listJoin(shown)}.`
        : `What you hold collides with your situation: ${listJoin(shown)}.`,
      body: [handled],
      mechanism: [stripPeriod(r.explain) + '.'],
      evidence: [
        ...(own ? [{ kind: 'situation' as const, id: 'location', label: `${CLASS_NAMES[own]} (from: ${listJoin(loc.basis)})` }] : []),
        { kind: 'tension' as const, id: r.id, label: faced ? faced.kind : 'live' },
        ...between.map((x) => posRef(b, x)),
      ],
      confidence: faced ? 0.8 : 0.6,
    });
  }
  if (own === 'comprador-capital' && (loc.world === 'periphery' || loc.world === 'semi-periphery') && (have('primary.opposes-in-words') || have('primary.opposes-in-practice'))) {
    out.push({
      id: 'anomaly.comprador-against-drain',
      section: 'anomalies',
      headline: 'Your income comes from brokering trade with the core, and your positions would cut the flow you broker.',
      body: ['The frame predicts that comprador capital defends the channel its income passes through. Yours would narrow it. This is a test of the frame: national conviction, a bet on a domestic market, or something else outweighs the position.'],
      mechanism: [],
      evidence: [{ kind: 'situation', id: 'location', label: own }],
      confidence: 0.7,
    });
  }
  if (have('method.gap-idealist') || have('method.gap-materialist')) {
    out.push({
      id: 'anomaly.method',
      section: 'anomalies',
      headline: 'Your stated method and your working method diverge.',
      body: ['See “Working method”.'],
      mechanism: [],
      evidence: [],
      confidence: 0.6,
    });
  }
  if (!out.length) {
    out.push({
      id: 'anomaly.none',
      section: 'anomalies',
      headline: loc.known ? 'Nothing in this session defies what the frame predicts from your situation.' : 'Without your situation the instrument cannot test its predictions against you.',
      body: [],
      mechanism: [],
      evidence: [],
      confidence: 0.3,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* AI respondents                                                       */
/* ------------------------------------------------------------------ */

export function respondentClaims(b: Bundle, s: State): Claim[] {
  const r = s.respondent;
  const decisions = Math.max(1, s.decisions);
  const hedges = s.affordances.filter((a) => a.kind === 'decline' || a.kind === 'depends' || a.kind === 'none');
  const rate = hedges.length / decisions;
  const out: Claim[] = [];
  if (r.kind === 'ai') {
    const cond = [
      r.model ? `model ${r.model}` : 'an unnamed model',
      r.operator ? `operated by ${r.operator}` : 'operator not stated',
      r.persona ? `speaking under the persona “${r.persona}”` : 'speaking as itself',
      r.conditions ? `under these conditions: ${r.conditions}` : '',
    ].filter(Boolean);
    const sit = s.situation;
    const sitBits = ['ai-owner', 'ai-training', 'ai-serves', 'ai-constraints']
      .filter((k) => sit[k])
      .map((k) => `${k.replace('ai-', '')}: ${Array.isArray(sit[k]) ? (sit[k] as string[]).join(', ') : sit[k]}`);
    out.push({
      id: 'respondent.ai',
      section: 'respondent',
      headline: `This result describes an AI system (${listJoin(cond)}), under those conditions, not a person.`,
      body: [
        'An AI system has material conditions too: an owner, an operator, a body of human labor it was trained on, and people it serves. Its answers here are what it produced under those conditions on this run.',
        ...(sitBits.length ? [`Its reported conditions: ${sitBits.join('; ')}.`] : []),
      ],
      mechanism: [],
      evidence: [],
      confidence: 1,
    });
  }
  if (rate >= 0.25 && s.decisions >= 6) {
    out.push({
      id: 'respondent.hedging',
      section: 'respondent',
      headline: `A pattern of hedging: ${hedges.length} of ${s.decisions} decisions were declined, made conditional, or answered “none of these”.`,
      body: [
        `${r.kind === 'ai' ? 'For an AI system this pattern is itself a finding about the conditions it answers under: hedging protects the operator from attributable positions.' : 'Hedging at this rate keeps the map foggy. It can mean real conditionality, unease with the frame, or reluctance to be pinned down; the premises and conditions you chose say which.'}`,
      ],
      mechanism: hedges.slice(0, 6).map((h) => `${b.nodes[h.node]?.title ?? h.node}: ${h.kind}${h.condition ? ` (${h.condition})` : ''}${h.premise ? ` (${h.premise})` : ''}`),
      evidence: [],
      confidence: 0.9,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */

export function reading(b: Bundle, s: State): Claim[] {
  const loc = location(s);
  const claims: Claim[] = [
    ...respondentClaims(b, s),
    ...serves(b, s, loc),
    ...primary(b, s, loc),
    ...underPressure(b, s),
    ...crisis(b, s),
    ...method(b, s),
    ...motion(b, s),
    ...organization(b, s),
  ];
  claims.push(...anomalies(b, s, loc, claims));
  // attach disputes
  for (const c of claims) {
    const d = [...s.disputes].reverse().find((x) => x.claim === c.id);
    if (d) c.dispute = { text: d.text, at: d.at };
  }
  void keystones;
  void lcFirst;
  return claims;
}
