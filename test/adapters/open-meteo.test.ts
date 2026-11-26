import { describe, expect, it } from 'vitest';
import { createOpenMeteo, upcomingHours } from '../../src/adapters/open-meteo';

const times = Array.from({ length: 48 }, (_, i) => {
  const day = i < 24 ? '01' : '02';
  return `2026-12-${day}T${String(i % 24).padStart(2, '0')}:00`;
});

function airReply(overrides: object = {}) {
  return {
    timezone: 'Asia/Kolkata',
    current: { time: '2026-12-01T05:30' },
    hourly: {
      time: times,
      pm2_5: times.map((_, i) => 100 + i),
      pm10: times.map((_, i) => 150 + i),
    },
    ...overrides,
  };
}

const LUCKNOW = {
  results: [
    {
      name: 'Lucknow',
      latitude: 26.85,
      longitude: 80.95,
      timezone: 'Asia/Kolkata',
      admin1: 'Uttar Pradesh',
      country: 'India',
    },
  ],
};

function fakeFetch(replies: Record<string, { status?: number; body: unknown }>) {
  const urls: URL[] = [];
  const send = (input: URL) => {
    const url = new URL(input.href);
    urls.push(url);
    const key = url.hostname.startsWith('geocoding') ? 'geocode' : 'air';
    const reply = replies[key];
    if (reply === undefined) return Promise.reject(new TypeError('network down'));
    return Promise.resolve(
      new Response(JSON.stringify(reply.body), { status: reply.status ?? 200 }),
    );
  };
  return { urls, send: send as typeof fetch };
}

describe('upcomingHours', () => {
  it('starts at the current hour and keeps 24 hours', () => {
    const hours = upcomingHours(airReply());
    expect(hours[0]).toEqual({ time: '2026-12-01T05:00', pm2_5: 105, pm10: 155 });
    expect(hours).toHaveLength(24);
  });

  it('skips hours with missing readings and stops at the end of the data', () => {
    const pm2_5 = times.map((_, i) => (i === 6 ? null : 100 + i));
    const hours = upcomingHours(
      airReply({
        current: { time: '2026-12-02T20:00' },
        hourly: { time: times, pm2_5, pm10: pm2_5 },
      }),
    );
    expect(hours.map((hour) => hour.time.slice(11, 13))).toEqual(['20', '21', '22', '23']);
    const gappy = upcomingHours(airReply({ hourly: { time: times, pm2_5, pm10: pm2_5 } }));
    expect(gappy.some((hour) => hour.time === '2026-12-01T06:00')).toBe(false);
  });

  it('starts at the beginning when the current hour is not listed', () => {
    expect(upcomingHours(airReply({ current: { time: '2030-01-01T00:00' } }))[0].time).toBe(
      times[0],
    );
  });

  it('fails as unavailable when no hour is complete', () => {
    const empty = times.map(() => null);
    expect(() =>
      upcomingHours(airReply({ hourly: { time: times, pm2_5: empty, pm10: empty } })),
    ).toThrow(/unavailable/u);
  });
});

describe('createOpenMeteo', () => {
  it('geocodes a name, then fetches and caches the forecast', async () => {
    const { urls, send } = fakeFetch({ geocode: { body: LUCKNOW }, air: { body: airReply() } });
    const source = createOpenMeteo({ fetch: send, timeoutMs: 1000 });
    const first = await source.forecastFor({ kind: 'name', name: 'Lucknow' });
    await source.forecastFor({ kind: 'name', name: 'LUCKNOW' });
    expect(first.place).toEqual({
      name: 'Lucknow, Uttar Pradesh, India',
      latitude: 26.85,
      longitude: 80.95,
      timezone: 'Asia/Kolkata',
    });
    expect(urls).toHaveLength(2);
    expect(urls[1]?.searchParams.get('hourly')).toBe('pm2_5,pm10');
    expect(urls[1]?.searchParams.get('latitude')).toBe('26.850');
  });

  it('uses browser coordinates without geocoding', async () => {
    const { urls, send } = fakeFetch({ air: { body: airReply() } });
    const result = await createOpenMeteo({ fetch: send, timeoutMs: 1000 }).forecastFor({
      kind: 'coords',
      latitude: 28.6,
      longitude: 77.2,
    });
    expect(result.place.name).toBe('Your location');
    expect(urls).toHaveLength(1);
  });

  it('reports an unknown place as a field error', async () => {
    const { send } = fakeFetch({ geocode: { body: {} } });
    await expect(
      createOpenMeteo({ fetch: send, timeoutMs: 1000 }).forecastFor({ kind: 'name', name: 'Qqqq' }),
    ).rejects.toMatchObject({
      type: 'place-not-found',
      extras: { fields: { 'location.name': expect.stringMatching(/spelling/u) as string } },
    });
  });

  it('labels a place without region or country by its name alone', async () => {
    const bare = {
      results: [{ name: 'Leh', latitude: 34.2, longitude: 77.6, timezone: 'Asia/Kolkata' }],
    };
    const { send } = fakeFetch({ geocode: { body: bare }, air: { body: airReply() } });
    const result = await createOpenMeteo({ fetch: send, timeoutMs: 1000 }).forecastFor({
      kind: 'name',
      name: 'Leh',
    });
    expect(result.place.name).toBe('Leh');
  });

  it.each([
    ['a network failure', {}],
    ['an HTTP error', { air: { status: 502, body: {} } }],
    ['a malformed reply', { air: { body: { hourly: 'nope' } } }],
  ])('turns %s into a 503 problem', async (_label, replies) => {
    const { send } = fakeFetch(replies);
    await expect(
      createOpenMeteo({ fetch: send, timeoutMs: 1000 }).forecastFor({
        kind: 'coords',
        latitude: 1,
        longitude: 1,
      }),
    ).rejects.toMatchObject({ status: 503, type: 'air-data-unavailable' });
  });
});
