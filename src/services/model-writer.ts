/**
 * Asks each configured Gemini model in turn for the plan's writing. Every reply is checked
 * against the schema and the assessment; a rejected reply's problems are passed to the next
 * model as repair notes, and failures are logged by error name and HTTP status only.
 */
import { type BriefInput, SYSTEM_INSTRUCTION, buildPrompt, withRepairNotes } from './brief';
import type { Logger, TextModel } from './ports';
import { TAILORING_JSON_SCHEMA, TailoringSchema, type Writing, reviewTailoring } from './tailoring';

/** A model and the order to try models in. */
export interface Writer {
  readonly model: TextModel;
  readonly models: readonly string[];
  readonly logger: Logger;
}

/** Text a model wrote and which model wrote it. */
export interface Written {
  readonly writing: Writing;
  readonly model: string;
}

/** What one model call produced: usable writing, or the reasons it was rejected. */
type Attempt = { readonly writing: Writing } | { readonly problems: readonly string[] };

/** Parses JSON, treating anything unparsable as null so the schema rejects it. */
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
export async function writeWithModels(writer: Writer, input: BriefInput): Promise<Written | null> {
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
