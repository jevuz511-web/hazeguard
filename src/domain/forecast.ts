/**
 * Hourly air forecasts and the searches run over them: the reading now, the worst and
 * cleanest hours ahead, and the best daytime hour to air the home.
 */
import { type Band, type Particulates, bandFor, bandRank, naqi } from './aqi';

/** One forecast hour; `time` is local wall-clock time as `YYYY-MM-DDTHH:mm`. */
export interface AirHour extends Particulates {
  readonly time: string;
}

/** Hours in time order, starting with the current hour. Never empty. */
export type Hours = readonly [AirHour, ...AirHour[]];

/** Where a forecast applies. */
export interface Place {
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly timezone: string;
}

/** A place and its hourly particulate forecast. */
export interface Forecast {
  readonly place: Place;
  readonly hours: Hours;
}

/** An hour with its NAQI value and band. */
export interface RatedHour extends AirHour {
  readonly index: number;
  readonly band: Band;
}

/** What the next day of air looks like. */
export interface Outlook {
  readonly now: RatedHour;
  readonly worst: RatedHour;
  readonly cleanest: RatedHour;
  readonly airing: RatedHour;
  readonly unhealthyHours: number;
  readonly hours: readonly RatedHour[];
}

/** First hour of the day considered daytime for airing the home, and the first after it. */
const DAYTIME = { from: 7, until: 21 } as const;

/** Clock hour (0 to 23) of a local timestamp. */
export function hourOf(time: string): number {
  return Number(time.slice(11, 13));
}

/** Adds the NAQI value and band to an hour. */
export function rate(hour: AirHour): RatedHour {
  const index = naqi(hour);
  return { ...hour, index, band: bandFor(index) };
}

/** A forecast hour together with its position in the forecast. */
export type Slot = readonly [position: number, hour: AirHour];

/** The next forecast hour with this clock hour, or the current hour when none is listed. */
export function nextOccurrence(hours: Hours, clockHour: number): Slot {
  return [...hours.entries()].find(([, hour]) => hourOf(hour.time) === clockHour) ?? [0, hours[0]];
}

/** The lowest-PM2.5 hour within `reach` hours either side of `centre`. */
export function cleanestNear(hours: Hours, centre: Slot, reach: number): Slot {
  const distance = ([position]: Slot): number => Math.abs(position - centre[0]);
  const nearby = [...hours.entries()].filter((slot) => distance(slot) <= reach);
  // Lowest PM2.5 wins; on a tie the hour closest to the usual time wins.
  return nearby.reduce((best, next) => {
    const cleaner = next[1].pm2_5 - best[1].pm2_5 || distance(next) - distance(best);
    return cleaner < 0 ? next : best;
  }, centre);
}

function lowest(hours: readonly RatedHour[], first: RatedHour): RatedHour {
  return hours.reduce((best, hour) => (hour.pm2_5 < best.pm2_5 ? hour : best), first);
}

/** Summarises a forecast into the moments a household plans around. */
export function outlook(forecast: Forecast): Outlook {
  const now = rate(forecast.hours[0]);
  const hours = [now, ...forecast.hours.slice(1).map(rate)];
  const daytime = hours.filter((hour) => {
    const clock = hourOf(hour.time);
    return clock >= DAYTIME.from && clock < DAYTIME.until;
  });
  return {
    now,
    hours,
    worst: hours.reduce((worst, hour) => (hour.index > worst.index ? hour : worst), now),
    cleanest: lowest(hours, now),
    airing: lowest(daytime, daytime[0] ?? now),
    unhealthyHours: hours.filter((hour) => bandRank(hour.band.id) >= bandRank('poor')).length,
  };
}
