/**
 * Page state and the pure transitions between states. Event handlers only describe what
 * happened; `transition` decides the next state, so every rule is testable without a DOM.
 */
import type { Plan } from '../src/services/coach';
import type { Coords } from './form-read';

/** A plan and the ids of the actions already done. */
export interface Saved {
  readonly plan: Plan;
  readonly done: readonly string[];
}

/** Everything the page remembers between events. */
export interface PageState {
  readonly coords: Coords | null;
  readonly saved: Saved | null;
  readonly busy: boolean;
}

/** Something that happened on the page. */
export type PageEvent =
  | { readonly type: 'located'; readonly coords: Coords }
  | { readonly type: 'place-typed' }
  | { readonly type: 'submitted' }
  | { readonly type: 'planned'; readonly plan: Plan }
  | { readonly type: 'failed' }
  | { readonly type: 'ticked'; readonly id: string; readonly done: boolean }
  | { readonly type: 'cleared' };

/** The state a page starts in, with any plan saved on this device. */
export function initialState(saved: Saved | null): PageState {
  return { coords: null, saved, busy: false };
}

/** Marks an action done or not done in a saved plan. */
export function tick(saved: Saved, id: string, done: boolean): Saved {
  const others = saved.done.filter((existing) => existing !== id);
  return { ...saved, done: done ? [...others, id] : others };
}

/** Applies a tick; without a saved plan there is nothing to tick. */
function withTick(state: PageState, event: { id: string; done: boolean }): PageState {
  return state.saved === null
    ? state
    : { ...state, saved: tick(state.saved, event.id, event.done) };
}

/** The next state after an event. */
export function transition(state: PageState, event: PageEvent): PageState {
  switch (event.type) {
    case 'located':
      return { ...state, coords: event.coords };
    case 'place-typed':
      return { ...state, coords: null };
    case 'submitted':
      return { ...state, busy: true };
    case 'planned':
      return { ...state, busy: false, saved: { plan: event.plan, done: [] } };
    case 'failed':
      return { ...state, busy: false };
    case 'ticked':
      return withTick(state, event);
    case 'cleared':
      return { ...state, saved: null };
  }
}
