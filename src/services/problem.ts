/**
 * Errors that are safe to show users, shaped after RFC 9457 problem details. Anything
 * else that escapes a request becomes a generic 500 so internals never leak.
 */

/** Machine-readable kinds of problem, each with a fixed HTTP status. */
export const PROBLEMS = {
  'invalid-request': 400,
  'cross-site': 403,
  'not-found': 404,
  'method-not-allowed': 405,
  'payload-too-large': 413,
  'unsupported-media-type': 415,
  'place-not-found': 422,
  'rate-limited': 429,
  internal: 500,
  'air-data-unavailable': 503,
} as const;

/** One kind of problem. */
export type ProblemType = keyof typeof PROBLEMS;

/** The HTTP statuses problems can have. */
export type ProblemStatus = (typeof PROBLEMS)[ProblemType];

/** What a problem carries besides its type and title. */
export interface ProblemExtras {
  readonly detail?: string;
  /** Field path → message, for form validation errors. */
  readonly fields?: Readonly<Record<string, string>>;
  readonly retryAfterSeconds?: number;
  readonly cause?: unknown;
}

/** An error with a user-safe title, an HTTP status and optional field messages. */
export class Problem extends Error {
  readonly type: ProblemType;
  readonly status: ProblemStatus;
  readonly extras: ProblemExtras;

  constructor(type: ProblemType, title: string, extras: ProblemExtras = {}) {
    super(title, { cause: extras.cause });
    this.name = 'Problem';
    this.type = type;
    this.status = PROBLEMS[type];
    this.extras = extras;
  }

  /** The JSON body sent to the client, without the cause. */
  toJSON(): Record<string, unknown> {
    const { detail, fields } = this.extras;
    return {
      type: `/problems/${this.type}`,
      title: this.message,
      status: this.status,
      ...(detail === undefined ? {} : { detail }),
      ...(fields === undefined ? {} : { fields }),
    };
  }
}
