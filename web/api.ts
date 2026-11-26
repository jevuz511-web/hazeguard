/**
 * Talks to POST /api/plan. Network failures, timeouts and problem responses all become a
 * plain-language failure the page can show, never an unhandled rejection.
 */
import type { Plan } from '../src/services/coach';
import type { PlanDraft } from './form-read';

/** What a plan request ended with. */
export type PlanResult =
  | { readonly ok: true; readonly plan: Plan }
  | {
      readonly ok: false;
      readonly title: string;
      readonly fields: Readonly<Record<string, string>>;
    };

/** How long the page waits for a plan before giving up. */
export const PLAN_TIMEOUT_MS = 45_000;

const OFFLINE = 'We could not reach HazeGuard. Check your connection and try again.';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Reads a problem+json body into a failure, with safe defaults for anything missing. */
export function toFailure(body: unknown): PlanResult {
  const problem = isRecord(body) ? body : {};
  const title = typeof problem['title'] === 'string' ? problem['title'] : OFFLINE;
  const fields = isRecord(problem['fields']) ? problem['fields'] : {};
  const safe = Object.fromEntries(
    Object.entries(fields).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
  return { ok: false, title, fields: safe };
}

/** Sends the draft and returns the plan or a failure. */
export async function requestPlan(
  draft: PlanDraft,
  send: typeof fetch = fetch,
): Promise<PlanResult> {
  try {
    const response = await send('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(draft),
      signal: AbortSignal.timeout(PLAN_TIMEOUT_MS),
    });
    const body: unknown = await response.json();
    return response.ok ? { ok: true, plan: body as Plan } : toFailure(body);
  } catch {
    return toFailure(null);
  }
}
