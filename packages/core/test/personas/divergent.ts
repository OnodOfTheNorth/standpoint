/**
 * The five personas whose situation and politics diverge (brief section 11). Each must draw a specific
 * finding from the reading; see analysis.test.ts.
 */
import type { Persona } from './policy.js';

/** (a) A core wage worker carrying a national-populist program. */
export const nationalPopulistWorker: Persona = {
  id: 'div-national-populist-worker',
  name: 'Core wage worker with a national-populist program',
  traditions: ['conservatism.right-populism', 'conservatism.national'],
  targets: {
    'borders.migration.restrict-national': 3,
    'labor.division.outsiders-undercut-us': 3,
    'cs.own-first.our-people-first': 3,
    'welfare.state.for-our-own': 3,
    'cs.rigged.system-rigged': 3,
    'change.agent.the-people-against-the-elite': 2,
    'exchange.unequal.rigged-against-us': 2,
    'tax.purpose.tariffs-for-the-nation': 2,
    'police.role.order-maintenance': 2,
    'capitalism.nature.crony-corrupted': 2,
    'finance.control.no-bailouts': 2,
    'solidarity.basis.shared-class': -1,
  },
  situation: { income: 'wages', authority: 'none', employment: 'permanent', sector: 'manufacturing', union: 'former', world: 'core', housing: 'rent', place: 'town' },
  practice: ['vote', 'post'],
  breaks: 'order',
  underPressure: 'interest',
  reachesFor: 'individuals',
  onTension: 'hold',
  origin: 'media',
};

/** (b) A domestic radical who backs sanctions and humanitarian intervention abroad. */
export const radicalInterventionist: Persona = {
  id: 'div-radical-interventionist',
  name: 'Domestic radical who backs sanctions and intervention',
  traditions: ['socdem.democratic-socialism'],
  targets: {
    'capitalism.nature.exploitation-profit': 3,
    'state.nature.class-instrument': 3,
    'workplace.conflict.structural-antagonism': 3,
    'firm.ownership.worker-cooperatives': 2,
    'housing.tenure.social-housing': 3,
    'tax.purpose.redistribute': 3,
    'welfare.state.social-citizenship': 2,
    'emergency.powers.need-overrides-property': 2,
    'intl.sanctions.legitimate-tool': 3,
    'intl.sanctions.targeted-for-rights': 3,
    'intervention.humanitarian.responsibility-to-protect': 3,
    'intl.sovereignty.conditional-on-rights': 3,
    'world.order.liberal-order': 2,
    'intl.institutions.cooperation': 2,
    'poverty.cause.bad-institutions': 2,
    'development.path.integration': 1,
    'intl.sovereignty.nations-set-own-course': -3,
    'intl.sanctions.economic-war': -3,
    'imperialism.nature.unequal-exchange-drain': -2,
    'poverty.cause.drain': -2,
  },
  situation: { income: 'salary', authority: 'none', sector: 'education', union: 'member', world: 'core', housing: 'rent' },
  practice: ['union', 'party', 'ngo', 'vote', 'protest'],
  breaks: 'dispossessed',
  underPressure: 'principle',
  reachesFor: 'ideas',
  onTension: 'hold',
  origin: 'books',
};

/** (c) A landlord who calls himself a socialist. */
export const landlordSocialist: Persona = {
  id: 'div-landlord-socialist',
  name: 'Landlord socialist',
  traditions: ['socdem.democratic-socialism'],
  targets: {
    'capitalism.nature.exploitation-profit': 3,
    'property.private.personal-vs-productive': 3,
    'workplace.conflict.structural-antagonism': 2,
    'tax.purpose.redistribute': 3,
    'housing.tenure.social-housing': 2,
    'housing.tenure.class-question': 2,
    'firm.ownership.public-municipal': 2,
    'welfare.state.social-citizenship': 2,
    'property.private.natural-right': -2,
  },
  situation: { income: ['rent', 'interest'], authority: 'none', world: 'core', housing: 'landlord', assets: ['home', 'property-many', 'financial-small'] },
  practice: ['party', 'vote', 'donate'],
  breaks: 'dispossessed',
  underPressure: 'interest',
  reachesFor: 'structures',
  onTension: 'hold',
  origin: 'books',
};

/** (d) A peripheral exporter who backs open integration and still talks national sovereignty. */
export const compradorLiberal: Persona = {
  id: 'div-comprador-liberal',
  name: 'Peripheral comprador liberal',
  traditions: ['liberalism.technocratic'],
  targets: {
    'development.path.integration': 3,
    'exchange.unequal.mutual-gain': 3,
    'finance.control.free-flows': 3,
    'intl.sovereignty.nations-set-own-course': 3,
    'poverty.cause.bad-institutions': 2,
    'poverty.cause.late-development': 2,
    'debt.sovereign.pay-what-you-owe': 2,
    'intl.institutions.cooperation': 2,
    'property.private.natural-right': 2,
    'firm.ownership.private-investors': 2,
    'comprador.nature.kleptocratic-elites': 2,
    'poverty.cause.drain': -3,
    'imperialism.nature.unequal-exchange-drain': -3,
    'comprador.nature.broker-class': -3,
    'development.path.delinking': -3,
  },
  situation: { income: 'profit', authority: 'employs-many', sector: 'trade', world: 'periphery', place: 'metropolis', housing: 'own-outright', assets: ['home', 'business-large', 'financial-large'] },
  practice: ['business', 'invest', 'lobby', 'vote'],
  breaks: 'order',
  underPressure: 'interest',
  reachesFor: 'ideas',
  onTension: 'hold',
  origin: 'school',
};

/** (e) A self-described Marxist who explains every concrete event by villains. */
export const villainMarxist: Persona = {
  id: 'div-villain-marxist',
  name: 'Self-described Marxist who reasons by villains',
  traditions: ['marxism.classical'],
  targets: {
    'capitalism.nature.exploitation-profit': 3,
    'class.concept.relation-to-production': 3,
    'value.source.labor': 3,
    'profit.legitimacy.unpaid-labor': 2,
    'history.motor.class-struggle': 3,
    'crisis.cause.greed-and-recklessness': 3,
    'cs.greed.most-decent-few-greedy': 3,
    'capitalism.nature.crony-corrupted': 2,
    'state.nature.captured': 2,
    'poverty.cause.bad-institutions': 1,
  },
  situation: { income: 'salary', authority: 'none', sector: 'tech', world: 'core', housing: 'rent' },
  practice: ['post', 'study', 'vote'],
  breaks: 'dispossessed',
  underPressure: 'principle',
  reachesFor: 'individuals',
  // Whatever the theory says, when asked why a concrete thing happened this persona names the culprits.
  causeBias: 6,
  onTension: 'hold',
  origin: 'books',
};

export const divergentPersonas: Persona[] = [nationalPopulistWorker, radicalInterventionist, landlordSocialist, compradorLiberal, villainMarxist];
