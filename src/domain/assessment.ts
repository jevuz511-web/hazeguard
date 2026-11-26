/**
 * The computed half of a plan: forecast outlook, trip alternatives, eligible actions and
 * the weekly impact. Every number a user sees comes from here, never from the model.
 */
import type { Action } from './catalogue';
import { eligibleActions } from './eligibility';
import { type Forecast, type Outlook, type Place, outlook } from './forecast';
import { type Audience, type Household, hasSensitiveMember } from './household';
import { type TripPlan, planTrip } from './trips';

/** The weekly difference the suggested trips make. */
export interface Impact {
  readonly co2SavedKg: number;
  readonly doseSavedUg: number;
  /** Share of the usual weekly travel dose avoided, 0 to 100 (negative if it rises). */
  readonly dosePercent: number;
  /** CO2 saved per week if everyone in the community made the same switches. */
  readonly communityCo2SavedKg: number | null;
}

/** Everything HazeGuard works out before any text is written. */
export interface Assessment {
  readonly place: Place;
  readonly outlook: Outlook;
  readonly trips: readonly TripPlan[];
  readonly actions: readonly Action[];
  readonly impact: Impact;
}

const round = (value: number): number => Math.round(value * 100) / 100;

/** Adds up the weekly savings of every trip and scales them to the community. */
export function weeklyImpact(trips: readonly TripPlan[], audience: Audience): Impact {
  const co2SavedKg = round(trips.reduce((sum, plan) => sum + plan.weeklyCo2SavedKg, 0));
  const doseSavedUg = round(trips.reduce((sum, plan) => sum + plan.weeklyDoseSavedUg, 0));
  const usualDose = trips.reduce((sum, plan) => sum + plan.usual.doseUg * plan.trip.perWeek, 0);
  return {
    co2SavedKg,
    doseSavedUg,
    dosePercent: usualDose > 0 ? Math.round((doseSavedUg / usualDose) * 100) : 0,
    communityCo2SavedKg: audience.kind === 'community' ? round(co2SavedKg * audience.people) : null,
  };
}

/** Works out the full computed plan for a household and its forecast. */
export function assess(household: Household, audience: Audience, forecast: Forecast): Assessment {
  const view = outlook(forecast);
  const context = {
    transit: household.transit,
    flexHours: household.flexHours,
    sensitive: hasSensitiveMember(household),
  };
  const trips = household.trips.map((trip) => planTrip(trip, forecast.hours, context));
  return {
    place: forecast.place,
    outlook: view,
    trips,
    actions: eligibleActions({ household, outlook: view, audience }),
    impact: weeklyImpact(trips, audience),
  };
}
