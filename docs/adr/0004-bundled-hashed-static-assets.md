# ADR 0004: esbuild bundles with content hashes, served from memory

- **Status:** accepted
- **Date:** 2026-11-26

## Context

The page should load fast on mid-range phones and slow networks. The app must also send its own security headers (CSP with Trusted Types) on every response, including static files, on both Vercel and a plain Node server.

## Decision

- **Build:** `scripts/build.mjs` uses esbuild to bundle and minify the browser TypeScript and CSS into one file each, named with a content hash.
- **Serve:** at startup, `src/http/assets.ts` reads the built files once, precompresses them with Brotli (quality 11) and gzip (level 9), and serves them from memory with ETags.
- **Cache:** hashed files are cached for a year as `immutable`; the HTML is revalidated.
- **Vercel:** every path is rewritten to one function, so the same middleware runs everywhere.

## Consequences

- A first visit is about 11 KB over five requests, and repeat visits revalidate only the HTML.
- No CDN-specific header configuration is needed, so the security headers can't drift between hosts.
- A deploy must rebuild, because hashed names change with content (CI and Vercel both run `npm run build`).
