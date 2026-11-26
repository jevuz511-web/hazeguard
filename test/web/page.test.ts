// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type Send, requestPlan, toFailure } from '../../web/api';
import { byId, find } from '../../web/dom';
import { type PageEnv, start } from '../../web/main';
import { forget, loadSaved, save } from '../../web/storage';
import { goodReply } from '../fixtures';
import { axeViolations, loadPage, makePlan, memoryStorage, settle, fixedLocator } from './support';

beforeEach(loadPage);

const offline: Send = () => Promise.reject(new TypeError('offline'));

function env(overrides: Partial<PageEnv> = {}): PageEnv & { printed: number } {
  const page = {
    printed: 0,
    fetch: offline,
    storage: memoryStorage(),
    geolocation: undefined,
    clipboard: undefined,
    print: () => {
      page.printed += 1;
    },
    ...overrides,
  };
  return page;
}

const replyWith =
  (status: number, body: unknown): Send =>
  () =>
    Promise.resolve(Response.json(body, { status }));

describe('api', () => {
  it('turns problems, garbage and network errors into failures', async () => {
    expect(toFailure({ title: 'Too many plans', fields: { km: 'Too far', bad: 3 } })).toEqual({
      ok: false,
      title: 'Too many plans',
      fields: { km: 'Too far' },
    });
    expect(toFailure('nonsense')).toMatchObject({
      ok: false,
      title: expect.stringMatching(/could not reach/u) as string,
      fields: {},
    });
    expect(await requestPlan({}, replyWith(429, { title: 'Slow down' }))).toMatchObject({
      ok: false,
      title: 'Slow down',
    });
    expect(await requestPlan({}, env().fetch)).toMatchObject({ ok: false });
  });
});

describe('unexpected replies', () => {
  it('rejects a 200 reply that is not a plan', async () => {
    expect(await requestPlan({}, replyWith(200, { hello: 'world' }))).toMatchObject({
      ok: false,
      title: expect.stringMatching(/unexpected reply/u) as string,
    });
  });
});

describe('storage', () => {
  it('saves, loads and forgets, treating blocked or corrupt storage as empty', async () => {
    const storage = memoryStorage();
    const plan = await makePlan();
    expect(save(storage, { plan, done: ['clean-room'] })).toBe(true);
    expect(loadSaved(storage)?.done).toEqual(['clean-room']);
    storage.setItem('hazeguard.saved.v1', '{"plan":1,"done":[]}');
    expect(loadSaved(storage)).toBeNull();
    storage.setItem('hazeguard.saved.v1', '{broken');
    expect(loadSaved(storage)).toBeNull();
    storage.setItem('hazeguard.saved.v1', '"text"');
    expect(loadSaved(storage)).toBeNull();
    forget(storage);
    expect(storage).toHaveLength(0);
    const blocked = memoryStorage(true);
    expect(save(blocked, { plan, done: [] })).toBe(false);
    expect(loadSaved(blocked)).toBeNull();
    expect(() => {
      forget(blocked);
    }).not.toThrow();
  });
});

describe('the page', () => {
  it('has no accessibility violations before and after a plan is shown', async () => {
    start(env());
    expect(await axeViolations()).toEqual([]);
    const plan = await makePlan(
      { audience: { kind: 'community', setting: 'school', people: 400 } },
      goodReply({ headline: 'Smog alert', body: 'Keep windows shut.' }),
    );
    const page = env({ fetch: replyWith(200, plan) });
    loadPage();
    start(page);
    byId('f-location-name', HTMLInputElement).value = 'Lucknow';
    byId('planner', HTMLFormElement).requestSubmit();
    expect(byId('planner', HTMLFormElement).getAttribute('aria-busy')).toBe('true');
    await settle();
    expect(byId('planner', HTMLFormElement).getAttribute('aria-busy')).toBe('false');
    expect(byId('form-status', HTMLElement).textContent).toBe('Your plan is ready below.');
    expect(document.activeElement).toBe(byId('plan', HTMLElement));
    expect(await axeViolations()).toEqual([]);
  });

  it('sends the browser location until a place is typed', async () => {
    const bodies: string[] = [];
    const capture: Send = (_url, init) => {
      bodies.push(typeof init.body === 'string' ? init.body : '');
      return Promise.reject(new TypeError('offline'));
    };
    const geolocation = fixedLocator(26.8, 80.9);
    start(env({ fetch: capture, geolocation }));
    byId('use-location', HTMLButtonElement).click();
    byId('planner', HTMLFormElement).requestSubmit();
    await settle();
    byId('f-location-name', HTMLInputElement).value = 'Patna';
    byId('f-location-name', HTMLInputElement).dispatchEvent(new Event('input'));
    byId('planner', HTMLFormElement).requestSubmit();
    await settle();
    expect(bodies.map((body) => (JSON.parse(body) as { location: unknown }).location)).toEqual([
      { kind: 'coords', latitude: 26.8, longitude: 80.9 },
      { kind: 'name', name: 'Patna' },
    ]);
  });

  it('shows server field errors in the summary', async () => {
    start(
      env({
        fetch: replyWith(400, {
          title: 'Some answers need checking.',
          fields: { 'location.name': 'Please fill this in.' },
        }),
      }),
    );
    byId('planner', HTMLFormElement).requestSubmit();
    await settle();
    expect(byId('error-title', HTMLElement).textContent).toBe('Some answers need checking.');
    expect(byId('submit', HTMLButtonElement).disabled).toBe(false);
  });

  it('saves ticks, restores the plan on reload, prints and clears it', async () => {
    const page = env();
    save(page.storage, { plan: await makePlan(), done: [] });
    start(page);
    const box = find(document, '#act-clean-room', HTMLInputElement);
    box.click();
    expect(loadSaved(page.storage)?.done).toEqual(['clean-room']);
    box.click();
    expect(loadSaved(page.storage)?.done).toEqual([]);
    byId('print-plan', HTMLButtonElement).click();
    expect(page.printed).toBe(1);
    byId('clear-plan', HTMLButtonElement).click();
    expect(byId('plan', HTMLElement).hidden).toBe(true);
    expect(loadSaved(page.storage)).toBeNull();
    box.dispatchEvent(new Event('change', { bubbles: true }));
    const stray = document.createElement('input');
    byId('plan', HTMLElement).append(stray);
    stray.dispatchEvent(new Event('change', { bubbles: true }));
    byId('plan', HTMLElement).dispatchEvent(new Event('change'));
    byId('plan', HTMLElement).dispatchEvent(new Event('click'));
    const text = document.createTextNode('plain text');
    byId('plan', HTMLElement).append(text);
    text.dispatchEvent(new Event('click', { bubbles: true }));
    expect(loadSaved(page.storage)).toBeNull();
  });

  it('copies the community notice, or explains why it cannot', async () => {
    const plan = await makePlan(
      { audience: { kind: 'community', setting: 'residents', people: 50 } },
      goodReply({ headline: 'Smog alert', body: 'Keep windows shut.' }),
    );
    const writeText = vi.fn(() => Promise.resolve());
    for (const clipboard of [
      { writeText },
      undefined,
      { writeText: () => Promise.reject(new Error('denied')) },
    ]) {
      loadPage();
      const page = env({ clipboard });
      save(page.storage, { plan, done: [] });
      start(page);
      find(document, '[data-copy]', HTMLButtonElement).click();
      await settle();
    }
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Smog alert'));
    expect(find(document, '[data-copy-status]', HTMLElement).textContent).toMatch(/blocked/u);
  });
});
