import { describe, expect, it } from 'vitest';
import type { Hours } from '../../src/domain/forecast';
import { MODE_PROFILES, MODES } from '../../src/domain/modes';
import { planTrip, priceLeg, reachableModes } from '../../src/domain/trips';
import { airHour as hour, dayOfHours, trip } from '../fixtures';
import { kilometres } from '../../src/domain/units';

const noTransit = { bus: false, metro: false };

describe('MODE_PROFILES', () => {
  it('has sourced factors for every mode, with carpool a third of a car', () => {
    for (const mode of MODES) expect(MODE_PROFILES[mode].kmPerHour).toBeGreaterThan(0);
    expect(MODE_PROFILES.carpool.co2PerKm * 3).toBeCloseTo(MODE_PROFILES.car.co2PerKm);
    expect(MODE_PROFILES.walk.co2PerKm).toBe(0);
  });
});

describe('priceLeg', () => {
  it('prices CO2, time and inhaled dose for a car trip', () => {
    const leg = priceLeg({ mode: 'car', km: kilometres(11) }, hour('2026-12-01T09:00', 200));
    expect(leg).toEqual({
      mode: 'car',
      time: '2026-12-01T09:00',
      pm2_5: 200,
      minutes: 30,
      co2Kg: 1.81,
      doseUg: 20,
    });
  });

  it('charges active travel more dose for the same air', () => {
    const at = hour('2026-12-01T09:00', 100);
    expect(priceLeg({ mode: 'cycle', km: kilometres(6) }, at).doseUg).toBeGreaterThan(
      priceLeg({ mode: 'metro', km: kilometres(6) }, at).doseUg,
    );
  });
});

describe('reachableModes', () => {
  it('offers walking and cycling only for short trips', () => {
    expect(reachableModes(trip({ km: 1.5 }), noTransit)).toEqual([
      'car',
      'walk',
      'cycle',
      'carpool',
    ]);
    expect(reachableModes(trip({ km: 20 }), noTransit)).toEqual(['car', 'carpool']);
  });

  it('offers transit that is nearby and never repeats the usual mode', () => {
    expect(reachableModes(trip({ km: 20, mode: 'bus' }), { bus: true, metro: true })).toEqual([
      'bus',
      'metro',
    ]);
  });
});

describe('planTrip', () => {
  const hours = dayOfHours();

  it('moves a car commute to the metro at a cleaner hour', () => {
    const plan = planTrip(trip({ km: 12 }), hours, {
      transit: { bus: true, metro: true },
      flexHours: 2,
      sensitive: false,
    });
    expect(plan.usual.time).toBe('2026-12-01T09:00');
    expect(plan.better.mode).toBe('metro');
    expect(plan.better.time).toBe('2026-12-01T07:00');
    expect(plan.changes).toEqual(['retimed', 'mode-switched']);
    expect(plan.weeklyCo2SavedKg).toBeCloseTo((1.97 - 0.34) * 10);
    expect(plan.weeklyDoseSavedUg).toBeGreaterThan(0);
  });

  it('suggests cycling to people who are not sensitive, even though they breathe more', () => {
    const plan = planTrip(trip({ km: 4 }), hours, {
      transit: noTransit,
      flexHours: 0,
      sensitive: false,
    });
    expect(plan.better.mode).toBe('cycle');
    expect(plan.weeklyDoseSavedUg).toBeLessThan(0);
  });

  it('keeps sensitive people off bikes when the air is Poor, and says so', () => {
    const plan = planTrip(trip({ km: 4 }), hours, {
      transit: noTransit,
      flexHours: 0,
      sensitive: true,
    });
    expect(plan.better.mode).toBe('carpool');
    expect(plan.changes).toContain('kept-enclosed');
  });

  it('lets sensitive people cycle when the air is clean', () => {
    const clean: Hours = [hour('2026-12-01T09:00', 20)];
    const plan = planTrip(trip({ km: 4 }), clean, {
      transit: noTransit,
      flexHours: 0,
      sensitive: true,
    });
    expect(plan.better.mode).toBe('cycle');
  });

  it('keeps a trip that is already the cleanest choice', () => {
    const plan = planTrip(trip({ mode: 'metro', km: kilometres(20) }), hours, {
      transit: noTransit,
      flexHours: 0,
      sensitive: false,
    });
    expect(plan.changes).toEqual([]);
    expect(plan.weeklyCo2SavedKg).toBe(0);
  });

  it('breaks CO2 ties by the smaller dose (a short ride beats a longer walk)', () => {
    const plan = planTrip(trip({ mode: 'walk', km: kilometres(1) }), hours, {
      transit: noTransit,
      flexHours: 0,
      sensitive: false,
    });
    expect(plan.better.mode).toBe('cycle');
  });
});
