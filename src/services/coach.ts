/**
 * The plan use case: fetch the forecast, compute the assessment, then ask each Gemini
 * model in turn for the writing. A rejected reply is repaired by the next model; if all
 * fail, the rules write the plan, so a household always gets advice.
 */
import { type Assessment, assess } from '../domain/assessment';
import type { Audience, Household, Language } from '../domain/household';
import {
  type BriefInput,
  SYSTEM_INSTRUCTION,
  buildPrompt,
  looksLikeSteering,
  withRepairNotes,
} from './brief';
import type { AirSource, LocationQuery, Logger, TextModel } from './ports';
import {
  TAILORING_JSON_SCHEMA,
  TailoringSchema,
  type Writing,
  reviewTailoring,
  writeByRules,
} from './tailoring';

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

/** A model and the order to try models in. */
interface Writer {
  readonly model: TextModel;
  readonly models: readonly string[];
  readonly logger: Logger;
}

/** Text a model wrote and which model wrote it. */
interface Written {
  readonly writing: Writing;
  readonly model: string;
}

type Attempt = { readonly writing: Writing } | { readonly problems: readonly string[] };

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Error name and HTTP status (when the SDK reports one) for logs; never the message, which may echo input. */
export function describeFailure(error: unknown): { reason: string; status?: number } {
  if (!(error instanceof Error)) return { reason: 'unknown' };
  const status: unknown = Reflect.get(error, 'status');
  return typeof status === 'number' ? { reason: error.name, status } : { reason: error.name };
}

/** One model call, judged against the schema and the assessment. */
async function attempt(
  writer: Writer,
  input: BriefInput,
  call: { model: string; prompt: string },
): Promise<Attempt> {
  try {
    const text = await writer.model.generate({
      ...call,
      system: SYSTEM_INSTRUCTION,
      schema: TAILORING_JSON_SCHEMA,
    });
    const parsed = TailoringSchema.safeParse(parseJson(text));
    if (!parsed.success) {
      return {
        problems: parsed.error.issues
          .slice(0, 5)
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`),
      };
    }
    const problems = reviewTailoring(parsed.data, input.assessment, input.audience);
    return problems.length === 0 ? { writing: parsed.data } : { problems };
  } catch (error) {
    writer.logger.warn('model.failed', { model: call.model, ...describeFailure(error) });
    return { problems: [] };
  }
}

/** Tries each configured model in order, passing rejections on as repair notes. */
async function writeWithModels(writer: Writer, input: BriefInput): Promise<Written | null> {
  const base = buildPrompt(input);
  let prompt = base;
  for (const model of writer.models) {
    const result = await attempt(writer, input, { model, prompt });
    if ('writing' in result) return { writing: result.writing, model };
    if (result.problems.length > 0) {
      writer.logger.warn('model.rejected', { model, problems: result.problems.length });
      prompt = withRepairNotes(base, result.problems);
    }
  }
  return null;
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
