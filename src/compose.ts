/**
 * Composition root: the only place that knows every concrete adapter. It reads the config,
 * builds the logger, Open-Meteo source, Gemini model and coach, and returns the app.
 */
import type { Context, Hono } from 'hono';
import { type GenerateClient, createGeminiModel, geminiClient } from './adapters/gemini';
import { createOpenMeteo } from './adapters/open-meteo';
import type { AssetStore } from './http/assets';
import { createApp } from './http/app';
import { type Config, loadConfig } from './platform/config';
import { createLogger } from './platform/logger';
import { createCoach } from './services/coach';
import type { Logger } from './services/ports';

/** Runtime-specific pieces; tests replace `fetch`, `client` and `write`. */
export interface Wiring {
  readonly assets: AssetStore;
  readonly fetch?: typeof fetch;
  readonly client?: (apiKey: string) => GenerateClient;
  readonly write?: (line: string) => void;
  readonly peer?: (c: Context) => string | undefined;
}

/** A ready-to-serve application and what it was built from. */
export interface Runtime {
  readonly app: Hono;
  readonly config: Config;
  readonly logger: Logger;
}

/** Wires the application from environment variables. */
export function compose(
  env: Readonly<Record<string, string | undefined>>,
  wiring: Wiring,
): Runtime {
  const config = loadConfig(env);
  const write = wiring.write ?? ((line: string) => process.stdout.write(line));
  const logger = createLogger(write, config.apiKey === null ? [] : [config.apiKey]);
  const client = wiring.client ?? geminiClient;
  const coach = createCoach({
    air: createOpenMeteo({ fetch: wiring.fetch ?? fetch, timeoutMs: 8000 }),
    model:
      config.apiKey === null
        ? null
        : createGeminiModel(client(config.apiKey), config.modelTimeoutMs),
    models: config.models,
    logger,
  });
  const app = createApp({
    coach,
    logger,
    assets: wiring.assets,
    limits: config.limits,
    trustedProxies: config.trustedProxies,
    ...(wiring.peer === undefined ? {} : { peer: wiring.peer }),
  });
  return { app, config, logger };
}
