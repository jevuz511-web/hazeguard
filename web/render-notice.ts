/**
 * The community notice: a short headline and body for a residents', school or workplace
 * group, followed by the computed facts, with a button to copy it as plain text.
 */
import type { Assessment } from '../src/domain/assessment';
import type { Language } from '../src/domain/household';
import type { Writing } from '../src/services/tailoring';
import { h } from './dom';
import { kg, when } from './format';

/** The computed lines printed under every notice. */
export function noticeFacts(assessment: Assessment): string[] {
  const { worst, cleanest } = assessment.outlook;
  const today = assessment.outlook.now.time;
  const facts = [
    `Worst air: ${when(worst.time, today)} (${worst.band.label}, NAQI ${String(worst.index)})`,
    `Cleanest hour for outdoor activity: ${when(cleanest.time, today)}`,
  ];
  const saved = assessment.impact.communityCo2SavedKg;
  if (saved !== null && saved > 0)
    facts.push(`Same trip switches by everyone: ${kg(saved)} of CO₂ saved a week`);
  return facts;
}

/** The notice as plain text for pasting into a messaging group. */
export function noticeText(
  notice: NonNullable<Writing['notice']>,
  facts: readonly string[],
): string {
  return [notice.headline, '', notice.body, '', ...facts.map((fact) => `• ${fact}`)].join('\n');
}

/** Builds the notice section, or null for a single household. */
export function renderNotice(
  writing: Writing,
  assessment: Assessment,
  language: Language,
): HTMLElement | null {
  const { notice } = writing;
  if (notice === null) return null;
  const facts = noticeFacts(assessment);
  const copy = h(
    'button',
    { type: 'button', class: 'button secondary', 'data-copy': '' },
    'Copy notice text',
  );
  copy.dataset['text'] = noticeText(notice, facts);
  return h(
    'section',
    { class: 'card notice', 'aria-labelledby': 'notice-title' },
    h('h3', { id: 'notice-title' }, 'Notice for your community'),
    h(
      'article',
      { class: 'notice-sheet', lang: language },
      h('h4', {}, notice.headline),
      h('p', {}, notice.body),
      h('ul', { lang: 'en' }, ...facts.map((fact) => h('li', {}, fact))),
    ),
    copy,
    h('p', { class: 'hint', role: 'status', 'data-copy-status': '' }),
  );
}
