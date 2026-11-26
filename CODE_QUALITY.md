# Code quality

HazeGuard is small, layered and checked by machines on every push. This page lists the rules and where each one is enforced.

## Architecture: ports and adapters

```text
web/ ──(type-only)──▶ src/domain
src/http ──▶ src/services ──▶ src/domain
                │
                └── ports.ts ◀── src/adapters (Open-Meteo, Gemini, cache)
src/compose.ts wires concrete adapters; src/server.ts and src/vercel.ts are entry points
```

| Layer          | Responsibility                                                                                                | May import at runtime                       |
| -------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `src/domain`   | Pure rules: NAQI, forecast search, trip pricing, catalogue, eligibility, impact. No I/O, clocks or randomness | Only other domain modules                   |
| `src/services` | The plan use case, Gemini brief, reply schema and checks, problem errors, port interfaces                     | Domain, Zod                                 |
| `src/adapters` | Open-Meteo, Gemini SDK, TTL cache                                                                             | Service ports and problems, Zod, the SDK    |
| `src/http`     | Hono app, headers, gate, rate limits, request schema, static assets                                           | Domain, services, Hono, Zod, Node built-ins |
| `src/platform` | Environment config and logger                                                                                 | Zod                                         |
| `web`          | Browser modules                                                                                               | Other web modules and pure domain modules   |

These boundaries are **tested**: `test/quality/conventions.test.ts` reads every import and fails the build if a layer reaches upward. Another test fails if the domain touches `fetch`, `Date`, `Math.random` or `process`.

## Design decisions

- **Numbers come from code, words from the model.** The domain computes every figure. Gemini can only choose catalogue ids and write digit-free prose, so a wrong number cannot reach the user.
- **Dependency injection without a framework.**
  - `createCoach`, `createOpenMeteo`, `createGeminiModel`, `createApp` and `start` (browser) each take their dependencies as one options object.
  - Tests pass fakes, so no test touches the network.
- **One source of truth for schemas.**
  - Zod defines the request body (`plan-request.ts`) and the model reply (`tailoring.ts`).
  - The JSON Schema sent to Gemini is generated from the reply schema.
- **Errors as values with a type.** `Problem` maps a fixed set of problem types to HTTP statuses (RFC 9457). Unexpected errors become a generic 500 and are logged by name only.
- **Non-empty types where emptiness is impossible.**
  - Forecast hours are `readonly [AirHour, ...AirHour[]]`, and band tables are tuples.
  - The code needs no unreachable `?? fallback` branches.

## Enforced limits

| Rule                               | Limit                                        | Tool                            |
| ---------------------------------- | -------------------------------------------- | ------------------------------- |
| Lines per function                 | 30                                           | ESLint `max-lines-per-function` |
| Parameters per function            | 3 (an options object beyond that)            | ESLint `max-params`             |
| Cyclomatic complexity              | 8                                            | ESLint `complexity`             |
| Nesting depth                      | 3                                            | ESLint `max-depth`              |
| Lines per module                   | 200 (tests 250)                              | ESLint `max-lines`              |
| Type safety                        | `strictTypeChecked` + `stylisticTypeChecked` | typescript-eslint               |
| Maintainability smells             | SonarJS recommended rules                    | `eslint-plugin-sonarjs`         |
| HTML from strings                  | Banned (`innerHTML`, `outerHTML`)            | ESLint + conventions test       |
| Formatting                         | Prettier, checked in CI                      | `npm run lint`                  |
| Every module and export documented | Required                                     | conventions test                |

TypeScript runs with `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noPropertyAccessFromIndexSignature`, `noImplicitReturns`, `verbatimModuleSyntax` and `isolatedModules`.

## Measured

- **Size:** 45 TypeScript source files, about 4,200 lines including docs and formatting; the largest module is under 200 lines.
- **Duplication:** 0 exact clones across `src`, `web` and `test` (jscpd, 50-token minimum).
- **Checks:** ESLint with SonarJS reports 0 issues, and `tsc --noEmit` reports 0 errors.

## Tooling

- **TypeScript 6** checks types.
- **esbuild** bundles:
  - the server, for Node 22 ESM, with dependencies kept external;
  - the browser code and CSS, minified and content-hashed.
- **Vitest** runs tests with V8 coverage.
- **ESLint 10** and **Prettier** handle lint and formatting.
- `npm run check` runs everything CI runs.
