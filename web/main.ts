/**
 * Browser entry point: wires the form and plan controls to a one-way store. Handlers
 * dispatch events, `transition` computes state, and `applyChange` saves and renders.
 */
import { type Send, requestPlan } from './api';
import { COPYING, STATUS } from './copy';
import { byId, find } from './dom';
import { type Locator, wireAudience, wireLocation, wireTrips } from './form-controller';
import { clearErrors, showErrors } from './form-errors';
import { readForm } from './form-read';
import { renderPlan } from './render-plan';
import { type PageState, initialState } from './state';
import { type PlanStorage, forget, loadSaved, save } from './storage';
import { type Store, createStore } from './store';

/** Browser services, narrowed to what the page uses so tests can supply small fakes. */
export interface PageEnv {
  readonly fetch: Send;
  readonly storage: PlanStorage;
  readonly geolocation: Locator | undefined;
  readonly clipboard: Pick<Clipboard, 'writeText'> | undefined;
  readonly print: () => void;
}

function status(message: string): void {
  byId('form-status', HTMLElement).textContent = message;
}

/** Marks the form and plan busy for assistive technology while a plan is being made. */
function showBusy(busy: boolean): void {
  byId('submit', HTMLButtonElement).disabled = busy;
  for (const id of ['planner', 'plan'])
    byId(id, HTMLElement).setAttribute('aria-busy', String(busy));
}

/** Applies the side effects of a state change: the busy state, storage and rendering. */
function applyChange(env: PageEnv, next: PageState, previous: PageState): void {
  showBusy(next.busy);
  if (next.saved === previous.saved) return;
  if (next.saved === null) {
    forget(env.storage);
    byId('plan', HTMLElement).hidden = true;
    return;
  }
  save(env.storage, next.saved);
  if (next.saved.plan !== previous.saved?.plan)
    renderPlan(next.saved.plan, new Set(next.saved.done));
}

async function submit(store: Store, env: PageEnv): Promise<void> {
  clearErrors();
  store.dispatch({ type: 'submitted' });
  status(STATUS.working);
  const draft = readForm(byId('planner', HTMLFormElement), store.current().coords);
  const result = await requestPlan(draft, env.fetch);
  if (!result.ok) {
    store.dispatch({ type: 'failed' });
    status('');
    showErrors(result.title, result.fields);
    return;
  }
  store.dispatch({ type: 'planned', plan: result.plan });
  status(STATUS.ready);
  byId('plan', HTMLElement).focus();
}

/** Copies text and says how it went, in words for the status line. */
async function copyText(
  clipboard: PageEnv['clipboard'],
  text: string | undefined,
): Promise<string> {
  if (clipboard === undefined || text === undefined) return COPYING.unavailable;
  try {
    await clipboard.writeText(text);
    return COPYING.done;
  } catch {
    return COPYING.blocked;
  }
}

async function copyNotice(env: PageEnv, button: HTMLElement): Promise<void> {
  const message = await copyText(env.clipboard, button.dataset['text']);
  find(document, '[data-copy-status]', HTMLElement).textContent = message;
}

function onPlanClick(store: Store, env: PageEnv, target: Element): void {
  if (target.closest('#print-plan') !== null) env.print();
  if (target.closest('#clear-plan') !== null) {
    store.dispatch({ type: 'cleared' });
    status(STATUS.cleared);
    byId('f-location-name', HTMLInputElement).focus();
  }
  const copy = target.closest<HTMLElement>('[data-copy]');
  if (copy !== null) void copyNotice(env, copy);
}

/** The tick a change event describes, or null when it came from something else. */
function tickOf(target: EventTarget | null): { id: string; done: boolean } | null {
  if (!(target instanceof HTMLInputElement)) return null;
  const id = target.dataset['action'];
  return id === undefined ? null : { id, done: target.checked };
}

function wirePlan(store: Store, env: PageEnv): void {
  const plan = byId('plan', HTMLElement);
  plan.addEventListener('click', (event) => {
    if (event.target instanceof Element) onPlanClick(store, env, event.target);
  });
  plan.addEventListener('change', (event) => {
    const tick = tickOf(event.target);
    if (tick !== null) store.dispatch({ type: 'ticked', ...tick });
  });
}

/** Starts the page. */
export function start(env: PageEnv): void {
  const saved = loadSaved(env.storage);
  const store = createStore(initialState(saved), (next, previous) => {
    applyChange(env, next, previous);
  });
  const form = byId('planner', HTMLFormElement);
  wireTrips();
  wireAudience(form);
  wireLocation(
    {
      located: (coords) => {
        store.dispatch({ type: 'located', coords });
      },
      typed: () => {
        store.dispatch({ type: 'place-typed' });
      },
    },
    env.geolocation,
  );
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void submit(store, env);
  });
  wirePlan(store, env);
  if (saved !== null) renderPlan(saved.plan, new Set(saved.done));
}
