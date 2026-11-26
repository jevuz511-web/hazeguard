/**
 * A minimal one-way store: events go in, `transition` makes the next state, and a single
 * listener applies the side effects (saving, rendering) for each change.
 */
import { type PageEvent, type PageState, transition } from './state';

/** Called after every event with the new and the previous state. */
export type Listener = (next: PageState, previous: PageState) => void;

/** Holds the current state and accepts events. */
export interface Store {
  current(): PageState;
  dispatch(event: PageEvent): void;
}

/** Creates a store that reports every change to `listener`. */
export function createStore(initial: PageState, listener: Listener): Store {
  let state = initial;
  return {
    current: () => state,
    dispatch(event) {
      const previous = state;
      state = transition(state, event);
      listener(state, previous);
    },
  };
}
