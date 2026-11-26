# Efficiency

## Page weight (measured on the production build)

| File                                 | Raw         | Brotli (q11)              | Caching                           |
| ------------------------------------ | ----------- | ------------------------- | --------------------------------- |
| `index.html`                         | 11.7 KB     | 2.6 KB                    | `no-cache` + ETag (304 on repeat) |
| `app-[hash].js` (whole UI, minified) | 17.5 KB     | 6.0 KB                    | 1 year, `immutable`               |
| `styles-[hash].css`                  | 7.0 KB      | 2.0 KB                    | 1 year, `immutable`               |
| `icon.svg`, `manifest.webmanifest`   | 0.5 KB      | 0.4 KB                    | ETag                              |
| **First visit**                      | **36.7 KB** | **≈ 11 KB in 5 requests** |                                   |

- **No frameworks or fonts.** No framework, web fonts or third-party scripts are loaded, and there is no client-side router.
- **Repeat visits** need only the HTML revalidation, which is answered with a 304.

## Server

- **Precompressed, in-memory static files** (`src/http/assets.ts`).
  - Every file is read once at startup and compressed with Brotli (quality 11) and gzip (level 9).
  - Requests are answered from memory with content negotiation (`q=0` honoured), ETags and `Vary: Accept-Encoding`.
- **Content-hashed bundles** are built by esbuild (`scripts/build.mjs`). They change name when their content changes, so they are cached for a year.
- **Caches for upstream data** (`src/adapters/ttl-cache.ts`):
  - Geocoding results are kept for 6 hours and forecasts for 20 minutes.
  - Both are keyed by place and rounded coordinates, and capped at 500 entries with oldest-first eviction.
  - A school's parents in one city share one Open-Meteo call.
- **One model call in the common case.**
  - Gemini returns structured JSON from a short brief (facts plus eligible ids, no catalogue prose).
  - A second call happens only when a reply fails its checks.
  - Each call has a hard timeout (15 s by default), and the plan never waits on more than three.
- **Compression for API replies** (`hono/compress`).
- **Bounded memory**: the rate-limit table and both caches have fixed caps.

## Browser

- **One module script.** It is loaded with `type="module"` (deferred by default), so the page renders before any JavaScript runs.
- **Rendering on demand.** The DOM is built once per plan with `replaceChildren`, and only the parts that change are touched. The 24-hour strip is drawn with CSS custom properties, not a chart library.
- **Saved plans and ticks** live in `localStorage`, so reopening the page shows the last plan without a network call.
- **Network:** fetches have a 45 s timeout and become a plain-language message on failure.

## Cost controls

- **Rate limits:** per-client and global limits cap Gemini usage.
- **No key needed:** with no key configured, the app still works using the rules, at zero model cost.
- **Model order:** the chain starts with the lightest models (`flash-lite`).
