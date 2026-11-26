/**
 * Puts a whole plan on the page: who wrote it, notices, the summary and every section.
 * Model-written text is marked with its language so screen readers pronounce it right.
 */
import type { Language } from '../src/domain/household';
import type { Notice, Plan } from '../src/services/coach';
import { byId, fill, h } from './dom';
import { renderActions } from './render-actions';
import { renderAir } from './render-air';
import { renderImpact } from './render-impact';
import { renderMethod } from './render-method';
import { renderNotice } from './render-notice';
import { renderTrips } from './render-trips';

const NOTICE_TEXT: Readonly<Record<Notice, string>> = {
  'note-ignored': 'Your note looked like instructions to the AI, so it was left out of the plan.',
  'written-by-rules':
    'Gemini was unavailable, so HazeGuard’s built-in rules wrote this plan in English. Every number is the same.',
};

/** The language the plan's words are actually in. */
export function textLanguage(plan: Plan): Language {
  return plan.author.kind === 'rules' ? 'en' : plan.language;
}

function meta(plan: Plan): string {
  const author =
    plan.author.kind === 'gemini'
      ? `Written with Gemini (${plan.author.model})`
      : 'Written by HazeGuard’s rules';
  return `${plan.assessment.place.name}. ${author}; every number is calculated by HazeGuard from live Open-Meteo data.`;
}

/** Renders the plan and moves focus to its heading area. */
export function renderPlan(plan: Plan, done: ReadonlySet<string>): void {
  const { assessment, writing } = plan;
  const language = textLanguage(plan);
  const today = assessment.outlook.now.time;
  const people = plan.audience.kind === 'community' ? plan.audience.people : null;
  byId('plan-meta', HTMLElement).textContent = meta(plan);
  fill(
    byId('plan-notices', HTMLUListElement),
    ...plan.notices.map((notice) => h('li', {}, NOTICE_TEXT[notice])),
  );
  const summary = byId('plan-summary', HTMLElement);
  summary.textContent = writing.summary;
  summary.lang = language;
  fill(byId('plan-air', HTMLElement), renderAir(assessment.outlook, assessment.place.name));
  fill(
    byId('plan-impact', HTMLElement),
    renderImpact(assessment.impact, assessment.trips.length, people),
  );
  fill(byId('plan-trips', HTMLElement), renderTrips(assessment.trips, today));
  fill(
    byId('plan-actions', HTMLElement),
    renderActions({ picks: writing.picks, actions: assessment.actions, done, language }),
  );
  fill(byId('plan-notice', HTMLElement), renderNotice(writing, assessment, language));
  fill(byId('plan-method', HTMLElement), renderMethod());
  document.title = `Smog plan for ${assessment.place.name} | HazeGuard`;
  const section = byId('plan', HTMLElement);
  section.hidden = false;
}
