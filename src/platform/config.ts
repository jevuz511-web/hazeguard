/**
 * Reads and validates environment variables once at startup. Invalid settings stop the
 * server with the variable names at fault; values are never echoed, so keys stay secret.
 */
import { z } from 'zod';

const DEFAULT_MODELS = 'gemini-3.1-flash-lite,gemini-3.5-flash-lite,gemini-3.6-flash';

const count = (min: number, max: number, fallback: number) =>
  z.coerce.number().int().min(min).max(max).default(fallback);

const EnvSchema = z.object({
  GEMINI_API_KEY: z.string().trim().min(1).optional(),
  GEMINI_MODELS: z
    .string()
    .regex(/^[\w.-]+(,[\w.-]+)*$/u)
    .default(DEFAULT_MODELS),
  GEMINI_TIMEOUT_MS: count(1000, 60_000, 15_000),
  AIR_TIMEOUT_MS: count(1000, 30_000, 8000),
  PORT: count(1, 65_535, 8080),
  RATE_LIMIT_PER_MINUTE: count(1, 1000, 8),
  GLOBAL_PLANS_PER_MINUTE: count(1, 100_000, 60),
  TRUSTED_PROXIES: count(0, 5, 0),
});

/** Validated server settings. */
export interface Config {
  /** Null when no key is set: plans are then written by the rules alone. */
  readonly apiKey: string | null;
  readonly models: readonly string[];
  readonly modelTimeoutMs: number;
  /** How long to wait for Open-Meteo. */
  readonly airTimeoutMs: number;
  readonly port: number;
  readonly limits: { readonly perClient: number; readonly global: number };
  /** How many reverse proxies in front of the app append to X-Forwarded-For. */
  readonly trustedProxies: number;
}

/** Parses the environment, throwing an error that names (but never prints) bad variables. */
export function loadConfig(env: Readonly<Record<string, string | undefined>>): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))];
    throw new Error(`Invalid environment variables: ${names.join(', ')}`);
  }
  const settings = parsed.data;
  return {
    apiKey: settings.GEMINI_API_KEY ?? null,
    models: settings.GEMINI_MODELS.split(','),
    modelTimeoutMs: settings.GEMINI_TIMEOUT_MS,
    airTimeoutMs: settings.AIR_TIMEOUT_MS,
    port: settings.PORT,
    limits: { perClient: settings.RATE_LIMIT_PER_MINUTE, global: settings.GLOBAL_PLANS_PER_MINUTE },
    trustedProxies: settings.TRUSTED_PROXIES,
  };
}
