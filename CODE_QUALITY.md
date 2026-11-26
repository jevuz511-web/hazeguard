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
- **Units in the type system** (`src/domain/units.ts`).
  - Kilometres, kg CO₂e, micrograms, µg/m³ and minutes are branded number types. Adding a dose to an emission is a compile error.
  - The unit constructors are the only place that may assert a type, and they also fix each quantity's precision. This replaced two copies of a `round` helper.
- **Judgement calls are named data.**
  - Walking and cycling distances, the carpool size, the band that shields sensitive people and the airing hours live in `src/domain/policy.ts`.
  - The sourced mode factors live in `src/domain/modes.ts`, built from named constants (`BREATHING`, `CAR_CO2_PER_KM`).
  - Model writing limits live in `WRITING_LIMITS`, browser limits in `web/limits.ts`, and timeouts and cache lifetimes in config or named constants.
- **No type assertions in shipped code.**
  - ESLint `consistent-type-assertions: never` covers `src/` and `web/`, apart from the unit constructors.
  - Data from outside is narrowed: server JSON and localStorage go through declarative shape guards (`web/guards.ts`); Node connection info comes from `getConnInfo`; DOM lookups go through checked helpers.
- **Pure browser state.**
  - `web/state.ts` is a pure `(state, event) → state` function with exhaustive event types.
  - `web/store.ts` holds the current state, and a single `applyChange` performs the side effects (saving, rendering, the busy button).
  - Handlers only dispatch events, so every rule is unit-tested without a DOM.
- **Interface segregation.** The page asks for exactly what it uses (`Send`, `Locator`, `PlanStorage`, `Pick<Clipboard, 'writeText'>`), so fakes need no casts.
- **One place for wording.** Every sentence the page writes lives in `web/copy.ts`. Renderers and controllers hold no prose.
- **Small, single-purpose modules.** The plan use case (`services/coach.ts`, 90 lines) is separate from the model loop with its checks and repair prompts (`services/model-writer.ts`, 83 lines). Text safety is one shared rule (`services/text-safety.ts`) used for both user input and model output.
- **TypeScript everywhere it runs.** The build script is `scripts/build.ts`, type-checked and linted like the app and run with Node's built-in type stripping. The only JavaScript left is the ESLint config and the one-line Vercel entry.
- **Traceable requests.** Each response carries `X-Request-Id`, and `plan.created` and `request.failed` logs include it, along with the author and timing.
- **Decisions are recorded.** Architecture decision records in [docs/adr](docs/adr/README.md) explain why, and [docs/API.md](docs/API.md) is the HTTP contract.

## Enforced limits

| Rule                               | Limit                                        | Tool                                     |
| ---------------------------------- | -------------------------------------------- | ---------------------------------------- |
| Lines per function                 | 30                                           | ESLint `max-lines-per-function`          |
| Parameters per function            | 3 (an options object beyond that)            | ESLint `max-params`                      |
| Cyclomatic complexity              | 8                                            | ESLint `complexity`                      |
| Nesting depth                      | 3                                            | ESLint `max-depth`                       |
| Lines per module                   | 200 (tests 250)                              | ESLint `max-lines`                       |
| Type safety                        | `strictTypeChecked` + `stylisticTypeChecked` | typescript-eslint                        |
| Maintainability smells             | SonarJS recommended rules                    | `eslint-plugin-sonarjs`                  |
| HTML from strings                  | Banned (`innerHTML`, `outerHTML`)            | ESLint + conventions test                |
| Formatting                         | Prettier, checked in CI                      | `npm run lint`                           |
| Every module and export documented | Required                                     | `eslint-plugin-jsdoc` + conventions test |
| Type assertions (`as`)             | Banned outside the unit constructors         | ESLint `consistent-type-assertions`      |

TypeScript runs with `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noPropertyAccessFromIndexSignature`, `noImplicitReturns`, `verbatimModuleSyntax` and `isolatedModules`.

## Measured

- **Size:** 56 TypeScript source files (including the build script), about 3,900 lines including docs and formatting; the largest module is 166 lines (catalogue data).
- **Duplication:** 0 exact clones across `src`, `web` and `test` (jscpd, 50-token minimum, 85 files).
- **Checks:** ESLint with SonarJS reports 0 issues, and `tsc --noEmit` reports 0 errors, tests included.
- **Assertions:** 0 type assertions in `src/` and `web/` outside the five unit constructors. Tests use them only to read parsed JSON replies and matcher placeholders.

## Tooling

- **TypeScript 6** checks types.
- **esbuild** bundles:
  - the server, for Node 22 ESM, with dependencies kept external;
  - the browser code and CSS, minified and content-hashed.
- **Vitest** runs tests with V8 coverage.
- **ESLint 10** and **Prettier** handle lint and formatting.
- `npm run check` runs everything CI runs.
