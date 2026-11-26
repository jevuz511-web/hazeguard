import { describe, expect, it } from 'vitest';
import { PROBLEMS, Problem } from '../../src/services/problem';

describe('Problem', () => {
  it('maps each type to its HTTP status', () => {
    expect(new Problem('rate-limited', 'Slow down').status).toBe(429);
    expect(Object.values(PROBLEMS).every((status) => status >= 400 && status < 600)).toBe(true);
  });

  it('serialises to RFC 9457 problem details without the cause', () => {
    const problem = new Problem('invalid-request', 'Check these', {
      detail: 'Two fields',
      fields: { km: 'Too far' },
      cause: new Error('internal detail'),
    });
    expect(problem.toJSON()).toEqual({
      type: '/problems/invalid-request',
      title: 'Check these',
      status: 400,
      detail: 'Two fields',
      fields: { km: 'Too far' },
    });
    expect(problem.cause).toBeInstanceOf(Error);
  });

  it('omits optional members that are not set', () => {
    expect(new Problem('not-found', 'Nothing here').toJSON()).toEqual({
      type: '/problems/not-found',
      title: 'Nothing here',
      status: 404,
    });
  });
});
