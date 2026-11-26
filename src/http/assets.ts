/**
 * Static files served from memory. Each file is read once at startup, pre-compressed with
 * Brotli and gzip, and given an ETag; content-hashed bundles are cached for a year.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import type { MiddlewareHandler } from 'hono';

/** Bytes backed by a plain ArrayBuffer, which is what a Response body accepts. */
type Bytes = Uint8Array<ArrayBuffer>;

/** One file ready to send. */
export interface Asset {
  readonly type: string;
  readonly etag: string;
  readonly cacheControl: string;
  readonly identity: Bytes;
  readonly br: Bytes | null;
  readonly gzip: Bytes | null;
}

/** URL path → asset. */
export type AssetStore = ReadonlyMap<string, Asset>;

const TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
};

const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.svg', '.json', '.webmanifest', '.txt']);
const HASHED = /-[A-Z0-9]{8}\.(?:js|css)$/u;

/** Builds the in-memory asset for one file. */
export function toAsset(path: string, content: Uint8Array): Asset {
  const extension = extname(path);
  const identity: Bytes = new Uint8Array(content);
  const compress = COMPRESSIBLE.has(extension);
  return {
    type: TYPES[extension] ?? 'application/octet-stream',
    etag: `"${createHash('sha256').update(identity).digest('base64url').slice(0, 22)}"`,
    cacheControl: HASHED.test(path) ? 'public, max-age=31536000, immutable' : 'no-cache',
    identity,
    br: compress
      ? brotliCompressSync(identity, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } })
      : null,
    gzip: compress ? gzipSync(identity, { level: 9 }) : null,
  };
}

/** Reads every file under `root` into memory, keyed by URL path. */
export function loadAssets(root: string): AssetStore {
  const store = new Map<string, Asset>();
  for (const entry of readdirSync(root, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const file = join(entry.parentPath, entry.name);
    const path = `/${relative(root, file).split(sep).join('/')}`;
    store.set(path, toAsset(path, readFileSync(file)));
  }
  return store;
}

/** The encoded body to send. */
export interface Encoded {
  readonly encoding: 'br' | 'gzip' | null;
  readonly body: Bytes;
}

/** The best encoding the client accepts: Brotli, then gzip, then none. */
export function encode(asset: Asset, accept: string): Encoded {
  const offered = new Set(
    accept
      .split(',')
      .filter((part) => !/;\s*q=0(?:\.0+)?\s*$/u.test(part))
      .map((part) => part.split(';')[0]?.trim().toLowerCase()),
  );
  if (asset.br !== null && offered.has('br')) return { encoding: 'br', body: asset.br };
  if (asset.gzip !== null && offered.has('gzip')) return { encoding: 'gzip', body: asset.gzip };
  return { encoding: null, body: asset.identity };
}

/** The full response for an asset, honouring If-None-Match, Accept-Encoding and HEAD. */
export function assetResponse(asset: Asset, request: Request): Response {
  const headers = new Headers({
    ETag: asset.etag,
    'Cache-Control': asset.cacheControl,
    Vary: 'Accept-Encoding',
  });
  if (request.headers.get('if-none-match') === asset.etag) {
    return new Response(null, { status: 304, headers });
  }
  const { encoding, body } = encode(asset, request.headers.get('accept-encoding') ?? '');
  headers.set('Content-Type', asset.type);
  if (encoding !== null) headers.set('Content-Encoding', encoding);
  return new Response(request.method === 'HEAD' ? null : body, {
    headers,
  });
}

/** Serves GET and HEAD requests for known assets; everything else falls through. */
export function serveAssets(store: AssetStore): MiddlewareHandler {
  return async (c, next) => {
    const asset = store.get(c.req.path === '/' ? '/index.html' : c.req.path);
    if (asset === undefined || !['GET', 'HEAD'].includes(c.req.method)) return next();
    return assetResponse(asset, c.req.raw);
  };
}
