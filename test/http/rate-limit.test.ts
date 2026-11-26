import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { problemResponse } from '../../src/http/app';
import { rateLimit } from '../../src/http/rate-limit';
import { Problem } from '../../src/services/problem';

function limitedApp(options: Parameters<typeof rateLimit>[0]) {
  const app = new Hono();
  app.use(
    '*',
    rateLimit(options, (c) => c.req.header('x-client') ?? 'anon'),
  );
  app.get('/', (c) => c.text('ok'));
  app.onError((error, c) => problemResponse(c, error as Problem));
  return (client: string) => app.request('/', { headers: { 'x-client': client } });
}

describe('rateLimit', () => {
  it('opens a new window once the old one has passed', async () => {
    let now = 0;
    const send = limitedApp({ perClient: 1, global: 10, windowMs: 1000, now: () => now });
    expect((await send('a')).status).toBe(200);
    const limited = await send('a');
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBe('1');
    now = 1000;
    expect((await send('a')).status).toBe(200);
  });

  it('caps the whole server across clients', async () => {
    const send = limitedApp({ perClient: 5, global: 2 });
    expect([(await send('a')).status, (await send('b')).status, (await send('c')).status]).toEqual([
      200, 200, 429,
    ]);
  });

  it('forgets clients when too many are tracked, so memory stays bounded', async () => {
    const send = limitedApp({ perClient: 1, global: 100, maxClients: 2 });
    for (const client of ['a', 'b', 'c']) await send(client);
    expect((await send('a')).status).toBe(200);
    expect(new Problem('rate-limited', 'x').status).toBe(429);
  });
});
