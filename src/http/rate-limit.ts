/**
 * Fixed-window rate limits: one per client address and one for the whole server, which
 * caps total Gemini spend even if many addresses are used at once.
 */
import type { Context, MiddlewareHandler } from 'hono';
import { Problem } from '../services/problem';

/** Limit settings; `now` is injectable so tests control time. */
export interface RateLimitOptions {
  readonly perClient: number;
  readonly global: number;
  readonly windowMs?: number;
  readonly now?: () => number;
  /** Most clients tracked at once; the oldest are forgotten first. */
  readonly maxClients?: number;
}

/** Works out the caller's address for a request. */
export type ClientKey = (headers: Headers, peer: string | undefined) => string;

/** Picks the address added by the outermost trusted proxy, or the socket peer. */
export function clientAddress(trustedProxies: number): ClientKey {
  return (headers, peer) => {
    if (trustedProxies === 0) return peer ?? 'unknown';
    const hops = (headers.get('x-forwarded-for') ?? '').split(',').map((hop) => hop.trim());
    const hop = hops.at(-trustedProxies) ?? '';
    return hop === '' ? (peer ?? 'unknown') : hop;
  };
}

/** A per-window counter keyed by client. */
function createCounter(options: RateLimitOptions) {
  const windowMs = options.windowMs ?? 60_000;
  const now = options.now ?? Date.now;
  const maxClients = options.maxClients ?? 10_000;
  let windowStart = now();
  let total = 0;
  const perClient = new Map<string, number>();
  return (key: string): number | null => {
    if (now() - windowStart >= windowMs) {
      windowStart = now();
      total = 0;
      perClient.clear();
    }
    const used = perClient.get(key) ?? 0;
    const retryAfter = Math.ceil((windowStart + windowMs - now()) / 1000);
    if (used >= options.perClient || total >= options.global) return retryAfter;
    if (perClient.size >= maxClients) perClient.clear();
    perClient.set(key, used + 1);
    total += 1;
    return null;
  };
}

/** Middleware that answers 429 with Retry-After once a limit is reached. */
export function rateLimit(
  options: RateLimitOptions,
  keyOf: (c: Context) => string,
): MiddlewareHandler {
  const take = createCounter(options);
  return async (c, next) => {
    const retryAfterSeconds = take(keyOf(c));
    if (retryAfterSeconds !== null) {
      throw new Problem('rate-limited', 'Too many plans in a short time. Please wait a minute.', {
        retryAfterSeconds,
      });
    }
    await next();
  };
}
