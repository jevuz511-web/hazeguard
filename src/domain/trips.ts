/**
 * Daily trips: what each one emits and how much PM2.5 the traveller breathes in, and the
 * lower-carbon, cleaner-hour alternative the household can switch to.
 */
import { bandRank } from './aqi';
import { type AirHour, type Hours, cleanestNear, nextOccurrence, rate } from './forecast';
import type { Transit } from './household';

/** Ways of making a trip. `carpool` is a car shared by three people. */
export const MODES = ['walk', 'cycle', 'bus', 'metro', 'motorbike', 'car', 'carpool'] as const;

/** One way of making a trip. */
export type Mode = (typeof MODES)[number];

/** The numbers behind a mode; see PROBLEM_ALIGNMENT.md for every source. */
export interface ModeProfile {
  readonly label: string;
  /** kg CO2e per passenger-km (DESNZ/DEFRA 2025 conversion factors). */
  readonly co2PerKm: number;
  /** Typical door-to-door city speed (assumption). */
  readonly kmPerHour: number;
  /** Air breathed in m³/h at this activity level (US EPA Exposure Factors Handbook). */
  readonly breathing: number;
  /** PM2.5 inside the mode relative to the street (assumption from commuter studies). */
  readonly exposure: number;
  /** Whether the traveller is breathing hard outdoors. */
  readonly active: boolean;
}

/** Per-mode factors used for every trip calculation. */
export const MODE_PROFILES: Readonly<Record<Mode, ModeProfile>> = {
  walk: { label: 'Walk', co2PerKm: 0, kmPerHour: 4.5, breathing: 0.72, exposure: 1, active: true },
  cycle: { label: 'Cycle', co2PerKm: 0, kmPerHour: 12, breathing: 1.56, exposure: 1, active: true },
  bus: {
    label: 'Bus',
    co2PerKm: 0.1085,
    kmPerHour: 15,
    breathing: 0.25,
    exposure: 0.9,
    active: false,
  },
  metro: {
    label: 'Metro',
    co2PerKm: 0.0286,
    kmPerHour: 30,
    breathing: 0.25,
    exposure: 0.6,
    active: false,
  },
  motorbike: {
    label: 'Motorbike or scooter',
    co2PerKm: 0.1137,
    kmPerHour: 25,
    breathing: 0.72,
    exposure: 1.2,
    active: false,
  },
  car: {
    label: 'Car (alone)',
    co2PerKm: 0.1645,
    kmPerHour: 22,
    breathing: 0.25,
    exposure: 0.8,
    active: false,
  },
  carpool: {
    label: 'Carpool (3 people)',
    co2PerKm: 0.1645 / 3,
    kmPerHour: 22,
    breathing: 0.25,
    exposure: 0.8,
    active: false,
  },
};

/** A regular one-way trip the household makes. */
export interface Trip {
  readonly label: string;
  readonly km: number;
  readonly mode: Mode;
  /** Usual clock hour of departure (0 to 23). */
  readonly departHour: number;
  readonly perWeek: number;
}

/** One way of making a trip at one hour, with its cost to the climate and the lungs. */
export interface Leg {
  readonly mode: Mode;
  readonly time: string;
  readonly pm2_5: number;
  readonly minutes: number;
  readonly co2Kg: number;
  readonly doseUg: number;
}

/** What changed between the usual trip and the suggestion. */
export type Change = 'retimed' | 'mode-switched' | 'kept-enclosed';

/** The usual trip, the better alternative and the weekly difference. */
export interface TripPlan {
  readonly trip: Trip;
  readonly usual: Leg;
  readonly better: Leg;
  readonly changes: readonly Change[];
  readonly weeklyCo2SavedKg: number;
  readonly weeklyDoseSavedUg: number;
}

/** What the household's situation allows when choosing alternatives. */
export interface TravelContext {
  readonly transit: Transit;
  readonly flexHours: number;
  readonly sensitive: boolean;
}

const round = (value: number): number => Math.round(value * 100) / 100;

/** Prices one mode for a trip of `km` leaving at `hour`. */
export function priceLeg(choice: { mode: Mode; km: number }, hour: AirHour): Leg {
  const profile = MODE_PROFILES[choice.mode];
  const hours = choice.km / profile.kmPerHour;
  return {
    mode: choice.mode,
    time: hour.time,
    pm2_5: hour.pm2_5,
    minutes: Math.round(hours * 60),
    co2Kg: round(choice.km * profile.co2PerKm),
    doseUg: round(hour.pm2_5 * profile.exposure * profile.breathing * hours),
  };
}

/** Modes that are realistic for this trip's distance and the transit nearby. */
export function reachableModes(trip: Trip, transit: Transit): Mode[] {
  const options: Mode[] = [trip.mode];
  if (trip.km <= 2) options.push('walk');
  if (trip.km <= 8) options.push('cycle');
  if (transit.bus) options.push('bus');
  if (transit.metro) options.push('metro');
  if (trip.mode === 'car') options.push('carpool');
  return [...new Set(options)];
}

/** Lower emissions first; on a tie, the smaller dose. */
function cheaperFirst(a: Leg, b: Leg): number {
  return a.co2Kg - b.co2Kg || a.doseUg - b.doseUg;
}

/** Breathing hard outdoors is ruled out for sensitive people once the air is Poor or worse. */
function shieldedModes(
  trip: Trip,
  hour: AirHour,
  context: TravelContext,
): { modes: Mode[]; removed: boolean } {
  const reachable = reachableModes(trip, context.transit);
  const shield = context.sensitive && bandRank(rate(hour).band.id) >= bandRank('poor');
  const modes = reachable.filter(
    (mode) => mode === trip.mode || !(shield && MODE_PROFILES[mode].active),
  );
  return { modes, removed: modes.length < reachable.length };
}

function changesBetween(usual: Leg, better: Leg, shielded: boolean): Change[] {
  const changes: Change[] = [];
  if (better.time !== usual.time) changes.push('retimed');
  if (better.mode !== usual.mode) changes.push('mode-switched');
  if (shielded) changes.push('kept-enclosed');
  return changes;
}

/** Finds the lowest-carbon way to make a trip at the cleanest hour within reach. */
export function planTrip(trip: Trip, hours: Hours, context: TravelContext): TripPlan {
  const usualSlot = nextOccurrence(hours, trip.departHour);
  const usual = priceLeg(trip, usualSlot[1]);
  const [, betterHour] = cleanestNear(hours, usualSlot, context.flexHours);
  const { modes, removed } = shieldedModes(trip, betterHour, context);
  // Starting from the usual mode at the better hour means it wins every tie.
  const better = modes
    .map((mode) => priceLeg({ mode, km: trip.km }, betterHour))
    .reduce((best, leg) => (cheaperFirst(leg, best) < 0 ? leg : best), priceLeg(trip, betterHour));
  return {
    trip,
    usual,
    better,
    changes: changesBetween(usual, better, removed),
    weeklyCo2SavedKg: round((usual.co2Kg - better.co2Kg) * trip.perWeek),
    weeklyDoseSavedUg: round((usual.doseUg - better.doseUg) * trip.perWeek),
  };
}
