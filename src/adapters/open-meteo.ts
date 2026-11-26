/**
 * Open-Meteo adapter: turns a place name or coordinates into a 24-hour PM2.5 and PM10
 * forecast. Free, keyless, CAMS-based; replies are validated before use and cached.
 */
import { z } from 'zod';
import type { AirHour, Forecast, Hours, Place } from '../domain/forecast';
import type { AirSource, LocationQuery } from '../services/ports';
import { Problem } from '../services/problem';
import { createTtlCache } from './ttl-cache';

const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const AIR_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const HOURS_AHEAD = 24;

const GeocodeReply = z.object({
  results: z
    .array(
      z.object({
        name: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        timezone: z.string(),
        admin1: z.string().optional(),
        country: z.string().optional(),
      }),
    )
    .optional(),
});

const AirReply = z.object({
  timezone: z.string(),
  current: z.object({ time: z.string() }),
  hourly: z.object({
    time: z.array(z.string()),
    pm2_5: z.array(z.number().nullable()),
    pm10: z.array(z.number().nullable()),
  }),
});

/** Dependencies of the adapter; `fetch` is injected so tests never touch the network. */
export interface OpenMeteoOptions {
  readonly fetch: typeof fetch;
  readonly timeoutMs: number;
}

function unavailable(cause: unknown): Problem {
  return new Problem(
    'air-data-unavailable',
    'Live air data is unavailable right now. Please try again shortly.',
    {
      cause,
    },
  );
}

async function getJson<T>(options: OpenMeteoOptions, url: URL, schema: z.ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    const response = await options.fetch(url, { signal: AbortSignal.timeout(options.timeoutMs) });
    if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);
    body = await response.json();
  } catch (error) {
    throw unavailable(error);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw unavailable(parsed.error);
  return parsed.data;
}

/** The next 24 complete hours from the current one; hours with gaps are skipped. */
export function upcomingHours(reply: z.infer<typeof AirReply>): Hours {
  const { time, pm2_5, pm10 } = reply.hourly;
  const start = Math.max(0, time.indexOf(`${reply.current.time.slice(0, 13)}:00`));
  const hours: AirHour[] = [];
  for (let i = start; i < time.length && hours.length < HOURS_AHEAD; i += 1) {
    const [stamp, fine, coarse] = [time[i], pm2_5[i], pm10[i]];
    if (stamp !== undefined && typeof fine === 'number' && typeof coarse === 'number') {
      hours.push({ time: stamp, pm2_5: fine, pm10: coarse });
    }
  }
  const [first, ...rest] = hours;
  if (first === undefined) throw unavailable(new Error('no complete hours'));
  return [first, ...rest];
}

type Spot = Omit<Place, 'timezone'>;

async function findPlace(options: OpenMeteoOptions, name: string): Promise<Spot> {
  const url = new URL(GEOCODE_URL);
  url.search = new URLSearchParams({ name, count: '1', language: 'en', format: 'json' }).toString();
  const [match] = (await getJson(options, url, GeocodeReply)).results ?? [];
  if (match === undefined) {
    throw new Problem('place-not-found', 'We could not find that place.', {
      fields: {
        'location.name': 'Check the spelling or try the nearest city, for example Lucknow.',
      },
    });
  }
  const label = [match.name, match.admin1, match.country].filter(Boolean).join(', ');
  return { name: label, latitude: match.latitude, longitude: match.longitude };
}

async function forecastAt(options: OpenMeteoOptions, spot: Spot): Promise<Forecast> {
  const url = new URL(AIR_URL);
  url.search = new URLSearchParams({
    latitude: spot.latitude.toFixed(3),
    longitude: spot.longitude.toFixed(3),
    current: 'pm2_5,pm10',
    hourly: 'pm2_5,pm10',
    timezone: 'auto',
    forecast_days: '2',
  }).toString();
  const reply = await getJson(options, url, AirReply);
  return { place: { ...spot, timezone: reply.timezone }, hours: upcomingHours(reply) };
}

/** Creates the Open-Meteo air source with 6-hour place and 20-minute forecast caches. */
export function createOpenMeteo(options: OpenMeteoOptions): AirSource {
  const places = createTtlCache<Spot>({ ttlMs: 6 * 3_600_000, maxEntries: 500 });
  const forecasts = createTtlCache<Forecast>({ ttlMs: 20 * 60_000, maxEntries: 500 });
  return {
    async forecastFor(location: LocationQuery) {
      const spot =
        location.kind === 'name'
          ? await places.remember(location.name.toLowerCase(), () =>
              findPlace(options, location.name),
            )
          : { name: 'Your location', latitude: location.latitude, longitude: location.longitude };
      const key = `${spot.name}|${spot.latitude.toFixed(2)},${spot.longitude.toFixed(2)}`;
      return forecasts.remember(key, () => forecastAt(options, spot));
    },
  };
}
