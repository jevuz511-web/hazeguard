/**
 * Daily trips: what each one emits and how much PM2.5 the traveller breathes in, and the
 * lower-carbon, cleaner-hour alternative the household can switch to.
 */
import { bandRank } from './aqi';
import { type AirHour, type Hours, cleanestNear, nextOccurrence, rate } from './forecast';
import type { Transit } from './household';
import { MODE_PROFILES, type Mode } from './modes';
import { TRAVEL_POLICY } from './policy';
import {
  type Concentration,
  type KilogramsCo2e,
  type Kilometres,
  type Micrograms,
  type Minutes,
  kilogramsCo2e,
  micrograms,
  minutes,
} from './units';

/** A regular one-way trip the household makes. */
export interface Trip {
  readonly label: string;
  readonly km: Kilometres;
  readonly mode: Mode;
  /** Usual clock hour of departure (0 to 23). */
  readonly departHour: number;
  readonly perWeek: number;
}

/** One way of making a trip at one hour, with its cost to the climate and the lungs. */
export interface Leg {
  readonly mode: Mode;
  readonly time: string;
  readonly pm2_5: Concentration;
  readonly minutes: Minutes;
  readonly co2Kg: KilogramsCo2e;
  readonly doseUg: Micrograms;
}

/** What changed between the usual trip and the suggestion. */
export type Change = 'retimed' | 'mode-switched' | 'kept-enclosed';

/** The usual trip, the better alternative and the weekly difference. */
export interface TripPlan {
  readonly trip: Trip;
  readonly usual: Leg;
  readonly better: Leg;
  readonly changes: readonly Change[];
  readonly weeklyCo2SavedKg: KilogramsCo2e;
  /** Negative when the better option means breathing in more (active travel). */
  readonly weeklyDoseSavedUg: Micrograms;
}

/** What the household's situation allows when choosing alternatives. */
export interface TravelContext {
  readonly transit: Transit;
  readonly flexHours: number;
  readonly sensitive: boolean;
}

/** Prices one mode for a trip of `km` leaving at `hour`. */
export function priceLeg(choice: { mode: Mode; km: Kilometres }, hour: AirHour): Leg {
  const profile = MODE_PROFILES[choice.mode];
  const hours = choice.km / profile.kmPerHour;
  return {
    mode: choice.mode,
    time: hour.time,
    pm2_5: hour.pm2_5,
    minutes: minutes(hours * 60),
    co2Kg: kilogramsCo2e(choice.km * profile.co2PerKm),
    doseUg: micrograms(hour.pm2_5 * profile.exposure * profile.breathing * hours),
  };
}

/** Modes that are realistic for this trip's distance and the transit nearby. */
export function reachableModes(trip: Trip, transit: Transit): Mode[] {
  const options: Mode[] = [trip.mode];
  if (trip.km <= TRAVEL_POLICY.walkMaxKm) options.push('walk');
  if (trip.km <= TRAVEL_POLICY.cycleMaxKm) options.push('cycle');
  if (transit.bus) options.push('bus');
  if (transit.metro) options.push('metro');
  if (trip.mode === 'car') options.push('carpool');
  return [...new Set(options)];
}

/** Lower emissions first; on a tie, the smaller dose. */
function cheaperFirst(a: Leg, b: Leg): number {
  return a.co2Kg - b.co2Kg || a.doseUg - b.doseUg;
}

/** Breathing hard outdoors is ruled out for sensitive people once the air is bad enough. */
function shieldedModes(
  trip: Trip,
  hour: AirHour,
  context: TravelContext,
): { modes: Mode[]; removed: boolean } {
  const reachable = reachableModes(trip, context.transit);
  const badAir = bandRank(rate(hour).band.id) >= bandRank(TRAVEL_POLICY.shieldSensitiveFrom);
  const shield = context.sensitive && badAir;
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
    weeklyCo2SavedKg: kilogramsCo2e((usual.co2Kg - better.co2Kg) * trip.perWeek),
    weeklyDoseSavedUg: micrograms((usual.doseUg - better.doseUg) * trip.perWeek),
  };
}
