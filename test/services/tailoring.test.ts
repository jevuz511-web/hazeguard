import { describe, expect, it } from 'vitest';
import { assess } from '../../src/domain/assessment';
import {
  TAILORING_JSON_SCHEMA,
  TailoringSchema,
  reviewTailoring,
  writeByRules,
} from '../../src/services/tailoring';
import { forecast, goodReply, household } from '../fixtures';

const assessment = assess(household(), { kind: 'household' }, forecast());
const community = { kind: 'community', setting: 'residents', people: 200 } as const;
const reply = (overrides: object = {}) =>
  TailoringSchema.parse({ ...(JSON.parse(goodReply()) as object), ...overrides });

describe('TailoringSchema', () => {
  it('accepts a well-formed reply', () => {
    expect(TailoringSchema.safeParse(JSON.parse(goodReply())).success).toBe(true);
  });

  it('rejects hidden control and direction-override characters in model text', () => {
    const override = String.fromCodePoint(0x202e);
    const reply = { ...(JSON.parse(goodReply()) as object), summary: `Safe${override}text` };
    expect(TailoringSchema.safeParse(reply).success).toBe(false);
  });

  it('rejects digits in any language, so numbers only come from the code', () => {
    expect(
      TailoringSchema.safeParse({
        ...(JSON.parse(goodReply()) as object),
        summary: 'NAQI is 320 now.',
      }).success,
    ).toBe(false);
    expect(
      TailoringSchema.safeParse({ ...(JSON.parse(goodReply()) as object), summary: 'AQI ३२० है' })
        .success,
    ).toBe(false);
  });

  it('needs between three and eight picks', () => {
    const picks = [{ id: 'clean-room', why: 'Protects your child.' }];
    expect(
      TailoringSchema.safeParse({ ...(JSON.parse(goodReply()) as object), picks }).success,
    ).toBe(false);
  });

  it('is exported as JSON Schema for Gemini structured output', () => {
    expect(TAILORING_JSON_SCHEMA).toMatchObject({
      type: 'object',
      required: ['summary', 'picks', 'notice'],
    });
  });
});

describe('reviewTailoring', () => {
  it('accepts picks drawn from the eligible actions', () => {
    expect(reviewTailoring(reply(), assessment, { kind: 'household' })).toEqual([]);
  });

  it('rejects invented or repeated ids', () => {
    const picks = [
      { id: 'clean-room', why: 'One.' },
      { id: 'clean-room', why: 'Two.' },
      { id: 'buy-a-plant', why: 'Three.' },
    ];
    expect(reviewTailoring(reply({ picks }), assessment, { kind: 'household' })).toEqual([
      '"buy-a-plant" is not one of the eligible action ids',
      'an action id is picked twice',
    ]);
  });

  it('requires a notice for communities and forbids one for households', () => {
    expect(reviewTailoring(reply(), assessment, community)).toEqual([
      'a community notice is required',
    ]);
    const notice = { headline: 'Smog alert', body: 'Keep windows shut tonight.' };
    expect(reviewTailoring(reply({ notice }), assessment, { kind: 'household' })).toEqual([
      'notice must be null for a single household',
    ]);
  });
});

describe('writeByRules', () => {
  it('writes a summary from the facts and picks the top seven actions', () => {
    const writing = writeByRules(assessment, { kind: 'household' });
    expect(writing.summary).toContain('Lucknow');
    expect(writing.summary).toContain('15:00');
    expect(writing.picks).toHaveLength(7);
    expect(writing.picks.every((pick) => pick.why === null)).toBe(true);
    expect(writing.notice).toBeNull();
  });

  it('adds a community notice built from the worst and cleanest hours', () => {
    const writing = writeByRules(assess(household(), community, forecast()), community);
    expect(writing.notice?.headline).toContain('Severe');
    expect(writing.notice?.body).toContain('23:00');
  });
});
