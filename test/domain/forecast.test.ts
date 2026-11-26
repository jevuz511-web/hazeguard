import { describe, expect, it } from 'vitest';
import {
  type Hours,
  cleanestNear,
  hourOf,
  nextOccurrence,
  outlook,
  rate,
} from '../../src/domain/forecast';
import { dayOfHours, forecast } from '../fixtures';

const hour = (time: string, pm2_5: number) => ({ time, pm2_5, pm10: pm2_5 });

describe('hourOf and rate', () => {
  it('reads the clock hour from a local timestamp', () => {
    expect(hourOf('2026-12-01T07:00')).toBe(7);
  });

  it('adds the NAQI value and band', () => {
    const rated = rate(hour('2026-12-01T07:00', 100));
    expect(rated.index).toBe(233);
    expect(rated.band.id).toBe('poor');
  });
});

describe('nextOccurrence', () => {
  it('finds the next hour with the clock hour', () => {
    const [position, found] = nextOccurrence(dayOfHours(), 9);
    expect(position).toBe(3);
    expect(found.time).toBe('2026-12-01T09:00');
  });

  it('falls back to the current hour when the clock hour is not listed', () => {
    const short: Hours = [hour('2026-12-01T06:00', 50)];
    expect(nextOccurrence(short, 9)).toEqual([0, short[0]]);
  });
});

describe('cleanestNear', () => {
  const hours: Hours = [
    hour('2026-12-01T06:00', 90),
    hour('2026-12-01T07:00', 60),
    hour('2026-12-01T08:00', 80),
    hour('2026-12-01T09:00', 60),
    hour('2026-12-01T10:00', 100),
  ];

  it('picks the lowest PM2.5 within reach', () => {
    expect(cleanestNear(hours, [2, hours[2]!], 1)[0]).toBe(1);
  });

  it('prefers the hour nearest the usual time on a tie', () => {
    expect(cleanestNear(hours, [4, hours[4]!], 3)[0]).toBe(3);
  });

  it('keeps the usual hour when nothing nearby is cleaner or reach is zero', () => {
    expect(cleanestNear(hours, [1, hours[1]!], 1)[0]).toBe(1);
    expect(cleanestNear(hours, [2, hours[2]!], 0)[0]).toBe(2);
  });
});

describe('outlook', () => {
  it('summarises now, worst, cleanest and the airing hour', () => {
    const view = outlook(forecast());
    expect(view.now.time).toBe('2026-12-01T06:00');
    expect(view.worst.time).toBe('2026-12-01T23:00');
    expect(view.cleanest.time).toBe('2026-12-01T15:00');
    expect(view.airing.time).toBe('2026-12-01T15:00');
    expect(view.hours).toHaveLength(24);
    expect(view.unhealthyHours).toBe(23);
  });

  it('airs at the current hour when the forecast has no daytime hours', () => {
    const night = forecast([hour('2026-12-01T23:00', 200), hour('2026-12-02T00:00', 100)]);
    const view = outlook(night);
    expect(view.airing.time).toBe('2026-12-01T23:00');
    expect(view.cleanest.time).toBe('2026-12-02T00:00');
  });

  it('only counts daytime hours as airing candidates', () => {
    const hours: Hours = [
      hour('2026-12-01T05:00', 10),
      hour('2026-12-01T07:00', 90),
      hour('2026-12-01T08:00', 70),
    ];
    expect(outlook(forecast(hours)).airing.time).toBe('2026-12-01T08:00');
  });
});
