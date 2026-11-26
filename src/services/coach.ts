/**
 * The plan use case: fetch the forecast, compute the assessment, screen the note, then get
 * the writing from Gemini (see model-writer.ts). If every model fails, the rules write the
 * plan, so a household always gets advice.
 */
import { type Assessment, assess } from '../domain/assessment';
import type { Audience, Household, Language } from '../domain/household';
import { type BriefInput, looksLikeSteering } from './brief';
import { type Writer, type Written, writeWithModels } from './model-writer';
import type { AirSource, LocationQuery, Logger, TextModel } from './ports';
import { type Writing, writeByRules } from './tailoring';

/** A validated plan request. */
export interface PlanRequest {
  readonly location: LocationQuery;
  readonly household: Household;
  readonly audience: Audience;
  readonly language: Language;
  readonly note: string | null;
}

/** Who wrote the plan text. */
export type Author =
  { readonly kind: 'gemini'; readonly model: string } | { readonly kind: 'rules' };

/** Things the user should know about how the plan was made. */
export type Notice = 'note-ignored' | 'written-by-rules';

/** A finished plan: computed facts plus the words around them. */
export interface Plan {
  readonly assessment: Assessment;
  readonly audience: Audience;
  readonly writing: Writing;
  readonly author: Author;
  readonly language: Language;
  readonly notices: readonly Notice[];
}

/** What the coach needs; `model` is null when no API key is configured. */
export interface CoachOptions {
  readonly air: AirSource;
  readonly model: TextModel | null;
  readonly models: readonly string[];
  readonly logger: Logger;
}

/** Builds plans. */
export interface Coach {
  plan(request: PlanRequest): Promise<Plan>;
}

/** Drops a note that tries to steer the model, remembering that it did. */
function screenNote(note: string | null): { note: string | null; notices: Notice[] } {
  return note !== null && looksLikeSteering(note)
    ? { note: null, notices: ['note-ignored'] }
    : { note, notices: [] };
}

/** Puts the computed and written halves together. */
function finish(input: BriefInput, written: Written | null, notices: Notice[]): Plan {
  const { assessment, audience, language } = input;
  if (written === null) {
    return {
      assessment,
      audience,
      language,
      notices: [...notices, 'written-by-rules'],
      writing: writeByRules(assessment, audience),
      author: { kind: 'rules' },
    };
  }
  const author: Author = { kind: 'gemini', model: written.model };
  return { assessment, audience, language, notices, writing: written.writing, author };
}

/** Creates the coach. */
export function createCoach(options: CoachOptions): Coach {
  const { model, models, logger } = options;
  const writer: Writer | null = model === null ? null : { model, models, logger };
  return {
    async plan(request) {
      const forecast = await options.air.forecastFor(request.location);
      const assessment = assess(request.household, request.audience, forecast);
      const { note, notices } = screenNote(request.note);
      const input: BriefInput = { ...request, assessment, note };
      const written = writer === null ? null : await writeWithModels(writer, input);
      return finish(input, written, notices);
    },
  };
}
