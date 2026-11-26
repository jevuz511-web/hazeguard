/**
 * The vetted catalogue of actions HazeGuard can recommend. Gemini may only choose and
 * explain entries from this list, so every recommendation is safe and sourced.
 */
import { COMMUNITY_ACTIONS } from './actions-community';
import { HOME_ACTIONS } from './actions-home';

/** Where in the home (or beyond it) an action happens. */
export type Room = 'bedroom' | 'kitchen' | 'living' | 'whole-home' | 'outdoors' | 'community';

/** Rough cost of an action. */
export type Cost = 'free' | 'low' | 'investment';

/** Facts about the household that decide whether an action applies. */
export type Condition =
  | 'sensitive'
  | 'purifier'
  | 'no-purifier'
  | 'solid-cooking-fuel'
  | 'fuel-heater'
  | 'smoker'
  | 'bad-air'
  | 'outdoor-worker'
  | 'community'
  | 'school';

/** One recommendable action. Lower `priority` numbers are more urgent. */
export interface Action {
  readonly id: string;
  readonly room: Room;
  readonly cost: Cost;
  readonly priority: 1 | 2 | 3;
  readonly when: readonly Condition[];
  readonly title: string;
  readonly detail: string;
}

/** Every action, in the order shown when priorities tie. */
export const CATALOGUE: readonly Action[] = [...HOME_ACTIONS, ...COMMUNITY_ACTIONS];

/** Looks up a catalogue entry by id. */
export function actionById(id: string): Action | undefined {
  return CATALOGUE.find((action) => action.id === id);
}
