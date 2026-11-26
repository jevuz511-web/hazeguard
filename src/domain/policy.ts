/**
 * The judgement calls HazeGuard makes, named and documented in one place so they can be
 * reviewed and tuned without hunting through the rules that use them.
 */

/** Rules for which trip alternatives are realistic. */
export const TRAVEL_POLICY = {
  /** Longest trip, in km, for which walking is suggested. */
  walkMaxKm: 2,
  /** Longest trip, in km, for which cycling is suggested. */
  cycleMaxKm: 8,
  /** People sharing a car in the carpool option. */
  carpoolSize: 3,
  /** From this band on, sensitive people are not sent out to walk or cycle. */
  shieldSensitiveFrom: 'poor',
} as const;

/** Rules for summarising the forecast. */
export const AIR_POLICY = {
  /** Daytime hours when airing the home is suggested: from `from` up to, not including, `until`. */
  airingHours: { from: 7, until: 21 },
  /** Hours at or above this band count as unhealthy. */
  unhealthyFrom: 'poor',
  /** Hours at or above this band make bad-air actions (masks, sealing gaps) eligible. */
  badAirFrom: 'poor',
} as const;
