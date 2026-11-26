/**
 * The repeatable "Regular trips" rows. Each row is cloned from a template and its fields
 * get names like `trips.0.km`, matching the server's error paths, plus unique ids.
 */
import { find, h } from './dom';
import { hourLabel } from './format';

/** Most trips a plan accepts. */
export const MAX_TRIPS = 5;

/** Starting values for a new trip row. */
export interface TripDraft {
  readonly label: string;
  readonly km: number;
  readonly mode: string;
  readonly departHour: number;
  readonly perWeek: number;
}

const DEFAULT_TRIP: TripDraft = { label: '', km: 5, mode: 'car', departHour: 8, perWeek: 5 };
const FIELDS = ['label', 'km', 'mode', 'departHour', 'perWeek'] as const;

type Field = HTMLInputElement | HTMLSelectElement;

function field(row: Element, key: (typeof FIELDS)[number]): Field {
  const element = row.querySelector(`[data-name="${key}"]`);
  if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement) return element;
  throw new Error(`trip field ${key} is missing`);
}

/** Gives every field in every row its index-based name, id and label. */
export function renumber(list: HTMLOListElement): void {
  [...list.children].forEach((row, index) => {
    const number = String(index + 1);
    find(row, '[data-slot="legend"]', HTMLLegendElement).textContent = `Trip ${number}`;
    for (const key of FIELDS) {
      const input = field(row, key);
      input.name = `trips.${String(index)}.${key}`;
      input.id = `f-trips-${String(index)}-${key}`;
      find(row, `[data-for="${key}"]`, HTMLLabelElement).htmlFor = input.id;
    }
    find(row, '[data-remove]', HTMLButtonElement).textContent = `Remove trip ${number}`;
  });
}

/** Adds a trip row (up to MAX_TRIPS) and returns its first field, or null when full. */
export function addTrip(
  list: HTMLOListElement,
  template: HTMLTemplateElement,
  draft: TripDraft = DEFAULT_TRIP,
): Field | null {
  if (list.children.length >= MAX_TRIPS) return null;
  const row = find(template.content, 'li', HTMLLIElement).cloneNode(true) as HTMLLIElement;
  find(row, '[data-hours]', HTMLSelectElement).replaceChildren(
    ...Array.from({ length: 24 }, (_, hour) =>
      h('option', { value: String(hour) }, hourLabel(hour)),
    ),
  );
  for (const key of FIELDS) field(row, key).value = String(draft[key]);
  list.append(row);
  renumber(list);
  return field(row, 'label');
}

/** Removes the row containing `button` and renumbers the rest. */
export function removeTrip(list: HTMLOListElement, button: Element): void {
  button.closest('li')?.remove();
  renumber(list);
}
