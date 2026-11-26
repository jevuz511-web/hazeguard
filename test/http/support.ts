/** Builds a test app with fakes and sends requests to it. */
import type { Hono } from 'hono';
import { toAsset } from '../../src/http/assets';
import { createApp } from '../../src/http/app';
import { createCoach } from '../../src/services/coach';
import type { TextModel } from '../../src/services/ports';
import { fixedAir, goodReply, memoryLogger, planBody, scriptedModel } from '../fixtures';

/** Static files the test app serves. */
export const TEST_ASSETS = new Map([
  [
    '/index.html',
    toAsset(
      '/index.html',
      new TextEncoder().encode('<!doctype html><title>HazeGuard</title>'.repeat(20)),
    ),
  ],
  ['/app-ABCDEFGH.js', toAsset('/app-ABCDEFGH.js', new TextEncoder().encode('console.log(1);'))],
  ['/icon.png', toAsset('/icon.png', new Uint8Array([137, 80, 78, 71]))],
]);

/** App options that tests can override. */
export interface TestAppOptions {
  readonly model?: TextModel | null;
  readonly perClient?: number;
  readonly trustedProxies?: number;
}

/** A test app plus the logger it writes to. */
export function testApp(options: TestAppOptions = {}): {
  app: Hono;
  logger: ReturnType<typeof memoryLogger>;
} {
  const logger = memoryLogger();
  const model =
    options.model === undefined
      ? scriptedModel(Array.from({ length: 20 }, () => goodReply()))
      : options.model;
  const coach = createCoach({ air: fixedAir(), model, models: ['m'], logger });
  const app = createApp({
    coach,
    logger,
    assets: TEST_ASSETS,
    limits: { perClient: options.perClient ?? 100, global: 1000 },
    trustedProxies: options.trustedProxies ?? 0,
  });
  return { app, logger };
}

/** POSTs JSON to /api/plan the way the page does. */
export function postPlan(
  app: Hono,
  body: unknown = planBody(),
  headers: Record<string, string> = {},
): Promise<Response> {
  return Promise.resolve(
    app.request('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'same-origin', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );
}
