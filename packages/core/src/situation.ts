/**
 * Deriving a class location and a world position from the Situation module.
 * The derivation is deliberately explicit so a respondent can read and
 * dispute it.
 */
import type { ClassId } from '@standpoint/content/schema';
import type { State } from './types.js';

export type World = 'core' | 'semi-periphery' | 'periphery';

export interface Location {
  primary: ClassId | null;
  secondary: ClassId[];
  world: World | null;
  basis: string[]; // the facts the derivation used
  known: boolean;
}

export const CLASS_NAMES: Record<ClassId, string> = {
  'finance-capital': 'finance capital',
  'industrial-capital': 'industrial capital',
  'landed-capital': 'landed property (landlords)',
  'comprador-capital': 'comprador capital',
  'petty-bourgeoisie': 'the petty bourgeoisie (small owners and own-account workers)',
  'professional-managerial': 'salaried professionals and managers',
  'core-workers': 'workers in the core countries',
  'peripheral-workers': 'workers in the periphery',
  peasantry: 'the peasantry',
  'reserve-army': 'the reserve army of labor (unemployed and precarious)',
};

export const CLASS_SHORT: Record<ClassId, string> = {
  'finance-capital': 'finance capital',
  'industrial-capital': 'industrial capital',
  'landed-capital': 'landlords',
  'comprador-capital': 'comprador capital',
  'petty-bourgeoisie': 'small owners',
  'professional-managerial': 'professionals and managers',
  'core-workers': 'core workers',
  'peripheral-workers': 'peripheral workers',
  peasantry: 'peasants',
  'reserve-army': 'the unemployed and precarious',
};

const arr = (v: string | string[] | undefined): string[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

export function location(s: State): Location {
  const sit = s.situation;
  const income = arr(sit.income);
  const authority = arr(sit.authority)[0];
  const assets = arr(sit.assets);
  const housing = arr(sit.housing)[0];
  const sector = arr(sit.sector)[0];
  const world = (arr(sit.world)[0] as World | undefined) ?? null;
  const land = arr(sit.land)[0];
  const basis: string[] = [];
  const cands: ClassId[] = [];
  const known = income.length > 0 || !!authority || assets.length > 0;
  if (!known) return { primary: null, secondary: [], world: world && ['core', 'semi-periphery', 'periphery'].includes(world) ? world : null, basis, known: false };

  const periphery = world === 'periphery' || world === 'semi-periphery';
  if (income.includes('profit')) {
    if (periphery && (sector === 'finance' || sector === 'extraction' || sector === 'trade')) {
      cands.push('comprador-capital');
      basis.push('profit income in an export, trade or finance sector outside the core');
    } else if (sector === 'finance') {
      cands.push('finance-capital');
      basis.push('profit income from finance');
    } else if (authority === 'employs-many' || assets.includes('business-large')) {
      cands.push('industrial-capital');
      basis.push('profit income from a firm employing others');
    } else {
      cands.push('petty-bourgeoisie');
      basis.push('profit income from a small business');
    }
  }
  if (income.includes('interest') && assets.includes('financial-large')) {
    cands.push('finance-capital');
    basis.push('large financial holdings yielding interest and dividends');
  }
  if (income.includes('rent') || housing === 'landlord') {
    cands.push('landed-capital');
    basis.push('rental income from property');
  }
  if (land === 'own-farm-large') {
    cands.push('landed-capital');
    basis.push('owning a large estate worked by others');
  }
  if (land === 'landless-rural') {
    cands.push(periphery ? 'peripheral-workers' : 'core-workers');
    basis.push('working other people’s land for wages');
  }
  if (land === 'own-farm-small' || land === 'tenant-farmer' || (income.includes('own-account') && sector === 'agriculture' && periphery)) {
    cands.push('peasantry');
    basis.push('working own or rented land');
  }
  if (income.includes('own-account') && !cands.includes('peasantry')) {
    cands.push('petty-bourgeoisie');
    basis.push('own-account work');
  }
  if (income.includes('salary')) {
    if (authority === 'manages' || authority === 'employs-many' || authority === 'supervises') {
      cands.push('professional-managerial');
      basis.push('salary with authority over others’ work');
    } else if (sector === 'professional' || sector === 'public-professional' || sector === 'tech') {
      cands.push('professional-managerial');
      basis.push('salaried professional work');
    } else {
      cands.push(periphery ? 'peripheral-workers' : 'core-workers');
      basis.push('salaried employment without authority over others');
    }
  }
  if (income.includes('wages')) {
    cands.push(periphery ? 'peripheral-workers' : 'core-workers');
    basis.push(`wage work${world ? ` in a ${world} country` : ''}`);
  }
  // a pension from past work is a deferred wage or salary: the pensioner keeps the class of the work it came
  // from. Before the Situation form split pensions from benefits, "transfers" + retired meant a pension.
  const retired = arr(sit.employment)[0] === 'retired';
  if (income.includes('pension') || (income.includes('transfers') && retired)) {
    if (authority === 'manages' || authority === 'employs-many' || authority === 'supervises' || sector === 'professional' || sector === 'public-professional' || sector === 'tech') {
      cands.push('professional-managerial');
      basis.push('a pension from past professional or managerial work');
    } else {
      cands.push(periphery ? 'peripheral-workers' : 'core-workers');
      basis.push('a pension from past wage work');
    }
  }
  if ((income.includes('transfers') && !retired) || arr(sit.employment)[0] === 'unemployed' || arr(sit.employment)[0] === 'precarious') {
    cands.push('reserve-army');
    basis.push('unemployment, precarious work or dependence on benefits');
  }
  if (income.includes('care') && !cands.length) {
    cands.push(periphery ? 'peripheral-workers' : 'core-workers');
    basis.push('unpaid care work inside a working household');
  }
  // order of precedence: ownership of means of production outranks wage relation
  const precedence: ClassId[] = [
    'finance-capital',
    'industrial-capital',
    'comprador-capital',
    'landed-capital',
    'professional-managerial',
    'petty-bourgeoisie',
    'peasantry',
    'core-workers',
    'peripheral-workers',
    'reserve-army',
  ];
  const uniq = [...new Set(cands)];
  // A worker who rents out one flat is still primarily a worker: wages outrank small rent.
  let primary: ClassId | null = null;
  const smallLandlord = uniq.includes('landed-capital') && !assets.includes('property-many');
  for (const c of precedence) {
    if (!uniq.includes(c)) continue;
    if (c === 'landed-capital' && smallLandlord && uniq.some((x) => x !== 'landed-capital')) continue;
    primary = c;
    break;
  }
  return {
    primary,
    secondary: uniq.filter((c) => c !== primary),
    world: world && ['core', 'semi-periphery', 'periphery'].includes(world) ? world : null,
    basis,
    known: true,
  };
}
