import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/platform/config';
import { createLogger } from '../../src/platform/logger';

describe('loadConfig', () => {
  it('uses safe defaults and runs without a key', () => {
    expect(loadConfig({})).toEqual({
      apiKey: null,
      models: ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-3.6-flash'],
      modelTimeoutMs: 15_000,
      port: 8080,
      limits: { perClient: 8, global: 60 },
      trustedProxies: 0,
    });
  });

  it('reads every setting', () => {
    const config = loadConfig({
      GEMINI_API_KEY: ' AQ.key ',
      GEMINI_MODELS: 'a,b',
      GEMINI_TIMEOUT_MS: '9000',
      PORT: '3000',
      RATE_LIMIT_PER_MINUTE: '3',
      GLOBAL_PLANS_PER_MINUTE: '30',
      TRUSTED_PROXIES: '1',
    });
    expect(config).toMatchObject({
      apiKey: 'AQ.key',
      models: ['a', 'b'],
      port: 3000,
      trustedProxies: 1,
    });
  });

  it('names bad variables without echoing their values', () => {
    expect(() =>
      loadConfig({ PORT: 'eighty', GEMINI_MODELS: 'a,,b', GEMINI_API_KEY: 'AQ.secret' }),
    ).toThrow('Invalid environment variables: GEMINI_MODELS, PORT');
    try {
      loadConfig({ PORT: '0', GEMINI_API_KEY: 'AQ.secret' });
    } catch (error) {
      expect(String(error)).not.toContain('AQ.secret');
    }
  });
});

describe('createLogger', () => {
  it('writes one JSON line per event and masks secrets', () => {
    const lines: string[] = [];
    const logger = createLogger((line) => lines.push(line), ['AQ.secret', '']);
    logger.info('server.started', { port: 1 });
    logger.warn('model.failed', { reason: 'bad key AQ.secret' });
    logger.error('request.failed');
    const entries = lines.map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(entries.map((entry) => [entry['level'], entry['event']])).toEqual([
      ['info', 'server.started'],
      ['warn', 'model.failed'],
      ['error', 'request.failed'],
    ]);
    expect(lines.join('')).not.toContain('AQ.secret');
    expect(entries[1]?.['reason']).toBe('bad key [redacted]');
    expect(lines.every((line) => line.endsWith('\n'))).toBe(true);
  });

  it('works with no secrets', () => {
    const lines: string[] = [];
    createLogger((line) => lines.push(line)).info('x');
    expect(lines).toHaveLength(1);
  });
});
