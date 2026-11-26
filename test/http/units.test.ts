import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { assetResponse, encode, loadAssets, toAsset } from '../../src/http/assets';
import { PlanBodySchema, fieldErrors, toPlanRequest } from '../../src/http/plan-request';
import { clientAddress } from '../../src/http/rate-limit';
import { isCrossSite } from '../../src/http/security';
import { planBody } from '../fixtures';

const BIDI_OVERRIDE = String.fromCodePoint(0x202e);
const ZERO_WIDTH_JOINER = String.fromCodePoint(0x200d);

describe('PlanBodySchema', () => {
  it('accepts a full body and turns it into a coach request', () => {
    const body = PlanBodySchema.parse(planBody({ members: ['child', 'child'] }));
    const request = toPlanRequest(body);
    expect(request.household.members).toEqual(['child']);
    expect(request.location).toEqual({ kind: 'name', name: 'Lucknow' });
  });

  it('rejects hidden direction overrides but allows Devanagari joiners', () => {
    const tricky = PlanBodySchema.safeParse(planBody({ note: `ok${BIDI_OVERRIDE}evil` }));
    expect(tricky.success).toBe(false);
    expect(PlanBodySchema.safeParse(planBody({ note: `क्${ZERO_WIDTH_JOINER}ष` })).success).toBe(
      true,
    );
  });

  it('rejects unknown keys and out-of-range values', () => {
    expect(PlanBodySchema.safeParse({ ...planBody(), admin: true }).success).toBe(false);
    const people = PlanBodySchema.safeParse(
      planBody({ audience: { kind: 'community', setting: 'school', people: 1 } }),
    );
    expect(people.success).toBe(false);
  });

  it('reports one message per field path', () => {
    const result = PlanBodySchema.safeParse({ ...planBody(), flexHours: null });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(fieldErrors(result.error)).toEqual({ flexHours: 'Enter a number.' });
    const whole = PlanBodySchema.safeParse(null);
    if (!whole.success) expect(Object.keys(fieldErrors(whole.error))).toEqual(['body']);
  });
});

describe('isCrossSite', () => {
  const headers = (init: Record<string, string>) => new Headers(init);

  it('trusts Sec-Fetch-Site when the browser sends it', () => {
    expect(isCrossSite(headers({ 'sec-fetch-site': 'same-origin' }))).toBe(false);
    expect(isCrossSite(headers({ 'sec-fetch-site': 'none' }))).toBe(false);
    expect(isCrossSite(headers({ 'sec-fetch-site': 'same-site' }))).toBe(true);
  });

  it('falls back to comparing Origin with Host', () => {
    expect(isCrossSite(headers({ origin: 'https://hazeguard.app', host: 'hazeguard.app' }))).toBe(
      false,
    );
    expect(isCrossSite(headers({ origin: 'https://evil.example', host: 'hazeguard.app' }))).toBe(
      true,
    );
    expect(isCrossSite(headers({ origin: 'null', host: 'hazeguard.app' }))).toBe(true);
    expect(isCrossSite(headers({}))).toBe(false);
  });
});

describe('clientAddress', () => {
  it('uses the socket peer unless proxies are trusted', () => {
    expect(clientAddress(0)(new Headers({ 'x-forwarded-for': '1.1.1.1' }), '10.0.0.1')).toBe(
      '10.0.0.1',
    );
    expect(clientAddress(0)(new Headers(), undefined)).toBe('unknown');
  });

  it('takes the address appended by the outermost trusted proxy', () => {
    const forwarded = new Headers({ 'x-forwarded-for': 'spoofed, 203.0.113.5, 10.0.0.2' });
    expect(clientAddress(2)(forwarded, '10.0.0.3')).toBe('203.0.113.5');
    expect(clientAddress(1)(new Headers(), '10.0.0.3')).toBe('10.0.0.3');
    expect(clientAddress(5)(new Headers({ 'x-forwarded-for': 'a' }), undefined)).toBe('unknown');
  });
});

describe('assets', () => {
  const html = toAsset('/index.html', new TextEncoder().encode('<p>hello</p>'.repeat(50)));
  const hashed = toAsset('/app-ABCDEFGH.js', new TextEncoder().encode('x'));
  const image = toAsset('/photo.bin', new Uint8Array([1, 2, 3]));

  it('caches hashed bundles for a year and everything else for revalidation', () => {
    expect(hashed.cacheControl).toContain('immutable');
    expect(html.cacheControl).toBe('no-cache');
    expect(image.type).toBe('application/octet-stream');
    expect(image.br).toBeNull();
  });

  it('prefers Brotli, then gzip, and honours q=0', () => {
    expect(encode(html, 'gzip, br').encoding).toBe('br');
    expect(encode(html, 'br;q=0, gzip').encoding).toBe('gzip');
    expect(encode(html, 'identity').encoding).toBeNull();
    expect(encode(image, 'br').encoding).toBeNull();
  });

  it('answers 304 for a matching ETag and sends no body for HEAD', async () => {
    const notModified = assetResponse(
      html,
      new Request('http://x/', { headers: { 'if-none-match': html.etag } }),
    );
    expect(notModified.status).toBe(304);
    const head = assetResponse(
      html,
      new Request('http://x/', { method: 'HEAD', headers: { 'accept-encoding': 'br' } }),
    );
    expect(head.headers.get('content-encoding')).toBe('br');
    expect(await head.text()).toBe('');
  });
});

describe('loadAssets', () => {
  const root = mkdtempSync(join(tmpdir(), 'hazeguard-assets-'));
  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('loads a folder tree keyed by URL path', () => {
    mkdirSync(join(root, '.well-known'));
    writeFileSync(join(root, 'index.html'), '<!doctype html>');
    writeFileSync(join(root, '.well-known', 'security.txt'), 'Contact: x');
    const paths = [...loadAssets(root).keys()].sort((a, b) => a.localeCompare(b));
    expect(paths).toEqual(['/.well-known/security.txt', '/index.html']);
  });
});
