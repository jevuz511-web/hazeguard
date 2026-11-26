import { describe, expect, it } from 'vitest';
import { assess, weeklyImpact } from '../../src/domain/assessment';
import { hasSensitiveMember } from '../../src/domain/household';
import { planTrip } from '../../src/domain/trips';
import { COMMUTE, dayOfHours, forecast, household } from '../fixtures';

describe('assess', () => {
  it('combines the outlook, trip plans, actions and weekly impact', () => {
    const result = assess(household(), { kind: 'household' }, forecast());
    expect(result.place.name).toMatch(/^Lucknow/u);
    expect(result.trips).toHaveLength(1);
    expect(result.actions[0]?.id).toBe('clean-room');
    expect(result.impact.co2SavedKg).toBe(result.trips[0]?.weeklyCo2SavedKg);
    expect(result.impact.communityCo2SavedKg).toBeNull();
  });

  it('treats trips as made by a sensitive person when anyone at home is sensitive', () => {
    expect(hasSensitiveMember(household({ members: ['outdoor-worker'] }))).toBe(false);
    expect(hasSensitiveMember(household({ members: ['pregnant'] }))).toBe(true);
  });
});

describe('weeklyImpact', () => {
  const context = { transit: { bus: true, metro: true }, flexHours: 2, sensitive: false };
  const plan = planTrip(COMMUTE, dayOfHours(), context);

  it('sums savings and reports the dose change as a share of the usual dose', () => {
    const impact = weeklyImpact([plan, plan], { kind: 'household' });
    expect(impact.co2SavedKg).toBeCloseTo(plan.weeklyCo2SavedKg * 2);
    const usual = plan.usual.doseUg * COMMUTE.perWeek;
    expect(impact.dosePercent).toBe(Math.round((plan.weeklyDoseSavedUg / usual) * 100));
  });

  it('scales the CO2 saving to the whole community', () => {
    const impact = weeklyImpact([plan], { kind: 'community', setting: 'school', people: 100 });
    expect(impact.communityCo2SavedKg).toBeCloseTo(plan.weeklyCo2SavedKg * 100);
  });

  it('reports zero when there are no trips', () => {
    expect(weeklyImpact([], { kind: 'household' })).toEqual({
      co2SavedKg: 0,
      doseSavedUg: 0,
      dosePercent: 0,
      communityCo2SavedKg: null,
    });
  });
});
