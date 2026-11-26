/**
 * "How these numbers were worked out": the formulas, every factor used and its source,
 * so a family can check any figure in the plan for itself.
 */
import { MODE_PROFILES, MODES } from '../src/domain/trips';
import { h, headRow, scrollRegion } from './dom';

const FORMULAS = [
  'NAQI: each pollutant’s reading is placed on the CPCB breakpoint scale; the index is the worst of PM2.5 and PM10.',
  'Trip CO₂ = distance × the mode’s kg CO₂e per passenger-km (DESNZ/DEFRA 2025 conversion factors; carpool shares a car between three).',
  'PM2.5 breathed = outdoor PM2.5 at departure × in-mode exposure ratio × breathing rate × time on the move.',
  'Weekly figures multiply one trip by how many times a week you make it. Cleaner hours are searched within the flexibility you chose.',
  'Breathing rates come from the US EPA Exposure Factors Handbook (2011); in-mode exposure ratios and speeds are typical values for Indian cities and are estimates.',
];

function factorRow(mode: (typeof MODES)[number]): HTMLTableRowElement {
  const profile = MODE_PROFILES[mode];
  return h(
    'tr',
    {},
    h('th', { scope: 'row' }, profile.label),
    h('td', {}, profile.co2PerKm.toFixed(4)),
    h('td', {}, String(profile.kmPerHour)),
    h('td', {}, profile.breathing.toFixed(2)),
    h('td', {}, profile.exposure.toFixed(1)),
  );
}

/** Builds the method notes and factor table. */
export function renderMethod(): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const head = headRow([
    'Mode',
    'kg CO₂e per km',
    'km per hour',
    'Breathing m³ per hour',
    'Exposure ratio',
  ]);
  const table = h(
    'table',
    {},
    h('caption', {}, 'Factors used for every trip'),
    h('thead', {}, head),
    h('tbody', {}, ...MODES.map(factorRow)),
  );
  fragment.append(
    h('ul', {}, ...FORMULAS.map((line) => h('li', {}, line))),
    scrollRegion('Factors used', table),
  );
  return fragment;
}
