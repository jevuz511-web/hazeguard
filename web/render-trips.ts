/**
 * The trips section: each regular trip next to its cleaner, lower-carbon alternative,
 * with the weekly CO₂ and PM2.5 difference spelled out in words as well as numbers.
 */
import type { TripPlan } from '../src/domain/trips';
import { MODE_PROFILES } from '../src/domain/modes';
import { SECTIONS, TRIP_REASONS } from './copy';
import { h, headRow, scrollRegion } from './dom';
import { kg, micrograms, when } from './format';

const modeName = (mode: TripPlan['usual']['mode']): string => MODE_PROFILES[mode].label;

/** Plain-language reasons for the suggestion. */
export function explainTrip(plan: TripPlan, today: string): string[] {
  const { usual, better } = plan;
  const reasons: string[] = [];
  if (plan.changes.includes('retimed')) {
    const times = { better: when(better.time, today), usual: when(usual.time, today) };
    const pm = { better: Math.round(better.pm2_5), usual: Math.round(usual.pm2_5) };
    reasons.push(TRIP_REASONS.retimed(times, pm));
  }
  if (plan.changes.includes('mode-switched')) {
    reasons.push(TRIP_REASONS.switched(modeName(better.mode), modeName(usual.mode)));
  }
  if (plan.changes.includes('kept-enclosed')) {
    reasons.push(TRIP_REASONS.enclosed);
  }
  if (reasons.length === 0) reasons.push(TRIP_REASONS.unchanged);
  return reasons;
}

/** Words for a change in weekly dose; a negative saving means more is breathed in. */
export function doseChange(saved: number): string {
  if (saved > 0) return TRIP_REASONS.doseLess(micrograms(saved));
  if (saved < 0) return TRIP_REASONS.doseMore(micrograms(-saved));
  return TRIP_REASONS.doseSame;
}

function row(plan: TripPlan, today: string): HTMLTableRowElement {
  return h(
    'tr',
    {},
    h('th', { scope: 'row' }, plan.trip.label),
    h('td', {}, `${modeName(plan.usual.mode)}, ${when(plan.usual.time, today)}`),
    h(
      'td',
      {},
      `${modeName(plan.better.mode)}, ${when(plan.better.time, today)}`,
      h('br'),
      h('span', { class: 'why' }, explainTrip(plan, today).join(' ')),
    ),
    h('td', {}, kg(plan.weeklyCo2SavedKg)),
    h('td', {}, doseChange(plan.weeklyDoseSavedUg)),
  );
}

/** Builds the trips section, or null when no trips were entered. */
export function renderTrips(trips: readonly TripPlan[], today: string): HTMLElement | null {
  if (trips.length === 0) return null;
  const head = headRow(SECTIONS.tripColumns);
  const table = h(
    'table',
    {},
    h('caption', {}, SECTIONS.tripCaption),
    h('thead', {}, head),
    h('tbody', {}, ...trips.map((plan) => row(plan, today))),
  );
  return h(
    'section',
    { class: 'card trips', 'aria-labelledby': 'trips-title' },
    h('h3', { id: 'trips-title' }, SECTIONS.trips),
    scrollRegion(SECTIONS.tripRegion, table),
  );
}
