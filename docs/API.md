# HTTP API

All responses carry the security headers listed in [SECURITY.md](../SECURITY.md) and an `X-Request-Id`. A request's own `X-Request-Id` is echoed back; otherwise a UUID is generated. The same id appears in the server logs.

## `GET /api/health`

`200 {"status":"ok"}`. Used for uptime checks.

## `POST /api/plan`

Creates a smog-season plan.

**Request requirements**

- `Content-Type: application/json`
- A same-origin request (`Sec-Fetch-Site: same-origin`, or a matching `Origin`)
- A body of at most 16 KB
- Rate limits: per client and server-wide (see `.env.example`)

**Body** (strict: unknown keys are rejected; defined in `src/http/plan-request.ts`)

| Field       | Type                                                                         | Rules                                                                                                                                                                 |
| ----------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `location`  | `{ kind: 'name', name }` or `{ kind: 'coords', latitude, longitude }`        | `name` 1 to 80 characters; latitude −90 to 90; longitude −180 to 180                                                                                                  |
| `members`   | array of `child`, `older-adult`, `respiratory`, `pregnant`, `outdoor-worker` | duplicates are ignored                                                                                                                                                |
| `home`      | `{ cooking, heating, purifier, smoker }`                                     | cooking: `lpg`, `piped-gas`, `induction`, `biomass`, `kerosene`; heating: `none`, `electric`, `gas`, `kerosene`, `wood-or-coal`; `purifier` and `smoker` are booleans |
| `trips`     | up to 5 × `{ label, km, mode, departHour, perWeek }`                         | label 1 to 40 characters; km 0.1 to 150; mode: `walk`, `cycle`, `bus`, `metro`, `motorbike`, `car`, `carpool`; departHour 0 to 23; perWeek 1 to 14                    |
| `transit`   | `{ bus, metro }`                                                             | booleans: within a 10-minute walk                                                                                                                                     |
| `flexHours` | integer                                                                      | 0 to 3                                                                                                                                                                |
| `audience`  | `{ kind: 'household' }` or `{ kind: 'community', setting, people }`          | setting: `residents`, `school`, `workplace`; people 2 to 100,000                                                                                                      |
| `language`  | `en` or `hi`                                                                 | language of the written advice                                                                                                                                        |
| `note`      | string or `null`                                                             | up to 280 characters; control and bidi-override characters are rejected                                                                                               |

**200 response**: a `Plan` (`src/services/coach.ts`).

| Field                  | Contents                                                                                                                                                                                                                               |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `assessment`           | `place`, `outlook` (`now`, `worst`, `cleanest`, `airing`, `unhealthyHours`, 24 rated `hours`), `trips` (usual and better leg, changes, weekly CO₂ and dose saved), `actions` (eligible catalogue entries, most urgent first), `impact` |
| `writing`              | `summary`, `picks` (catalogue `id` plus `why`, or `null` when written by rules), `notice` (`headline` and `body`, or `null`)                                                                                                           |
| `author`               | `{ kind: 'gemini', model }` or `{ kind: 'rules' }`                                                                                                                                                                                     |
| `audience`, `language` | as requested                                                                                                                                                                                                                           |
| `notices`              | `note-ignored`, `written-by-rules`                                                                                                                                                                                                     |

Units: `km`, `kg CO₂e`, `µg` (inhaled PM2.5), `µg/m³` (concentration), minutes.

## Errors

Errors are RFC 9457 problem details with the media type `application/problem+json`, as `{ type, title, status, detail?, fields? }`. Causes and stack traces are never sent.

| `type`                             | Status | When                                                                                                 |
| ---------------------------------- | ------ | ---------------------------------------------------------------------------------------------------- |
| `/problems/invalid-request`        | 400    | Not JSON, or the body fails validation (`fields` maps each path, such as `trips.0.km`, to a message) |
| `/problems/cross-site`             | 403    | The request came from another site                                                                   |
| `/problems/not-found`              | 404    | Unknown path                                                                                         |
| `/problems/method-not-allowed`     | 405    | Any method other than POST on `/api/plan` (sends `Allow: POST`)                                      |
| `/problems/payload-too-large`      | 413    | Body over 16 KB                                                                                      |
| `/problems/unsupported-media-type` | 415    | Not `application/json`                                                                               |
| `/problems/place-not-found`        | 422    | Geocoding found no match (`fields['location.name']` explains)                                        |
| `/problems/rate-limited`           | 429    | Per-client or global limit reached (sends `Retry-After`)                                             |
| `/problems/internal`               | 500    | Unexpected error (logged with the request id)                                                        |
| `/problems/air-data-unavailable`   | 503    | Open-Meteo is unreachable or returned bad data                                                       |
