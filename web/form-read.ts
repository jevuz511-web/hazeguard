/**
 * Reads the planner form into the JSON body for POST /api/plan. Values are passed through
 * as typed; the server's schema is the single place that validates them.
 */

/** Browser coordinates from "Use my current location". */
export interface Coords {
  readonly latitude: number;
  readonly longitude: number;
}

/** The request body before server validation. */
export type PlanDraft = Readonly<Record<string, unknown>>;

/** A text field's trimmed value; missing fields read as empty. */
function textOf(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

/** A number from a field, or null when it is empty or not a number (the server explains). */
function numberOf(data: FormData, name: string): number | null {
  const raw = textOf(data, name);
  const value = Number(raw);
  return raw === '' || !Number.isFinite(value) ? null : value;
}

function tripsOf(data: FormData): PlanDraft[] {
  const indexes = [...data.keys()]
    .map((key) => /^trips\.(\d+)\.label$/u.exec(key)?.[1])
    .filter((index) => index !== undefined);
  return indexes.map((index) => ({
    label: textOf(data, `trips.${index}.label`),
    km: numberOf(data, `trips.${index}.km`),
    mode: textOf(data, `trips.${index}.mode`),
    departHour: numberOf(data, `trips.${index}.departHour`),
    perWeek: numberOf(data, `trips.${index}.perWeek`),
  }));
}

function audienceOf(data: FormData): PlanDraft {
  if (textOf(data, 'audience.kind') !== 'community') return { kind: 'household' };
  return {
    kind: 'community',
    setting: textOf(data, 'audience.setting'),
    people: numberOf(data, 'audience.people'),
  };
}

/** Builds the request body from the form and, if shared, the browser's coordinates. */
export function readForm(form: HTMLFormElement, coords: Coords | null): PlanDraft {
  const data = new FormData(form);
  const note = textOf(data, 'note');
  return {
    location:
      coords === null
        ? { kind: 'name', name: textOf(data, 'location.name') }
        : { kind: 'coords', ...coords },
    members: data.getAll('members').map(String),
    home: {
      cooking: textOf(data, 'home.cooking'),
      heating: textOf(data, 'home.heating'),
      purifier: data.has('home.purifier'),
      smoker: data.has('home.smoker'),
    },
    trips: tripsOf(data),
    transit: { bus: data.has('transit.bus'), metro: data.has('transit.metro') },
    flexHours: numberOf(data, 'flexHours'),
    audience: audienceOf(data),
    language: textOf(data, 'language'),
    note: note === '' ? null : note,
  };
}
