# ADR 0003: Catalogue-bound, digit-free, repaired model output

- **Status:** accepted
- **Date:** 2026-11-26

## Context

Structured output guarantees JSON, not truth. A model can still invent an action, repeat one, skip a required notice, or slip a number into its prose. It can also follow instructions smuggled into the user's free-text note.

## Decision

- **Schema from Zod:** the reply schema is defined once in Zod (`src/services/tailoring.ts`), and the JSON Schema sent to Gemini is generated from it.
- **Checks on every reply:** a reply is accepted only if it parses, its action ids are all in the eligible set with no repeats, the notice rule for the audience holds, and **no field contains a digit in any script** (`\p{Nd}`).
- **Repair:** a rejected reply's problems are appended to the prompt for the next model in the chain. If all models fail, `writeByRules` writes the plan from the same facts.
- **Note screening:** the user's note is screened for instruction-like text and dropped (with a visible notice) if it matches. Otherwise it is fenced as `<household_note>` data.

## Consequences

- Every recommendation is a vetted catalogue entry, and every figure on screen comes from code.
- A bad reply costs one more model call, not a bad plan.
- The digit ban occasionally rejects otherwise good replies; the repair prompt fixes these on the next try.
