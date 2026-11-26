/**
 * The written half of a plan. Gemini returns words only: it picks catalogue ids and
 * explains them, and every reply is checked against the computed assessment before use.
 */
import { z } from 'zod';
import type { Assessment } from '../domain/assessment';
import type { Audience } from '../domain/household';

/** Words a model may write; digits are banned so every number comes from the code. */
const prose = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((text) => !/\p{Nd}/u.test(text), { error: 'must not contain digits' });

/** Shape of a model reply. */
export const TailoringSchema = z.object({
  summary: prose(420),
  picks: z
    .array(z.object({ id: z.string().max(40), why: prose(220) }))
    .min(3)
    .max(8),
  notice: z.object({ headline: prose(90), body: prose(600) }).nullable(),
});

/** A validated model reply. */
export type Tailoring = z.infer<typeof TailoringSchema>;

/** A chosen action and, when a model wrote one, why it suits this household. */
export interface Pick {
  readonly id: string;
  readonly why: string | null;
}

/** The written part of a plan, from a model or from the rules. */
export interface Writing {
  readonly summary: string;
  readonly picks: readonly Pick[];
  readonly notice: { readonly headline: string; readonly body: string } | null;
}

/** JSON Schema sent with every request; derived from the Zod schema so they cannot drift. */
export const TAILORING_JSON_SCHEMA = z.toJSONSchema(TailoringSchema, { target: 'draft-2020-12' });

/** Problems that make a well-formed reply unusable for this assessment. */
export function reviewTailoring(
  tailoring: Tailoring,
  assessment: Assessment,
  audience: Audience,
): string[] {
  const allowed = new Set(assessment.actions.map((action) => action.id));
  const ids = tailoring.picks.map((pick) => pick.id);
  const problems = ids
    .filter((id) => !allowed.has(id))
    .map((id) => `"${id}" is not one of the eligible action ids`);
  if (new Set(ids).size !== ids.length) problems.push('an action id is picked twice');
  if (audience.kind === 'community' && tailoring.notice === null) {
    problems.push('a community notice is required');
  }
  if (audience.kind === 'household' && tailoring.notice !== null) {
    problems.push('notice must be null for a single household');
  }
  return problems;
}

/** How many actions a rules-only plan shows. */
const RULES_PICKS = 7;

/** A complete plan text written from the assessment alone, used when no model can help. */
export function writeByRules(assessment: Assessment, audience: Audience): Writing {
  const { now, cleanest, airing } = assessment.outlook;
  const summary =
    `Air in ${assessment.place.name} is ${now.band.label} now (NAQI ${String(now.index)}). ` +
    `The cleanest hour ahead is ${cleanest.time.slice(11)}, and the best time to air the home ` +
    `is ${airing.time.slice(11)}. Start with the actions at the top of the list.`;
  const picks = assessment.actions
    .slice(0, RULES_PICKS)
    .map((action) => ({ id: action.id, why: null }));
  return { summary, picks, notice: audience.kind === 'community' ? ruleNotice(assessment) : null };
}

function ruleNotice(assessment: Assessment): Writing['notice'] {
  const { worst, cleanest } = assessment.outlook;
  return {
    headline: `Smog alert for ${assessment.place.name}: air reaches ${worst.band.label}`,
    body:
      `Please keep windows shut around ${worst.time.slice(11)} and plan outdoor activity near ` +
      `${cleanest.time.slice(11)}, the cleanest hour. No burning of leaves or waste, no idling at ` +
      'the gates, and share rides where you can.',
  };
}
