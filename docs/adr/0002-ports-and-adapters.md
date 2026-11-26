# ADR 0002: Ports-and-adapters layering

- **Status:** accepted
- **Date:** 2026-11-26

## Context

HazeGuard talks to two external services (Open-Meteo and Gemini) and runs in two hosts: a long-running Node server and Vercel functions. The rules must be testable without the network and must not change when a host or provider changes.

## Decision

- **Layers:**

  | Layer            | Contains                                                                  |
  | ---------------- | ------------------------------------------------------------------------- |
  | `src/domain`     | Pure rules; no I/O                                                        |
  | `src/services`   | The use case, plus the ports it needs: `AirSource`, `TextModel`, `Logger` |
  | `src/adapters`   | Implementations of those ports                                            |
  | `src/http`       | Hono, security and static files                                           |
  | `src/compose.ts` | The only place that wires concrete adapters                               |

- **Dependencies point inwards only.** `test/quality/conventions.test.ts` reads every import and fails if a layer reaches outwards.
- **Browser layering is the same.** It depends only on pure domain modules and type-only imports.

## Consequences

- **Isolated tests:** the coach, domain and HTTP layer are tested with fakes, and no unit test touches the network.
- **Cheap to swap:** changing provider (another model, another air-quality API) means writing one adapter.
- **More pieces:** there are a few more files and interfaces than a single-module app would need.
