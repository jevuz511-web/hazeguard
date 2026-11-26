/**
 * Who the plan is for: the household's members, home, daily trips and whether the plan
 * should also speak to a wider community (residents' association, school or workplace).
 */
import type { Trip } from './trips';

/** Household members who need extra protection from particulates. */
export const MEMBERS = [
  'child',
  'older-adult',
  'respiratory',
  'pregnant',
  'outdoor-worker',
] as const;
/** Main cooking fuel at home. */
export const COOKING_FUELS = ['lpg', 'piped-gas', 'induction', 'biomass', 'kerosene'] as const;
/** Main way the home is heated in winter. */
export const HEATING = ['none', 'electric', 'gas', 'kerosene', 'wood-or-coal'] as const;
/** Kinds of community a shared notice can address. */
export const SETTINGS = ['residents', 'school', 'workplace'] as const;
/** Languages the written advice can come back in. */
export const LANGUAGES = ['en', 'hi'] as const;

/** One kind of household member. */
export type Member = (typeof MEMBERS)[number];
/** One cooking fuel. */
export type CookingFuel = (typeof COOKING_FUELS)[number];
/** One heating source. */
export type Heating = (typeof HEATING)[number];
/** One community setting. */
export type Setting = (typeof SETTINGS)[number];
/** One advice language. */
export type Language = (typeof LANGUAGES)[number];

/** The home's sources of indoor pollution and its defences. */
export interface Home {
  readonly cooking: CookingFuel;
  readonly heating: Heating;
  readonly purifier: boolean;
  readonly smoker: boolean;
}

/** Public transport within easy reach of home. */
export interface Transit {
  readonly bus: boolean;
  readonly metro: boolean;
}

/** Everything the planner knows about a household. */
export interface Household {
  readonly members: readonly Member[];
  readonly home: Home;
  readonly trips: readonly Trip[];
  readonly transit: Transit;
  /** How many hours earlier or later trips can move (0 to 3). */
  readonly flexHours: number;
}

/** Whether the plan is for one household or also for a community it belongs to. */
export type Audience =
  | { readonly kind: 'household' }
  | { readonly kind: 'community'; readonly setting: Setting; readonly people: number };

/** Members whose health is most affected by particulates. */
const SENSITIVE: ReadonlySet<Member> = new Set(['child', 'older-adult', 'respiratory', 'pregnant']);

/** True when someone in the household is especially vulnerable to smog. */
export function hasSensitiveMember(household: Household): boolean {
  return household.members.some((member) => SENSITIVE.has(member));
}

/** True when cooking burns wood, dung, coal or kerosene indoors. */
export function cooksWithSmokyFuel(home: Home): boolean {
  return home.cooking === 'biomass' || home.cooking === 'kerosene';
}

/** True when the home is heated by burning kerosene, wood or coal. */
export function heatsWithFuel(home: Home): boolean {
  return home.heating === 'kerosene' || home.heating === 'wood-or-coal';
}
