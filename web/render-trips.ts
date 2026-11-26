/**
 * The trips section: each regular trip next to its cleaner, lower-carbon alternative,
 * with the weekly CO₂ and PM2.5 difference spelled out in words as well as numbers.
 */
import type { TripPlan } from '../src/domain/trips';
import { MODE_PROFILES } from '../src/domain/trips';
import { h, headRow, scrollRegion } from './dom';
import { kg, micrograms, when } from './format';

const modeName = (mode: TripPlan['usual']['mode']): string => MODE_PROFILES[mode].label;

/** Plain-language reasons for the suggestion. */
export function explainTrip(plan: TripPlan, today: string): string[] {
  const { usual, better } = plan;
  const reasons: string[] = [];
  if (plan.changes.includes('retimed')) {
    reasons.push(
      `Leave at ${when(better.time, today)} instead of ${when(usual.time, today)}: PM2.5 is ` +
        `${String(Math.round(better.pm2_5))} instead of ${String(Math.round(usual.pm2_5))} µg/m³.`,
    );
  }
  if (plan.changes.includes('mode-switched')) {
    reasons.push(`${modeName(better.mode)} instead of ${modeName(usual.mode).toLowerCase()}.`);
  }
  if (plan.changes.includes('kept-enclosed')) {
    reasons.push(
      'Walking and cycling were ruled out: the air will be Poor or worse and someone at home is sensitive.',
    );
  }
  if (reasons.length === 0)
    reasons.push('Your usual trip is already the cleanest choice within reach.');
  return reasons;
}

/** Words for a change in weekly dose; a negative saving means more is breathed in. */
export function doseChange(saved: number): string {
  if (saved > 0) return `${micrograms(saved)} less`;
  if (saved < 0) return `${micrograms(-saved)} more (breathing harder outdoors)`;
  return 'no change';
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
  const head = headRow([
    'Trip',
    'Usually',
    'Suggested',
    'CO₂ saved a week',
    'PM2.5 breathed a week',
  ]);
  const table = h(
    'table',
    {},
    h('caption', {}, 'Your trips and the suggested switch'),
    h('thead', {}, head),
    h('tbody', {}, ...trips.map((plan) => row(plan, today))),
  );
  return h(
    'section',
    { class: 'card trips', 'aria-labelledby': 'trips-title' },
    h('h3', { id: 'trips-title' }, 'Cleaner trips'),
    scrollRegion('Trip comparison table', table),
  );
}
