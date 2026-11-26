import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { GenerateClient } from '../src/adapters/gemini';
import { compose } from '../src/compose';
import { startServer } from '../src/node-server';
import { vercelHandler } from '../src/vercel';
import { goodReply, planBody } from './fixtures';
import { TEST_ASSETS } from './http/support';

const root = mkdtempSync(join(tmpdir(), 'hazeguard-entry-'));
mkdirSync(join(root, 'dist', 'public'), { recursive: true });
writeFileSync(
  join(root, 'dist', 'public', 'index.html'),
  '<!doctype html><title>HazeGuard</title>',
);
afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

const airFetch = (() =>
  Promise.resolve(
    Response.json({
      timezone: 'Asia/Kolkata',
      current: { time: '2026-12-01T09:00' },
      hourly: { time: ['2026-12-01T09:00'], pm2_5: [180], pm10: [240] },
    }),
  )) as typeof fetch;

describe('compose', () => {
  it('wires Gemini when a key is set and masks the key in logs', async () => {
    const lines: string[] = [];
    let seenKey = '';
    const client = (key: string): GenerateClient => {
      seenKey = key;
      return { models: { generateContent: () => Promise.resolve({ text: goodReply() }) } };
    };
    const { app, config } = compose(
      { GEMINI_API_KEY: 'AQ.test-key', GEMINI_MODELS: 'only-model' },
      { assets: TEST_ASSETS, fetch: airFetch, client, write: (line) => lines.push(line) },
    );
    const body = planBody({ location: { kind: 'coords', latitude: 26.8, longitude: 80.9 } });
    const response = await app.request('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    expect(response.status).toBe(200);
    expect(((await response.json()) as { author: unknown }).author).toEqual({
      kind: 'gemini',
      model: 'only-model',
    });
    expect(seenKey).toBe('AQ.test-key');
    expect(config.apiKey).toBe('AQ.test-key');
  });

  it('runs rules-only without a key, using the socket peer for rate limits', async () => {
    const peers: string[] = [];
    const { app, config } = compose(
      { RATE_LIMIT_PER_MINUTE: '1' },
      {
        assets: TEST_ASSETS,
        fetch: airFetch,
        peer: () => {
          peers.push('peer');
          return '10.0.0.1';
        },
      },
    );
    expect(config.apiKey).toBeNull();
    const send = () =>
      app.request('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(planBody()),
      });
    // The fake air service has no geocoding results, so the place is reported as not found.
    expect((await send()).status).toBe(422);
    expect((await send()).status).toBe(429);
    expect(peers).toHaveLength(2);
  });

  it('writes logs to stdout by default', () => {
    const runtime = compose({}, { assets: TEST_ASSETS });
    expect(typeof runtime.logger.info).toBe('function');
  });
});

describe('vercelHandler', () => {
  it('serves the built page and removes the key from the environment', async () => {
    const env: Record<string, string | undefined> = { GEMINI_API_KEY: 'AQ.test-key' };
    const handle = vercelHandler(env, root);
    expect(env['GEMINI_API_KEY']).toBeUndefined();
    const response = await handle(new Request('https://hazeguard.example/'));
    expect(response.status).toBe(200);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });
});

describe('startServer', () => {
  it('listens with slow-client timeouts and serves requests', async () => {
    const env: Record<string, string | undefined> = {
      PORT: '18997',
      GEMINI_API_KEY: 'AQ.test-key',
    };
    const server = startServer(env, join(root, 'dist', 'public'));
    try {
      await new Promise((resolve) => server.once('listening', resolve));
      expect(env['GEMINI_API_KEY']).toBeUndefined();
      expect(server.headersTimeout).toBe(10_000);
      const { port } = server.address() as AddressInfo;
      const response = await fetch(`http://127.0.0.1:${String(port)}/api/health`);
      expect(await response.json()).toEqual({ status: 'ok' });
      const invalid = await fetch(`http://127.0.0.1:${String(port)}/api/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      expect(invalid.status).toBe(400);
    } finally {
      const onSigterm = process.listeners('SIGTERM').at(-1) as () => void;
      onSigterm();
      process.removeListener('SIGTERM', onSigterm);
      expect(server.listening).toBe(false);
    }
  });
});
