# ADR 0001: Numbers come from code, words come from Gemini

- **Status:** accepted
- **Date:** 2026-11-26

## Context

The brief asks HazeGuard to explain "the direct impact of their choices". Impact means numbers: index values, kilograms of CO₂ and micrograms of PM2.5. Language models are fluent but unreliable with arithmetic, and a plausible wrong number about a family's health is worse than no number.

## Decision

- **Code computes every number.** `src/domain` computes every number from the forecast and the household's answers. These are pure functions, unit-tested and property-tested.
- **Gemini writes only words.** It receives the computed facts as JSON and is asked to choose actions and explain them.
- **The page combines the two.** It shows Gemini's words next to the computed figures.

## Consequences

- No hallucinated figure can reach the user (see ADR 0003 for how this is enforced).
- If every model fails, the rules can write the whole plan, because nothing numeric depends on the model.
- Gemini's text must sometimes refer to numbers indirectly ("the cleanest hour shown"), which reads slightly less naturally.
