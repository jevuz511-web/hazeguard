# Testing

`npm test` runs **434 Vitest tests** with V8 coverage. CI fails below **100% statements, branches, functions and lines** for every file in `src/` and `web/`. The only exclusion is the two-line `src/server.ts` entry point; its logic lives in `node-server.ts`, which is tested.

| Area                               | Files                                | Tests | What is proven                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------- | ------------------------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain                             | `test/domain/*`                      | 56    | CPCB breakpoints and bands (table-driven); the cleanest-hour search, including ties and windows; trip pricing for CO₂, dose and time; mode choice, including shielding sensitive people from active travel on Poor days; catalogue eligibility for every condition; the weekly impact and community scaling                           |
| Services                           | `test/services/*`                    | 31    | Reply schema (digits banned in any script); catalogue-bound review; rule-written plans and notices; prompt construction and note fencing; the injection screen (attacks and ordinary English/Hindi notes); coach fallback across models, repair prompts, invalid JSON, a key-free mode and secret-free logging                        |
| Adapters & platform                | `test/adapters/*`, `test/platform/*` | 23    | Open-Meteo parsing, gaps, caching, coordinates, unknown places, network/HTTP/shape failures; Gemini request config (schema, safety, timeout) and empty or blocked replies; TTL cache expiry and eviction; config defaults and errors that name the bad variable without its value; logger masking                                     |
| HTTP                               | `test/http/*`                        | 27    | Every security header; cross-site 403; 415 for non-JSON; 400 with field messages; 413; per-client, global and windowed 429 with `Retry-After`; 405 with `Allow`; generic 500; health; static files with Brotli/gzip/`q=0`, 304 and HEAD                                                                                               |
| Entry points                       | `test/entry.test.ts`                 | 5     | Composition with and without a key; the Vercel handler; a real Node server over HTTP with timeouts and SIGTERM shutdown; key removal from the environment                                                                                                                                                                             |
| Browser (jsdom, real `index.html`) | `test/web/*`                         | 28    | Trip rows, form reading, the accessible error summary, geolocation (granted, denied, unsupported), the audience toggle, every renderer, saved ticks, restore, print, clear, the copy notice (success, unavailable, blocked), API failures, blocked storage, and **axe-core finding zero violations** before and after a plan is shown |
| Quality gates                      | `test/quality/*`                     | 264   | WCAG contrast arithmetic for every token pair in light and dark (50); conventions per file (214): module purpose comment, documented exports, layer boundaries, a pure domain, no invisible characters, no HTML strings                                                                                                               |

## Live evaluation

`npm run eval` (`test/live/gemini.eval.ts`) runs two real scenarios against Gemini and Open-Meteo:

1. **Delhi, Hindi, grandparents with COPD and a wood heater.** Expects a Gemini-written plan in Devanagari that passes every check and includes "electric heating".
2. **Lucknow school with an injection attempt in the note.** Expects the note to be ignored, a notice to be written and the summary to contain no digits.

It is kept out of CI because it needs a key and uses free-tier quota. Both scenarios passed on the current code.

## Principles

- **Behaviour, not implementation.** Tests use real objects (the real coach, domain and page HTML) and fake only the network and the model.
- **No network in unit tests.** `fetch`, the Gemini client, storage, clipboard, geolocation and clocks are injected.
- **Each bug class has a guard.** Invisible characters, upward imports, HTML strings and colour contrast are all checked by tests, not by review.
