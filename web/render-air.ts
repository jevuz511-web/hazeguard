/**
 * The air section: the reading now with its CPCB health message, the key hours ahead, a
 * 24-hour strip for sighted users and the same data as a table for everyone.
 */
import type { Outlook, RatedHour } from '../src/domain/forecast';
import { SECTIONS } from './copy';
import { h, headRow, scrollRegion } from './dom';
import { clock, when } from './format';

/** Keeps a bar visible even when PM2.5 is near zero. */
const MIN_BAR = 4;
/** PM2.5 that fills the strip's full height (top of the CPCB Severe interpolation range). */
const STRIP_TOP = 380;

function keyHour(label: string, hour: RatedHour, today: string): HTMLLIElement {
  return h(
    'li',
    {},
    h('strong', {}, `${label}: `),
    `${when(hour.time, today)}, ${hour.band.label} (NAQI ${String(hour.index)})`,
  );
}

function strip(hours: readonly RatedHour[]): HTMLOListElement {
  const bars = hours.map((hour) => {
    const bar = h('li', {
      class: `bar band-${hour.band.id}`,
      title: `${clock(hour.time)}: ${hour.band.label}`,
    });
    const share = Math.max(MIN_BAR, Math.min(100, (hour.pm2_5 / STRIP_TOP) * 100));
    bar.style.setProperty('--level', `${share.toFixed(0)}%`);
    return bar;
  });
  return h('ol', { class: 'strip', 'aria-hidden': 'true' }, ...bars);
}

function table(hours: readonly RatedHour[], today: string): HTMLTableElement {
  const head = headRow(SECTIONS.hourColumns);
  const rows = hours.map((hour) =>
    h(
      'tr',
      {},
      h('th', { scope: 'row' }, when(hour.time, today)),
      h('td', {}, hour.band.label),
      h('td', {}, String(hour.index)),
      h('td', {}, String(Math.round(hour.pm2_5))),
    ),
  );
  return h(
    'table',
    {},
    h('caption', {}, SECTIONS.hourCaption),
    h('thead', {}, head),
    h('tbody', {}, ...rows),
  );
}

function keyHours(outlook: Outlook): HTMLUListElement {
  const today = outlook.now.time;
  return h(
    'ul',
    { class: 'key-hours' },
    keyHour(SECTIONS.worstHour, outlook.worst, today),
    keyHour(SECTIONS.cleanestHour, outlook.cleanest, today),
    keyHour(SECTIONS.airingHour, outlook.airing, today),
    h(
      'li',
      {},
      h('strong', {}, `${SECTIONS.unhealthyHours}: `),
      `${String(outlook.unhealthyHours)} of ${String(outlook.hours.length)}`,
    ),
  );
}

/** Builds the air section for a plan. */
export function renderAir(outlook: Outlook, place: string): HTMLElement {
  const { now } = outlook;
  const today = now.time;
  return h(
    'section',
    { class: 'card air', 'aria-labelledby': 'air-title' },
    h('h3', { id: 'air-title' }, SECTIONS.air(place)),
    h(
      'p',
      { class: `reading band-${now.band.id}` },
      h('span', { class: 'reading-index' }, String(now.index)),
      h('span', { class: 'reading-band' }, SECTIONS.airNow(now.band.label)),
    ),
    h('p', {}, now.band.health),
    h('p', { class: 'hint' }, SECTIONS.glossary),
    keyHours(outlook),
    strip(outlook.hours),
    h(
      'details',
      {},
      h('summary', {}, SECTIONS.hourTable),
      scrollRegion(SECTIONS.hourRegion, table(outlook.hours, today)),
    ),
  );
}
