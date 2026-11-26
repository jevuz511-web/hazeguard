/**
 * The HTTP application: security headers on everything, a request id for tracing, a gated
 * and rate-limited plan endpoint, a health check, in-memory static files and RFC 9457
 * problem responses.
 */
import { type Context, type Handler, Hono, type MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { compress } from 'hono/compress';
import { type RequestIdVariables, requestId } from 'hono/request-id';
import type { Coach } from '../services/coach';
import type { Logger } from '../services/ports';
import { Problem } from '../services/problem';
import { type AssetStore, serveAssets } from './assets';
import { PlanBodySchema, fieldErrors, toPlanRequest } from './plan-request';
import { type RateLimitOptions, clientAddress, rateLimit } from './rate-limit';
import { apiGate, securityHeaders } from './security';

/** Per-request values the app keeps on the Hono context. */
export interface AppEnv {
  Variables: RequestIdVariables;
}

/** The HazeGuard Hono app. */
export type App = Hono<AppEnv>;

/** Everything the app is built from. */
export interface AppOptions {
  readonly coach: Coach;
  readonly assets: AssetStore;
  readonly logger: Logger;
  readonly limits: RateLimitOptions;
  readonly trustedProxies: number;
  /** Socket address of the caller, when the runtime exposes one. */
  readonly peer?: (c: Context) => string | undefined;
}

/** Largest accepted request body. */
export const MAX_BODY_BYTES = 16 * 1024;

/** Sends a problem as `application/problem+json`. */
export function problemResponse(c: Context, problem: Problem): Response {
  const seconds = problem.extras.retryAfterSeconds;
  if (seconds !== undefined) c.header('Retry-After', String(seconds));
  if (problem.type === 'method-not-allowed') c.header('Allow', 'POST');
  c.header('Cache-Control', 'no-store');
  c.header('Content-Type', 'application/problem+json');
  return c.body(JSON.stringify(problem), problem.status);
}

async function readJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch (error) {
    throw new Problem('invalid-request', 'The request body is not valid JSON.', { cause: error });
  }
}

/** Validates the body, asks the coach for a plan and logs how it was made. */
function planHandler(options: AppOptions): Handler<AppEnv> {
  return async (c) => {
    const started = performance.now();
    const parsed = PlanBodySchema.safeParse(await readJson(c));
    if (!parsed.success) {
      const fields = fieldErrors(parsed.error);
      throw new Problem('invalid-request', 'Some answers need checking.', { fields });
    }
    const plan = await options.coach.plan(toPlanRequest(parsed.data));
    options.logger.info('plan.created', {
      requestId: c.get('requestId'),
      author: plan.author.kind,
      ms: Math.round(performance.now() - started),
    });
    return c.json(plan);
  };
}

/** The middleware chain and handler for POST /api/plan. */
function planRoute(
  options: AppOptions,
): [MiddlewareHandler, MiddlewareHandler, MiddlewareHandler, Handler<AppEnv>] {
  const address = clientAddress(options.trustedProxies);
  const tooLarge = (): never => {
    throw new Problem('payload-too-large', 'The request is too large.');
  };
  return [
    apiGate(),
    rateLimit(options.limits, (c) => address(c.req.raw.headers, options.peer?.(c))),
    bodyLimit({ maxSize: MAX_BODY_BYTES, onError: tooLarge }),
    planHandler(options),
  ];
}

/** Turns any error into a problem response, logging the unexpected ones with the request id. */
function handleError(logger: Logger): (error: Error, c: Context<AppEnv>) => Response {
  return (error, c) => {
    const problem =
      error instanceof Problem
        ? error
        : new Problem('internal', 'Something went wrong on our side. Please try again.');
    if (problem.status >= 500) {
      logger.error('request.failed', {
        requestId: c.get('requestId'),
        path: c.req.path,
        status: problem.status,
        error: error.name,
      });
    }
    return problemResponse(c, problem);
  };
}

/** Builds the Hono app. */
export function createApp(options: AppOptions): App {
  const app = new Hono<AppEnv>();
  app.use('*', requestId(), securityHeaders());
  app.use('/api/*', compress());
  app.get('/api/health', (c) => c.json({ status: 'ok' }));
  const [gate, limit, size, plan] = planRoute(options);
  app.post('/api/plan', gate, limit, size, plan);
  app.all('/api/plan', () => {
    throw new Problem('method-not-allowed', 'Use POST to request a plan.');
  });
  app.use('*', serveAssets(options.assets));
  app.notFound((c) => problemResponse(c, new Problem('not-found', 'Page not found.')));
  app.onError(handleError(options.logger));
  return app;
}
