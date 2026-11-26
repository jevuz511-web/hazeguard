# Contributing

## Setup

```bash
nvm use            # Node 22 (see .nvmrc)
npm ci             # install scripts are disabled by .npmrc
cp .env.example .env
npm run dev        # http://localhost:8080
```

## Before you open a pull request

`npm run check` must pass. It runs Prettier and ESLint (type-aware rules, SonarJS, JSDoc and size limits), `tsc`, all tests at 100% coverage, and the production build. CI runs the same steps, plus `npm audit`, gitleaks and CodeQL.

## House rules

These are enforced by lint or tests:

- **Layers.** Domain code is pure. Services depend on ports, not adapters. Only `src/compose.ts` knows concrete adapters. See [docs/adr/0002](docs/adr/0002-ports-and-adapters.md).
- **No type assertions** in `src/` or `web/`. Narrow, validate or use the unit constructors in `src/domain/units.ts`.
- **Functions** have at most 30 lines and 3 parameters; use an options object beyond that.
- **Every module** opens with a comment saying what it is for, and every export has a doc comment.
- **Numbers come from code, never from the model.** See [docs/adr/0001](docs/adr/0001-numbers-in-code-words-from-gemini.md).
- **No HTML strings** in the browser. Build nodes with `h()` and put text in `textContent`.
- **Words the page shows** live in `web/copy.ts`; tunable values live in `src/domain/policy.ts` or `web/limits.ts`.
- **Every new behaviour gets a test.** Add a fast-check property when a rule must hold for all inputs.

## Commit messages

Commit messages use the imperative mood and say why, not just what.
