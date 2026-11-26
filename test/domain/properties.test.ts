/**
 * Property-based tests: instead of single examples, fast-check generates thousands of
 * forecasts and trips and checks rules that must hold for every one of them.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { bandFor, bandRank, naqi, subIndex } from '../../src/domain/aqi';
import {
  type AirHour,
  type Hours,
  cleanestNear,
  nextOccurrence,
  outlook,
} from '../../src/domain/forecast';
import { MODES } from '../../src/domain/modes';
import { planTrip } from '../../src/domain/trips';
import { kilometres } from '../../src/domain/units';
import { airHour, forecast } from '../fixtures';

const pm = fc.double({ min: 0, max: 900, noNaN: true });

/** A run of 1 to 30 consecutive forecast hours starting at a random hour of 1 December. */
const hoursArb: fc.Arbitrary<Hours> = fc
  .tuple(fc.integer({ min: 0, max: 23 }), fc.array(pm, { minLength: 1, maxLength: 30 }))
  .map(([start, readings]) => {
    const at = (i: number): AirHour => {
      const total = start + i;
      const day = String(1 + Math.floor(total / 24)).padStart(2, '0');
      return airHour(`2026-12-${day}T${String(total % 24).padStart(2, '0')}:00`, readings[i] ?? 0);
    };
    return [at(0), ...readings.slice(1).map((_, i) => at(i + 1))];
  });

const tripArb = fc.record({
  label: fc.constant('Trip'),
  km: fc.double({ min: 0.1, max: 150, noNaN: true }).map(kilometres),
  mode: fc.constantFrom(...MODES),
  departHour: fc.integer({ min: 0, max: 23 }),
  perWeek: fc.integer({ min: 1, max: 14 }),
});

const contextArb = fc.record({
  transit: fc.record({ bus: fc.boolean(), metro: fc.boolean() }),
  flexHours: fc.integer({ min: 0, max: 3 }),
  sensitive: fc.boolean(),
});

describe('air quality index properties', () => {
  it('never falls when a pollutant rises, and stays within 0 to 500', () => {
    fc.assert(
      fc.property(pm, pm, fc.constantFrom('pm2_5' as const, 'pm10' as const), (a, b, pollutant) => {
        const [low, high] = a <= b ? [a, b] : [b, a];
        expect(subIndex(pollutant, low)).toBeLessThanOrEqual(subIndex(pollutant, high));
        expect(subIndex(pollutant, high)).toBeGreaterThanOrEqual(0);
        expect(subIndex(pollutant, high)).toBeLessThanOrEqual(500);
      }),
    );
  });

  it('reports a band that matches its index', () => {
    fc.assert(
      fc.property(pm, pm, (fine, coarse) => {
        const index = naqi(airHour('2026-12-01T00:00', fine, coarse));
        expect(bandFor(index).floor).toBeLessThanOrEqual(index);
      }),
    );
  });
});

describe('forecast search properties', () => {
  it('finds a cleanest hour within reach that is no dirtier than the usual one', () => {
    fc.assert(
      fc.property(
        hoursArb,
        fc.integer({ min: 0, max: 23 }),
        fc.integer({ min: 0, max: 3 }),
        (hours, clock, reach) => {
          const usual = nextOccurrence(hours, clock);
          const [position, hour] = cleanestNear(hours, usual, reach);
          expect(Math.abs(position - usual[0])).toBeLessThanOrEqual(reach);
          expect(hour.pm2_5).toBeLessThanOrEqual(usual[1].pm2_5);
        },
      ),
    );
  });

  it('keeps the summary consistent with the hours it summarises', () => {
    fc.assert(
      fc.property(hoursArb, (hours) => {
        const view = outlook(forecast(hours));
        for (const hour of view.hours) {
          expect(view.worst.index).toBeGreaterThanOrEqual(hour.index);
          expect(view.cleanest.pm2_5).toBeLessThanOrEqual(hour.pm2_5);
        }
        expect(view.unhealthyHours).toBeLessThanOrEqual(hours.length);
      }),
    );
  });
});

describe('trip planning properties', () => {
  it('never suggests a trip that emits more than the usual one', () => {
    fc.assert(
      fc.property(tripArb, hoursArb, contextArb, (trip, hours, context) => {
        const plan = planTrip(trip, hours, context);
        expect(plan.better.co2Kg).toBeLessThanOrEqual(plan.usual.co2Kg);
        expect(plan.weeklyCo2SavedKg).toBeGreaterThanOrEqual(0);
      }),
    );
  });

  it('never sends a sensitive person out to walk or cycle when the air is Poor or worse', () => {
    fc.assert(
      fc.property(tripArb, hoursArb, contextArb, (trip, hours, context) => {
        const plan = planTrip(trip, hours, { ...context, sensitive: true });
        const hour = hours.find((candidate) => candidate.time === plan.better.time) ?? hours[0];
        const air = bandRank(bandFor(naqi(hour)).id);
        const switchedToActive =
          plan.better.mode !== trip.mode && ['walk', 'cycle'].includes(plan.better.mode);
        expect(switchedToActive && air >= bandRank('poor')).toBe(false);
      }),
    );
  });
});
