// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requestPlan, toFailure } from '../../web/api';
import { byId, find } from '../../web/dom';
import { type PageEnv, start } from '../../web/main';
import { forget, loadSaved, save } from '../../web/storage';
import { goodReply } from '../fixtures';
import { axeViolations, loadPage, makePlan, memoryStorage, settle } from './support';

beforeEach(loadPage);

function env(overrides: Partial<PageEnv> = {}): PageEnv & { printed: number } {
  const page = {
    printed: 0,
    fetch: (() => Promise.reject(new TypeError('offline'))) as typeof fetch,
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

const replyWith = (status: number, body: unknown) =>
  (() => Promise.resolve(Response.json(body, { status }))) as typeof fetch;

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
    await settle();
    expect(byId('form-status', HTMLElement).textContent).toBe('Your plan is ready below.');
    expect(document.activeElement).toBe(byId('plan', HTMLElement));
    expect(await axeViolations()).toEqual([]);
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
      { writeText } as unknown as Clipboard,
      undefined,
      { writeText: () => Promise.reject(new Error('denied')) } as unknown as Clipboard,
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
