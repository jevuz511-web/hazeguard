/**
 * The repeatable "Regular trips" rows. Each row is cloned from a template and its fields
 * get names like `trips.0.km`, matching the server's error paths, plus unique ids.
 */
import { TRIPS } from './copy';
import { find, h } from './dom';
import { hourLabel } from './format';
import { BROWSER_LIMITS } from './limits';

/** Starting values for a new trip row. */
export interface TripDraft {
  readonly label: string;
  readonly km: number;
  readonly mode: string;
  readonly departHour: number;
  readonly perWeek: number;
}

/** Values for a trip added with the Add button. */
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
    find(row, '[data-slot="legend"]', HTMLLegendElement).textContent = TRIPS.legend(index + 1);
    for (const key of FIELDS) {
      const input = field(row, key);
      input.name = `trips.${String(index)}.${key}`;
      input.id = `f-trips-${String(index)}-${key}`;
      find(row, `[data-for="${key}"]`, HTMLLabelElement).htmlFor = input.id;
    }
    find(row, '[data-remove]', HTMLButtonElement).textContent = TRIPS.remove(index + 1);
  });
}

/** Adds a trip row (up to the trip limit) and returns its first field, or null when full. */
export function addTrip(
  list: HTMLOListElement,
  template: HTMLTemplateElement,
  draft: TripDraft = DEFAULT_TRIP,
): Field | null {
  if (list.children.length >= BROWSER_LIMITS.maxTrips) return null;
  const row = document.importNode(find(template.content, 'li', HTMLLIElement), true);
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
