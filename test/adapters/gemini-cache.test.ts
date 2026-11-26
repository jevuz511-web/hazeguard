import { describe, expect, it } from 'vitest';
import {
  EmptyReplyError,
  type GenerateClient,
  createGeminiModel,
  geminiClient,
} from '../../src/adapters/gemini';
import { createTtlCache } from '../../src/adapters/ttl-cache';

function fakeClient(text: string | undefined) {
  const calls: unknown[] = [];
  const client: GenerateClient = {
    models: {
      generateContent: (params) => {
        calls.push(params);
        return Promise.resolve({ text });
      },
    },
  };
  return { calls, client };
}

const request = {
  model: 'gemini-x',
  system: 'Be calm.',
  prompt: 'Facts',
  schema: { type: 'object' },
};

describe('createGeminiModel', () => {
  it('asks for JSON that follows the schema, with safety settings and a timeout', async () => {
    const { calls, client } = fakeClient(' {"ok":true} ');
    expect(await createGeminiModel(client, 5000).generate(request)).toBe('{"ok":true}');
    expect(calls[0]).toMatchObject({
      model: 'gemini-x',
      contents: 'Facts',
      config: {
        systemInstruction: 'Be calm.',
        responseMimeType: 'application/json',
        responseJsonSchema: { type: 'object' },
      },
    });
    const config = (calls[0] as { config: { safetySettings: unknown[]; abortSignal: unknown } })
      .config;
    expect(config.safetySettings).toHaveLength(4);
    expect(config.abortSignal).toBeInstanceOf(AbortSignal);
  });

  it.each([undefined, '   '])('treats an empty or blocked reply (%j) as an error', async (text) => {
    const { client } = fakeClient(text);
    await expect(createGeminiModel(client, 5000).generate(request)).rejects.toBeInstanceOf(
      EmptyReplyError,
    );
  });

  it('builds the real SDK client from a key without calling the network', () => {
    expect(typeof geminiClient('test-key').models.generateContent).toBe('function');
  });
});

describe('createTtlCache', () => {
  it('returns fresh entries and forgets expired ones', () => {
    let now = 0;
    const cache = createTtlCache<string>({ ttlMs: 100, maxEntries: 5, now: () => now });
    cache.set('a', 'A');
    expect(cache.get('a')).toBe('A');
    now = 100;
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('missing')).toBeUndefined();
  });

  it('evicts the oldest entry when full', () => {
    const cache = createTtlCache<number>({ ttlMs: 1000, maxEntries: 2 });
    const entries: [string, number][] = [
      ['a', 1],
      ['b', 2],
      ['a', 3],
      ['c', 4],
    ];
    for (const [key, value] of entries) cache.set(key, value);
    expect([cache.get('a'), cache.get('b'), cache.get('c')]).toEqual([3, undefined, 4]);
  });

  it('loads once and then remembers', async () => {
    const cache = createTtlCache<number>({ ttlMs: 1000, maxEntries: 2 });
    let loads = 0;
    const load = () => {
      loads += 1;
      return Promise.resolve(loads);
    };
    expect(await cache.remember('k', load)).toBe(1);
    expect(await cache.remember('k', load)).toBe(1);
    expect(loads).toBe(1);
  });
});
