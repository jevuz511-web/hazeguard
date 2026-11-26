/** The impact section: what the suggested trip switches change each week, in plain words. */
import type { Impact } from '../src/domain/assessment';
import { IMPACT, SECTIONS } from './copy';
import { h } from './dom';
import { count, kg } from './format';

function figure(value: string, caption: string): HTMLElement {
  return h(
    'div',
    { class: 'figure' },
    h('p', { class: 'figure-value' }, value),
    h('p', { class: 'figure-caption' }, caption),
  );
}

/** Sentence describing the change in the travel dose. */
export function doseSentence(percent: number): string {
  if (percent > 0) return IMPACT.doseLess(percent);
  if (percent < 0) return IMPACT.doseMore(-percent);
  return IMPACT.doseSame;
}

/** Builds the impact section, or null when there are no trips to compare. */
export function renderImpact(
  impact: Impact,
  tripCount: number,
  people: number | null,
): HTMLElement | null {
  if (tripCount === 0) return null;
  const figures = [
    figure(kg(impact.co2SavedKg), IMPACT.household),
    figure(`${String(Math.abs(impact.dosePercent))}%`, doseSentence(impact.dosePercent)),
  ];
  if (impact.communityCo2SavedKg !== null && people !== null) {
    figures.push(figure(kg(impact.communityCo2SavedKg), IMPACT.community(count(people))));
  }
  return h(
    'section',
    { class: 'card impact', 'aria-labelledby': 'impact-title' },
    h('h3', { id: 'impact-title' }, SECTIONS.impact),
    h('div', { class: 'figures' }, ...figures),
  );
}
