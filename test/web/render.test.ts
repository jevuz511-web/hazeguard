// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { clock, count, hourLabel, kg, micrograms, when } from '../../web/format';
import { byId } from '../../web/dom';
import { renderActions } from '../../web/render-actions';
import { doseSentence, renderImpact } from '../../web/render-impact';
import { noticeFacts, renderNotice } from '../../web/render-notice';
import { renderPlan, textLanguage } from '../../web/render-plan';
import { doseChange, explainTrip, renderTrips } from '../../web/render-trips';
import { goodReply, household } from '../fixtures';
import { loadPage, makePlan } from './support';

beforeEach(loadPage);

const community = { kind: 'community', setting: 'residents', people: 1200 } as const;
const notice = {
  headline: 'Smog alert for our society',
  body: 'Please keep windows shut tonight and share rides.',
};

describe('format', () => {
  it('formats clock times, days, weights and doses', () => {
    expect([
      clock('2026-12-01T00:00'),
      clock('2026-12-01T09:00'),
      clock('2026-12-01T12:00'),
      clock('2026-12-01T23:00'),
    ]).toEqual(['12 am', '9 am', '12 pm', '11 pm']);
    expect(when('2026-12-02T07:00', '2026-12-01T22:00')).toBe('tomorrow 7 am');
    expect(when('2026-12-01T23:00', '2026-12-01T22:00')).toBe('11 pm');
    expect([kg(16.25), micrograms(1234.4), count(120000), hourLabel(15)]).toEqual([
      '16.3 kg',
      '1,234 µg',
      '1,20,000',
      '3 pm',
    ]);
  });
});

describe('trip explanations', () => {
  it('explains retiming, mode switches and health shielding in words', async () => {
    const plan = await makePlan();
    const [trip] = plan.assessment.trips;
    const reasons = explainTrip(trip!, plan.assessment.outlook.now.time);
    expect(reasons.join(' ')).toMatch(
      /Leave at 7 am instead of 9 am: PM2\.5 is 151 instead of 153/u,
    );
    expect(reasons.join(' ')).toMatch(/Metro instead of car \(alone\)/u);
    expect(reasons.join(' ')).toMatch(/ruled out/u);
    const unchanged = { ...trip!, changes: [] };
    expect(explainTrip(unchanged, '')).toEqual([
      'Your usual trip is already the cleanest choice within reach.',
    ]);
  });

  it('describes dose changes in both directions', () => {
    expect([doseChange(10), doseChange(-10), doseChange(0)]).toEqual([
      '10 µg less',
      '10 µg more (breathing harder outdoors)',
      'no change',
    ]);
    expect(doseSentence(-12)).toMatch(/12% more/u);
    expect(doseSentence(0)).toMatch(/No change/u);
  });

  it('renders nothing for trips or impact when no trips were entered', () => {
    expect(renderTrips([], '')).toBeNull();
    expect(
      renderImpact(
        { co2SavedKg: 0, doseSavedUg: 0, dosePercent: 0, communityCo2SavedKg: null },
        0,
        null,
      ),
    ).toBeNull();
  });
});

describe('checklist and notice', () => {
  it('groups picks by room, marks done items and tags model text with its language', async () => {
    const plan = await makePlan();
    const section = renderActions({
      picks: [...plan.writing.picks, { id: 'unknown', why: null }],
      actions: plan.assessment.actions,
      done: new Set(['clean-room']),
      language: 'hi',
    });
    expect([...section.querySelectorAll('h4')].map((heading) => heading.textContent)).toEqual([
      'Bedroom',
      'Whole home',
    ]);
    expect(section.querySelector<HTMLInputElement>('#act-clean-room')?.checked).toBe(true);
    expect(section.querySelector('.why')?.getAttribute('lang')).toBe('hi');
  });

  it('builds a copyable community notice with computed facts', async () => {
    const plan = await makePlan({ audience: community }, goodReply(notice));
    const section = renderNotice(plan.writing, plan.assessment, 'en');
    expect(section?.querySelector('h4')?.textContent).toBe(notice.headline);
    const text = section?.querySelector<HTMLElement>('[data-copy]')?.dataset['text'] ?? '';
    expect(text).toContain('• Worst air: 11 pm (Severe, NAQI 438)');
    expect(text).toMatch(/Same trip switches by everyone: [\d,.]+ kg/u);
    expect(renderNotice({ ...plan.writing, notice: null }, plan.assessment, 'en')).toBeNull();
  });

  it('leaves out the community saving when there is none', async () => {
    const plan = await makePlan(
      { audience: community, household: household({ trips: [] }) },
      goodReply(notice),
    );
    expect(noticeFacts(plan.assessment)).toHaveLength(2);
  });
});

describe('renderPlan', () => {
  it('shows every section, the author and the page title', async () => {
    const plan = await makePlan({ audience: community }, goodReply(notice));
    renderPlan(plan, new Set());
    expect(byId('plan', HTMLElement).hidden).toBe(false);
    expect(byId('plan-meta', HTMLElement).textContent).toContain(
      'Written with Gemini (gemini-test)',
    );
    expect(document.title).toBe('Smog plan for Lucknow, Uttar Pradesh, India | HazeGuard');
    expect(byId('plan-impact', HTMLElement).textContent).toContain('if all 1,200 people');
    expect(byId('plan-method', HTMLElement).querySelectorAll('tbody tr')).toHaveLength(7);
    expect(document.querySelectorAll('.strip .bar')).toHaveLength(24);
  });

  it('labels rules-written plans as English and explains why', async () => {
    const plan = await makePlan({ language: 'hi' }, null);
    expect(textLanguage(plan)).toBe('en');
    renderPlan(plan, new Set());
    expect(byId('plan-summary', HTMLElement).lang).toBe('en');
    expect(byId('plan-notices', HTMLElement).textContent).toMatch(/built-in rules/u);
    expect(byId('plan-meta', HTMLElement).textContent).toContain('Written by HazeGuard’s rules');
  });
});
