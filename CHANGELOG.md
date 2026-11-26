# Changelog

## 1.1.0, 2026-11-26

### Changed

- **Units in the type system:** reported quantities use branded unit types (`Kilometres`, `KilogramsCo2e`, `Micrograms`, `Concentration`, `Minutes`), so the compiler stops units being mixed.
- **Named rules and limits:** judgement calls now live in `src/domain/policy.ts`, mode factors in `src/domain/modes.ts`, browser limits in `web/limits.ts`, and model writing limits in `WRITING_LIMITS`.
- **Pure browser state:** browser state moved to pure `(state, event) → state` transitions (`web/state.ts`) behind a one-way store (`web/store.ts`).
- **One place for wording:** every page sentence lives in `web/copy.ts`.
- **Narrow browser services:** the browser receives only the services it uses (`Send`, `Locator`, `PlanStorage`, `writeText`).

### Added

- **Request IDs:** an `X-Request-Id` on every response, a `plan.created` log line, and the id on error logs.
- **Runtime checks:** the browser checks the server's plan and saved data at runtime (`web/guards.ts`).
- **Property-based tests** with fast-check, for the index, the forecast search and trip planning.
- **Lint rules:** ESLint now requires JSDoc on every export and bans type assertions outside the unit constructors.
- **Docs and settings:** architecture decision records (`docs/adr`), an API contract (`docs/API.md`), `.editorconfig`, `.nvmrc`, this changelog and the contributing guide.
- **`AIR_TIMEOUT_MS` setting** for the Open-Meteo timeout.

## 1.0.0, 2026-11-26

First release:

- live NAQI forecast, cleaner trips, room-by-room actions and a community notice;
- Gemini writing with checks, repair prompts and a rules fallback;
- the six criterion documents.
