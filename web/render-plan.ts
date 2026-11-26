/**
 * Puts a whole plan on the page: who wrote it, notices, the summary and every section.
 * Model-written text is marked with its language so screen readers pronounce it right.
 */
import type { Language } from '../src/domain/household';
import type { Plan } from '../src/services/coach';
import { AUTHORSHIP, NOTICES } from './copy';
import { byId, fill, h } from './dom';
import { renderActions } from './render-actions';
import { renderAir } from './render-air';
import { renderImpact } from './render-impact';
import { renderMethod } from './render-method';
import { renderNotice } from './render-notice';
import { renderTrips } from './render-trips';

/** The language the plan's words are actually in. */
export function textLanguage(plan: Plan): Language {
  return plan.author.kind === 'rules' ? 'en' : plan.language;
}

function meta(plan: Plan): string {
  const author =
    plan.author.kind === 'gemini' ? AUTHORSHIP.gemini(plan.author.model) : AUTHORSHIP.rules;
  return `${plan.assessment.place.name}. ${author}; ${AUTHORSHIP.numbers}`;
}

function renderHeader(plan: Plan, language: Language): void {
  byId('plan-meta', HTMLElement).textContent = meta(plan);
  const notices = plan.notices.map((notice) => h('li', {}, NOTICES[notice]));
  fill(byId('plan-notices', HTMLUListElement), ...notices);
  const summary = byId('plan-summary', HTMLElement);
  summary.textContent = plan.writing.summary;
  summary.lang = language;
}

/** Renders the plan and shows its section. */
export function renderPlan(plan: Plan, done: ReadonlySet<string>): void {
  const { assessment, writing } = plan;
  const language = textLanguage(plan);
  const people = plan.audience.kind === 'community' ? plan.audience.people : null;
  renderHeader(plan, language);
  fill(byId('plan-air', HTMLElement), renderAir(assessment.outlook, assessment.place.name));
  fill(
    byId('plan-impact', HTMLElement),
    renderImpact(assessment.impact, assessment.trips.length, people),
  );
  fill(byId('plan-trips', HTMLElement), renderTrips(assessment.trips, assessment.outlook.now.time));
  fill(
    byId('plan-actions', HTMLElement),
    renderActions({ picks: writing.picks, actions: assessment.actions, done, language }),
  );
  fill(byId('plan-notice', HTMLElement), renderNotice(writing, assessment, language));
  fill(byId('plan-method', HTMLElement), renderMethod());
  document.title = AUTHORSHIP.pageTitle(assessment.place.name);
  byId('plan', HTMLElement).hidden = false;
}
