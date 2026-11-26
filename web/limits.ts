/** Tunable limits of the browser code, named and documented in one place. */

/** Browser-side limits and timings. */
export const BROWSER_LIMITS = {
  /** Most trips a plan accepts (matches the server schema). */
  maxTrips: 5,
  /** How long the page waits for a plan: up to three Gemini models plus the forecast. */
  planTimeoutMs: 45_000,
  /** How long to wait for the browser's location, and how old a cached one may be. */
  locationTimeoutMs: 10_000,
  locationMaxAgeMs: 600_000,
} as const;

/** The example trip a new form starts with. */
export const EXAMPLE_TRIP = {
  label: 'Commute',
  km: 8,
  mode: 'car',
  departHour: 9,
  perWeek: 10,
} as const;
