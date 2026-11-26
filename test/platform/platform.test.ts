import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/platform/config';
import { createLogger } from '../../src/platform/logger';

describe('loadConfig', () => {
  it('uses safe defaults and runs without a key', () => {
    expect(loadConfig({})).toEqual({
      apiKey: null,
      models: ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.6-flash'],
      modelTimeoutMs: 15_000,
      airTimeoutMs: 8000,
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

  it('prefers a key from a mounted secret file', () => {
    const files: string[] = [];
    const read = (path: string) => {
      files.push(path);
      return '  AQ.secret-from-file  ';
    };
    const config = loadConfig(
      { GEMINI_API_KEY: 'AQ.key', GEMINI_API_KEY_FILE: '/run/secrets/gemini' },
      read,
    );
    expect(config.apiKey).toBe('AQ.secret-from-file');
    expect(files).toEqual(['/run/secrets/gemini']);
    expect(loadConfig({ GEMINI_API_KEY_FILE: '/empty' }, () => ' ').apiKey).toBeNull();
  });

  it('reads the secret file from disk by default', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hazeguard-secret-'));
    try {
      writeFileSync(join(dir, 'key'), ' AQ.secret-on-disk ');
      expect(loadConfig({ GEMINI_API_KEY_FILE: join(dir, 'key') }).apiKey).toBe(
        'AQ.secret-on-disk',
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fails clearly when the secret file cannot be read', () => {
    const missing = () => {
      throw new Error('ENOENT');
    };
    expect(() => loadConfig({ GEMINI_API_KEY_FILE: '/missing' }, missing)).toThrow(
      'GEMINI_API_KEY_FILE could not be read',
    );
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
