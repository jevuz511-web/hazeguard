/**
 * "How these numbers were worked out": the formulas, every factor used and its source,
 * so a family can check any figure in the plan for itself.
 */
import { MODE_PROFILES, MODES } from '../src/domain/modes';
import { METHOD_NOTES, SECTIONS } from './copy';
import { h, headRow, scrollRegion } from './dom';

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
  const head = headRow(SECTIONS.methodColumns);
  const table = h(
    'table',
    {},
    h('caption', {}, SECTIONS.methodCaption),
    h('thead', {}, head),
    h('tbody', {}, ...MODES.map(factorRow)),
  );
  fragment.append(
    h('ul', {}, ...METHOD_NOTES.map((line) => h('li', {}, line))),
    scrollRegion(SECTIONS.methodRegion, table),
  );
  return fragment;
}
