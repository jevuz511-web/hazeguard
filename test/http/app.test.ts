import { describe, expect, it } from 'vitest';
import { MAX_BODY_BYTES } from '../../src/http/app';
import { Problem } from '../../src/services/problem';
import { planBody } from '../fixtures';
import { postPlan, testApp } from './support';

describe('POST /api/plan', () => {
  it('returns a plan with no-store caching and every security header', async () => {
    const response = await postPlan(testApp().app);
    expect(response.status).toBe(200);
    const plan = (await response.json()) as { author: unknown; assessment: { trips: unknown[] } };
    expect(plan.author).toEqual({ kind: 'gemini', model: 'm' });
    expect(plan.assessment.trips).toHaveLength(1);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-security-policy')).toContain(
      "require-trusted-types-for 'script'",
    );
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('cross-origin-embedder-policy')).toBe('require-corp');
  });

  it('tags every response with a request id and logs how each plan was made', async () => {
    const { app, logger } = testApp();
    const response = await postPlan(app);
    const id = response.headers.get('x-request-id');
    expect(id).toMatch(/^[\da-f-]{36}$/u);
    expect(logger.entries.at(-1)).toMatchObject({
      event: 'plan.created',
      data: { requestId: id, author: 'gemini' },
    });
    const echoed = await app.request('/api/health', { headers: { 'X-Request-Id': 'trace-123' } });
    expect(echoed.headers.get('x-request-id')).toBe('trace-123');
  });

  it('rejects cross-site requests before doing any work', async () => {
    const response = await postPlan(testApp().app, planBody(), { 'Sec-Fetch-Site': 'cross-site' });
    expect(response.status).toBe(403);
    expect(response.headers.get('content-type')).toBe('application/problem+json');
  });

  it('requires JSON', async () => {
    const bare = await testApp().app.request('/api/plan', {
      method: 'POST',
      headers: { 'Sec-Fetch-Site': 'same-origin' },
      body: new TextEncoder().encode('{}'),
    });
    expect(bare.status).toBe(415);
    const response = await postPlan(testApp().app, 'location=x', {
      'Content-Type': 'application/x-www-form-urlencoded',
    });
    expect(response.status).toBe(415);
  });

  it('explains invalid JSON and invalid fields', async () => {
    const { app } = testApp();
    expect((await postPlan(app, '{oops')).status).toBe(400);
    const response = await postPlan(
      app,
      planBody({ trips: [{ label: '', km: 0, mode: 'car', departHour: 9, perWeek: 3 }] }),
    );
    const problem = (await response.json()) as { fields: Record<string, string> };
    expect(response.status).toBe(400);
    expect(problem.fields).toEqual({
      'trips.0.label': 'Please fill this in.',
      'trips.0.km': 'Use at least 0.1 km.',
    });
  });

  it('rejects bodies over the size limit with 413', async () => {
    const response = await postPlan(testApp().app, planBody({ note: 'x'.repeat(MAX_BODY_BYTES) }));
    expect(response.status).toBe(413);
  });

  it('rate-limits each client and sends Retry-After', async () => {
    const { app } = testApp({ perClient: 1, trustedProxies: 1 });
    expect((await postPlan(app, planBody(), { 'X-Forwarded-For': '203.0.113.9' })).status).toBe(
      200,
    );
    const limited = await postPlan(app, planBody(), { 'X-Forwarded-For': '203.0.113.9' });
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0);
    expect((await postPlan(app, planBody(), { 'X-Forwarded-For': '198.51.100.7' })).status).toBe(
      200,
    );
  });

  it('answers other methods with 405 and an Allow header', async () => {
    const response = await testApp().app.request('/api/plan');
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
  });

  it('hides unexpected errors behind a generic 500 and logs them', async () => {
    const { app, logger } = testApp({ model: null });
    app.get('/api/explode', () => {
      throw new RangeError('secret internals');
    });
    const response = await app.request('/api/explode');
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('secret internals');
    expect(logger.entries.at(-1)).toMatchObject({
      event: 'request.failed',
      data: { requestId: expect.any(String) as string, status: 500, error: 'RangeError' },
    });
  });

  it('logs server-side problems such as missing air data', async () => {
    const { app, logger } = testApp();
    app.get('/api/air-down', () => {
      throw new Problem('air-data-unavailable', 'down');
    });
    expect((await app.request('/api/air-down')).status).toBe(503);
    expect(logger.entries.at(-1)?.event).toBe('request.failed');
  });
});

describe('other routes', () => {
  it('reports health', async () => {
    const response = await testApp().app.request('/api/health');
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('serves the page at / and 404s unknown paths as problems', async () => {
    const { app } = testApp();
    const page = await app.request('/');
    expect(page.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(page.headers.get('strict-transport-security')).toContain('max-age=63072000');
    const missing = await app.request('/nope');
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ type: '/problems/not-found' });
  });

  it('does not serve static files for writes', async () => {
    expect((await testApp().app.request('/index.html', { method: 'POST' })).status).toBe(404);
  });
});
