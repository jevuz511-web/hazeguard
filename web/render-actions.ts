/**
 * The action checklist, grouped by room. Each item shows the vetted catalogue text plus,
 * when Gemini wrote one, why it matters for this household; ticks are saved.
 */
import type { Action, Room } from '../src/domain/catalogue';
import type { Language } from '../src/domain/household';
import type { Pick } from '../src/services/tailoring';
import { h } from './dom';

const ROOM_NAMES: Readonly<Record<Room, string>> = {
  bedroom: 'Bedroom',
  kitchen: 'Kitchen',
  living: 'Living space',
  'whole-home': 'Whole home',
  outdoors: 'Going out',
  community: 'Together with your community',
};

const COST_NAMES: Readonly<Record<Action['cost'], string>> = {
  free: 'Free',
  low: 'Low cost',
  investment: 'Worth investing in',
};

/** What the checklist is built from. */
export interface ChecklistInput {
  readonly picks: readonly Pick[];
  readonly actions: readonly Action[];
  readonly done: ReadonlySet<string>;
  readonly language: Language;
}

function item(action: Action, pick: Pick, input: ChecklistInput): HTMLLIElement {
  const box = h('input', { type: 'checkbox', id: `act-${action.id}`, 'data-action': action.id });
  box.checked = input.done.has(action.id);
  return h(
    'li',
    { class: 'action' },
    box,
    h('label', { for: box.id }, action.title),
    h('span', { class: `cost cost-${action.cost}` }, COST_NAMES[action.cost]),
    pick.why === null ? null : h('p', { class: 'why', lang: input.language }, pick.why),
    h('p', { class: 'detail' }, action.detail),
  );
}

/** Builds the checklist: picked actions grouped by room in order of first appearance. */
export function renderActions(input: ChecklistInput): HTMLElement {
  const byId = new Map(input.actions.map((action) => [action.id, action]));
  const groups = new Map<Room, HTMLLIElement[]>();
  for (const pick of input.picks) {
    const action = byId.get(pick.id);
    if (action === undefined) continue;
    groups.set(action.room, [...(groups.get(action.room) ?? []), item(action, pick, input)]);
  }
  const sections = [...groups].map(([room, items]) =>
    h(
      'div',
      { class: 'room' },
      h('h4', {}, ROOM_NAMES[room]),
      h('ul', { class: 'actions' }, ...items),
    ),
  );
  return h(
    'section',
    { class: 'card checklist', 'aria-labelledby': 'actions-title' },
    h('h3', { id: 'actions-title' }, 'What to do, room by room'),
    h(
      'p',
      { class: 'hint' },
      'Most urgent first. Tick each one off as you do it; your ticks are saved on this device.',
    ),
    ...sections,
  );
}
