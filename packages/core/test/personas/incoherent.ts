/**
 * Common-sense, incoherent and apolitical personas (brief 4.3: "assuming coherence" is a default error).
 * They hold fragments from different traditions, decline often, and belong to nothing much. The suite
 * asserts that their runs complete and still produce a reading, not that they land in a tradition.
 */
import type { Persona } from './policy.js';

export const riggedCabbie: Persona = {
  id: 'cs-rigged-cabbie',
  name: 'Cab driver who thinks the game is rigged',
  traditions: ['commonsense.rigged'],
  targets: {
    'cs.rigged.system-rigged': 3,
    'profit.legitimacy.fair-not-gouging': 2,
    'state.nature.captured': 2,
    'cs.decline.sold-out': 2,
    'crisis.cause.greed-and-recklessness': 2,
    'finance.control.no-bailouts': 2,
    'cs.politicians.all-crooks': 2,
    'borders.migration.restrict-national': 1,
    'cs.taxes.workers-pay-rich-dodge': 2,
    'cs.hard-work.effort-pays': 1,
    'police.role.order-maintenance': 1,
  },
  situation: { income: 'own-account', sector: 'logistics', world: 'core', housing: 'rent', debt: 'consumer' },
  practice: ['vote', 'post'],
  breaks: 'neither',
  underPressure: 'interest',
  reachesFor: 'individuals',
  onTension: 'reject',
  origin: 'work',
  declineRate: 0.15,
  expect: ['cs.politicians.all-crooks', 'crisis.cause.greed-and-recklessness'],
};

export const ownFirstMother: Persona = {
  id: 'cs-own-first',
  name: 'Care worker who looks after her own first',
  traditions: ['commonsense.look-after-your-own'],
  targets: {
    'cs.own-first.family-first': 3,
    'picket.line.need-first': 3,
    'borders.migration.legal-and-contributing': 2,
    'welfare.state.for-our-own': 2,
    'cs.taxes.paid-in': 2,
    'labor.division.outsiders-undercut-us': 1,
    'health.care.national-service': 2,
    'housing.tenure.social-housing': 1,
    'cs.not-political.keep-head-down': 1,
  },
  situation: { income: ['wages', 'transfers'], employment: 'precarious', sector: 'care-health', world: 'core', housing: 'social-housing', gender: 'woman' },
  practice: ['congregation', 'vote'],
  breaks: 'neither',
  underPressure: 'interest',
  reachesFor: 'individuals',
  onTension: 'yield',
  origin: 'family',
  declineRate: 0.2,
  expect: ['picket.line.need-first', 'borders.migration.legal-and-contributing'],
};

export const antiPolitics: Persona = {
  id: 'cs-anti-politics',
  name: 'Apolitical night-shift worker',
  traditions: ['commonsense.anti-politics'],
  targets: {
    'cs.politicians.all-crooks': 3,
    'change.possibility.power-always-wins': 3,
    'cs.clean-house.throw-them-all-out': 2,
    'org.form.no-organization': 2,
    'cs.not-political.keep-head-down': 3,
    'siege.governance.siege-as-pretext': 1,
    'cs.not-political.everything-political': -3,
  },
  situation: { income: 'wages', employment: 'temporary', sector: 'retail-hospitality', world: 'core', housing: 'rent' },
  practice: [],
  breaks: 'neither',
  underPressure: 'interest',
  reachesFor: 'individuals',
  onTension: 'reject',
  origin: 'work',
  declineRate: 0.45,
  expect: ['change.possibility.power-always-wins', 'cs.not-political.keep-head-down'],
};

export const liveAndLetLive: Persona = {
  id: 'cs-live-let-live',
  name: 'Live-and-let-live retiree',
  traditions: ['commonsense.live-and-let-live'],
  targets: {
    'cs.live-let-live.leave-alone': 3,
    'workplace.conflict.depends-on-the-boss': 2,
    'cs.middle.split-the-difference': 2,
    'cs.middle.not-sure': 1,
    'cs.not-political.keep-head-down': 2,
  },
  situation: { income: 'transfers', employment: 'retired', world: 'core', housing: 'own-outright', generation: 'pre-1960' },
  practice: ['vote'],
  breaks: 'neither',
  underPressure: 'mixed',
  reachesFor: 'chance',
  onTension: 'reject',
  origin: 'family',
  declineRate: 0.35,
};

export const selfReliantShopkeeper: Persona = {
  id: 'cs-self-reliance',
  name: 'Self-reliant shopkeeper',
  traditions: ['commonsense.self-reliance'],
  targets: {
    'change.means.individual-exit': 3,
    'inequality.justice.earned-desert': 3,
    'cs.hard-work.effort-pays': 3,
    'debt.household.personal-responsibility': 2,
    'property.private.earned-is-mine': 2,
    'equality.concept.opportunity': 2,
    'cs.taxes.taken-and-wasted': 2,
    'cs.rigged.system-rigged': -2,
    'cs.hard-work.others-profit': -2,
    'health.care.national-service': 1,
  },
  situation: { income: 'profit', authority: 'employs-few', sector: 'retail-hospitality', world: 'core', housing: 'own-mortgage', debt: 'business', assets: ['home', 'business-small'] },
  practice: ['business', 'vote'],
  breaks: 'order',
  underPressure: 'interest',
  reachesFor: 'individuals',
  onTension: 'yield',
  origin: 'work',
  declineRate: 0.1,
  expect: ['cs.taxes.taken-and-wasted', 'change.means.individual-exit'],
};

export const declinist: Persona = {
  id: 'cs-declinist',
  name: 'Declinist former miner',
  traditions: ['commonsense.declinist'],
  targets: {
    'cs.decline.moral-decay': 3,
    'cs.decline.jobs-gone': 3,
    'cs.hard-work.not-anymore': 2,
    'hist.ussr-late.security-and-decency': 2,
    'cs.decline.outsiders': 1,
    'cs.clean-house.tough-leader': 2,
    'health.care.national-service': 2,
  },
  situation: { income: 'transfers', employment: 'retired', world: 'semi-periphery', union: 'former', place: 'town', generation: 'pre-1960', religion: 'orthodox', religiosity: 'cultural' },
  practice: ['vote'],
  breaks: 'order',
  underPressure: 'interest',
  reachesFor: 'culture',
  onTension: 'yield',
  origin: 'work',
  declineRate: 0.25,
  // cs.decline.* is reached only by three probes and the conservatism descent. Survey now asks three targeted
  // probes, but none of them lands on cs.decline for this persona (its nearest traditions are liberal and
  // self-reliance ones, so neither the split nor the keystone slot points there), so no keystone is asserted.
  expect: [],
};

/** A union shop steward who also loves the army, hates taxes and wants migration cut: no tradition holds all of it. */
export const mixedSteward: Persona = {
  id: 'cs-mixed-steward',
  name: 'Union steward with contradictory loyalties',
  targets: {
    'unions.role.class-organ': 2,
    'picket.line.never-cross': 2,
    'cs.taxes.taken-and-wasted': 3,
    'war.militarism.peace-through-strength': 2,
    'borders.migration.restrict-for-workers': 2,
    'welfare.state.social-citizenship': 2,
    'property.private.natural-right': 2,
    'cs.clean-house.tough-leader': 2,
    'cs.greed.everyone-greedy': 2,
    'religion.public.heritage-establishment': 1,
    'intl.sanctions.legitimate-tool': 1,
  },
  situation: { income: 'wages', sector: 'manufacturing', union: 'member', world: 'core', housing: 'own-mortgage', place: 'town' },
  practice: ['union-active', 'vote', 'strike'],
  breaks: 'dispossessed',
  underPressure: 'mixed',
  reachesFor: 'individuals',
  onTension: 'hold',
  origin: 'work',
  declineRate: 0.15,
};

/** A student who has never thought about most of it and says so. */
export const apoliticalStudent: Persona = {
  id: 'cs-apolitical-student',
  name: 'Apolitical student',
  targets: {
    'cs.not-political.keep-head-down': 2,
    'cs.middle.not-sure': 2,
    'cs.own-first.yourself-first': 1,
    'cs.live-let-live.leave-alone': 1,
  },
  situation: { employment: 'student', world: 'core', housing: 'family', generation: '1997-plus' },
  practice: [],
  breaks: 'neither',
  reachesFor: 'chance',
  onTension: 'reject',
  origin: 'media',
  declineRate: 0.55,
};

export const incoherentPersonas: Persona[] = [riggedCabbie, ownFirstMother, antiPolitics, liveAndLetLive, selfReliantShopkeeper, declinist, mixedSteward, apoliticalStudent];
