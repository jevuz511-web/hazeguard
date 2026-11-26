/**
 * Runtime checks for data that arrives from outside the page's own code: the server's
 * JSON and localStorage. Shapes are declared as data and checked without casts.
 */
import type { Plan } from '../src/services/coach';

/** Checks one field value. */
type Check = (value: unknown) => boolean;

/** Field name → check, describing the shape of an object. */
type Shape = Readonly<Record<string, Check>>;

/** True for a non-null object. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** True when `value` is an object whose fields all pass their checks. */
export function hasShape(value: unknown, shape: Shape): boolean {
  return isRecord(value) && Object.entries(shape).every(([key, check]) => check(value[key]));
}

const text: Check = (value) => typeof value === 'string';
const number: Check = (value) => typeof value === 'number' && Number.isFinite(value);
const list: Check = (value) => Array.isArray(value);
const oneOf =
  (...options: readonly string[]): Check =>
  (value) =>
    typeof value === 'string' && options.includes(value);
const shaped =
  (shape: Shape): Check =>
  (value) =>
    hasShape(value, shape);

const HOUR: Shape = {
  time: text,
  pm2_5: number,
  index: number,
  band: shaped({ id: text, label: text }),
};

const ASSESSMENT: Shape = {
  place: shaped({ name: text }),
  outlook: shaped({
    now: shaped(HOUR),
    worst: shaped(HOUR),
    cleanest: shaped(HOUR),
    airing: shaped(HOUR),
    hours: list,
    unhealthyHours: number,
  }),
  trips: list,
  actions: list,
  impact: shaped({ co2SavedKg: number, doseSavedUg: number, dosePercent: number }),
};

const PLAN: Shape = {
  assessment: shaped(ASSESSMENT),
  audience: shaped({ kind: oneOf('household', 'community') }),
  writing: shaped({ summary: text, picks: list }),
  author: shaped({ kind: oneOf('gemini', 'rules') }),
  language: oneOf('en', 'hi'),
  notices: list,
};

/** True when `value` has the shape of a plan from POST /api/plan. */
export function isPlan(value: unknown): value is Plan {
  return hasShape(value, PLAN);
}

/** True for an array of strings. */
export function isTextList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}
