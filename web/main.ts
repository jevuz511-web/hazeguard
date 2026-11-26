/**
 * Browser entry point: restores a saved plan, wires the form and plan controls, and
 * turns a submitted form into a rendered, saved plan.
 */
import type { Plan } from '../src/services/coach';
import { requestPlan } from './api';
import { byId, find } from './dom';
import { type FormState, wireAudience, wireLocation, wireTrips } from './form-controller';
import { clearErrors, showErrors } from './form-errors';
import { readForm } from './form-read';
import { renderPlan } from './render-plan';
import { type Saved, forget, loadSaved, save } from './storage';

/** Browser services, injectable for tests. */
export interface PageEnv {
  readonly fetch: typeof fetch;
  readonly storage: Storage;
  readonly geolocation: Geolocation | undefined;
  readonly clipboard: Clipboard | undefined;
  readonly print: () => void;
}

/** Mutable page state. */
interface PageState extends FormState {
  saved: Saved | null;
}

function status(message: string): void {
  byId('form-status', HTMLElement).textContent = message;
}

function show(state: PageState, env: PageEnv, plan: Plan): void {
  state.saved = { plan, done: [] };
  save(env.storage, state.saved);
  renderPlan(plan, new Set());
}

async function submit(state: PageState, env: PageEnv): Promise<void> {
  const button = byId('submit', HTMLButtonElement);
  clearErrors();
  button.disabled = true;
  status(
    'Fetching the live air forecast and writing your plan. This can take up to half a minute.',
  );
  const result = await requestPlan(
    readForm(byId('planner', HTMLFormElement), state.coords),
    env.fetch,
  );
  button.disabled = false;
  if (!result.ok) {
    status('');
    showErrors(result.title, result.fields);
    return;
  }
  show(state, env, result.plan);
  status('Your plan is ready below.');
  byId('plan', HTMLElement).focus();
}

function onPlanClick(state: PageState, env: PageEnv, target: Element): void {
  if (target.closest('#print-plan') !== null) env.print();
  if (target.closest('#clear-plan') !== null) {
    forget(env.storage);
    state.saved = null;
    byId('plan', HTMLElement).hidden = true;
    status('Saved plan cleared.');
    byId('f-location-name', HTMLInputElement).focus();
  }
  const copy = target.closest<HTMLElement>('[data-copy]');
  if (copy !== null) void copyNotice(env, copy);
}

/** Copies text and says how it went, in words for the status line. */
async function copyText(
  clipboard: Clipboard | undefined,
  text: string | undefined,
): Promise<string> {
  if (clipboard === undefined || text === undefined) {
    return 'Copying is not available here. Select the notice text and copy it instead.';
  }
  try {
    await clipboard.writeText(text);
    return 'Notice copied. Paste it into your group.';
  } catch {
    return 'Copying was blocked. Select the notice text and copy it instead.';
  }
}

async function copyNotice(env: PageEnv, button: HTMLElement): Promise<void> {
  const message = await copyText(env.clipboard, button.dataset['text']);
  find(document, '[data-copy-status]', HTMLElement).textContent = message;
}

/** A ticked or unticked checklist box. */
interface Tick {
  readonly id: string;
  readonly checked: boolean;
}

/** The tick a change event describes, or null when it came from something else. */
function tickOf(target: EventTarget | null): Tick | null {
  if (!(target instanceof HTMLInputElement)) return null;
  const id = target.dataset['action'];
  return id === undefined ? null : { id, checked: target.checked };
}

function onTick(state: PageState, env: PageEnv, { id, checked }: Tick): void {
  if (state.saved === null) return;
  const done = new Set(state.saved.done);
  if (checked) done.add(id);
  else done.delete(id);
  state.saved = { ...state.saved, done: [...done] };
  save(env.storage, state.saved);
}

/** Starts the page. */
export function start(env: PageEnv): void {
  const state: PageState = { coords: null, saved: loadSaved(env.storage) };
  const form = byId('planner', HTMLFormElement);
  const plan = byId('plan', HTMLElement);
  wireTrips();
  wireAudience(form);
  wireLocation(state, env.geolocation);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void submit(state, env);
  });
  plan.addEventListener('click', (event) => {
    if (event.target instanceof Element) onPlanClick(state, env, event.target);
  });
  plan.addEventListener('change', (event) => {
    const tick = tickOf(event.target);
    if (tick !== null) onTick(state, env, tick);
  });
  if (state.saved !== null) renderPlan(state.saved.plan, new Set(state.saved.done));
}
