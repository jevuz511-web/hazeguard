/** Shared test data and fakes: forecasts, households, model replies and plan requests. */
import type { Forecast, Hours } from '../src/domain/forecast';
import type { Household } from '../src/domain/household';
import type { Trip } from '../src/domain/trips';
import type { PlanBody } from '../src/http/plan-request';
import type { PlanRequest } from '../src/services/coach';
import type { AirSource, Logger, ModelRequest, TextModel } from '../src/services/ports';

/** The cleanest (15:00) and dirtiest (23:00) hours in `dayOfHours`. */
const SPECIAL_HOURS = new Map([
  [15, 40],
  [23, 300],
]);

/** 24 hours from 06:00 on 1 Dec; PM2.5 dips to 40 at 15:00 and peaks at 300 at 23:00. */
export function dayOfHours(start = 6): Hours {
  const hours = Array.from({ length: 24 }, (_, i) => {
    const clock = (start + i) % 24;
    const day = start + i < 24 ? '01' : '02';
    const pm2_5 = SPECIAL_HOURS.get(clock) ?? 150 + i;
    return {
      time: `2026-12-${day}T${String(clock).padStart(2, '0')}:00`,
      pm2_5,
      pm10: pm2_5 * 1.4,
    };
  });
  return hours as unknown as Hours;
}

/** A forecast for Lucknow built from `dayOfHours`. */
export function forecast(hours: Hours = dayOfHours()): Forecast {
  return {
    place: {
      name: 'Lucknow, Uttar Pradesh, India',
      latitude: 26.85,
      longitude: 80.95,
      timezone: 'Asia/Kolkata',
    },
    hours,
  };
}

/** A typical commute by car. */
export const COMMUTE: Trip = { label: 'Commute', km: 8, mode: 'car', departHour: 9, perWeek: 10 };

/** A household with a child, LPG cooking, no purifier and metro nearby. */
export function household(overrides: Partial<Household> = {}): Household {
  return {
    members: ['child'],
    home: { cooking: 'lpg', heating: 'none', purifier: false, smoker: false },
    trips: [COMMUTE],
    transit: { bus: true, metro: true },
    flexHours: 2,
    ...overrides,
  };
}

/** A valid POST /api/plan body. */
export function planBody(overrides: Partial<PlanBody> = {}): PlanBody {
  return {
    location: { kind: 'name', name: 'Lucknow' },
    members: ['child'],
    home: { cooking: 'lpg', heating: 'none', purifier: false, smoker: false },
    trips: [COMMUTE],
    transit: { bus: true, metro: true },
    flexHours: 2,
    audience: { kind: 'household' },
    language: 'en',
    note: null,
    ...overrides,
  };
}

/** A plan request for the coach. */
export function planRequest(overrides: Partial<PlanRequest> = {}): PlanRequest {
  return {
    location: { kind: 'name', name: 'Lucknow' },
    household: household(),
    audience: { kind: 'household' },
    language: 'en',
    note: null,
    ...overrides,
  };
}

/** A model reply that passes every check for `household()` in a single household. */
export function goodReply(notice: { headline: string; body: string } | null = null): string {
  return JSON.stringify({
    summary: 'Air in Lucknow is very poor now. Make one clean room for your child first.',
    picks: [
      { id: 'clean-room', why: 'Your child sleeps better in a room kept free of smog.' },
      { id: 'windows-at-peaks', why: 'Smog peaks late at night, so keep it outside.' },
      { id: 'fan-filter', why: 'Without a purifier, a fan filter cleans the bedroom cheaply.' },
    ],
    notice,
  });
}

/** A text model that replays scripted replies (strings) or throws scripted errors. */
export function scriptedModel(script: (string | Error)[]): TextModel & { calls: ModelRequest[] } {
  const calls: ModelRequest[] = [];
  return {
    calls,
    generate(request) {
      calls.push(request);
      const next = script.shift() ?? new Error('script exhausted');
      return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
    },
  };
}

/** An air source that always returns `forecast()`. */
export function fixedAir(value: Forecast = forecast()): AirSource {
  return { forecastFor: () => Promise.resolve(value) };
}

/** A logger that keeps every entry for assertions. */
export function memoryLogger(): Logger & {
  entries: { level: string; event: string; data: unknown }[];
} {
  const entries: { level: string; event: string; data: unknown }[] = [];
  const at = (level: string) => (event: string, data?: unknown) => {
    entries.push({ level, event, data });
  };
  return { entries, info: at('info'), warn: at('warn'), error: at('error') };
}
