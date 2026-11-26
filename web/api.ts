/**
 * Talks to POST /api/plan. Network failures, timeouts, problem responses and replies of
 * the wrong shape all become a plain-language failure, never an unhandled rejection.
 */
import type { Plan } from '../src/services/coach';
import { STATUS } from './copy';
import type { PlanDraft } from './form-read';
import { isPlan, isRecord } from './guards';
import { BROWSER_LIMITS } from './limits';

/** What a plan request ended with. */
export type PlanResult =
  | { readonly ok: true; readonly plan: Plan }
  | {
      readonly ok: false;
      readonly title: string;
      readonly fields: Readonly<Record<string, string>>;
    };

/** The part of `fetch` this module uses. */
export type Send = (url: string, init: RequestInit) => Promise<Response>;

/** Reads a problem+json body into a failure, with safe defaults for anything missing. */
export function toFailure(body: unknown, fallback: string = STATUS.offline): PlanResult {
  const problem = isRecord(body) ? body : {};
  const title = typeof problem['title'] === 'string' ? problem['title'] : fallback;
  const fields = isRecord(problem['fields']) ? problem['fields'] : {};
  const safe = Object.fromEntries(
    Object.entries(fields).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
  return { ok: false, title, fields: safe };
}

/** Turns a parsed reply into a plan, or a failure when it is not one. */
export function toResult(ok: boolean, body: unknown): PlanResult {
  if (!ok) return toFailure(body);
  return isPlan(body) ? { ok: true, plan: body } : toFailure(null, STATUS.unexpected);
}

/** Sends the draft and returns the plan or a failure. */
export async function requestPlan(draft: PlanDraft, send: Send): Promise<PlanResult> {
  try {
    const response = await send('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(draft),
      signal: AbortSignal.timeout(BROWSER_LIMITS.planTimeoutMs),
    });
    return toResult(response.ok, await response.json());
  } catch {
    return toFailure(null);
  }
}
