/**
 * Browser-facing defences: a strict Content Security Policy with Trusted Types, isolation
 * headers, and a same-origin gate so other sites cannot spend this app's Gemini quota.
 */
import type { MiddlewareHandler } from 'hono';
import { Problem } from '../services/problem';

const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "manifest-src 'self'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "require-trusted-types-for 'script'",
  "trusted-types 'none'",
].join('; ');

const PERMISSIONS_POLICY = [
  'geolocation=(self)',
  'camera=()',
  'microphone=()',
  'payment=()',
  'usb=()',
  'serial=()',
  'bluetooth=()',
  'magnetometer=()',
  'gyroscope=()',
  'accelerometer=()',
  'browsing-topics=()',
].join(', ');

/** Headers set on every response. */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  'Permissions-Policy': PERMISSIONS_POLICY,
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Origin-Agent-Cluster': '?1',
  'X-Permitted-Cross-Domain-Policies': 'none',
  'X-DNS-Prefetch-Control': 'off',
};

/** Adds the security headers to every response, including errors. */
export function securityHeaders(): MiddlewareHandler {
  return async (c, next) => {
    await next();
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) c.res.headers.set(name, value);
  };
}

/** True when the request plainly comes from another site. */
export function isCrossSite(headers: Headers): boolean {
  const site = headers.get('sec-fetch-site');
  if (site !== null) return site !== 'same-origin' && site !== 'none';
  const origin = headers.get('origin');
  if (origin === null) return false;
  return URL.canParse(origin) ? new URL(origin).host !== headers.get('host') : true;
}

/** Rejects cross-site and non-JSON writes before any work is done. */
export function apiGate(): MiddlewareHandler {
  return async (c, next) => {
    if (isCrossSite(c.req.raw.headers)) {
      throw new Problem('cross-site', 'Requests from other sites are not allowed.');
    }
    const type = c.req.header('content-type') ?? '';
    if (!/^application\/json\b/iu.test(type)) {
      throw new Problem('unsupported-media-type', 'Send the plan request as JSON.');
    }
    c.header('Cache-Control', 'no-store');
    await next();
  };
}
