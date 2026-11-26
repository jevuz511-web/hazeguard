/**
 * Form behaviour: trip rows, the community toggle and "Use my current location". Changes
 * are announced through polite live regions; location results are reported as events.
 */
import { LOCATION, TRIPS } from './copy';
import { byId } from './dom';
import type { Coords } from './form-read';
import { BROWSER_LIMITS, EXAMPLE_TRIP } from './limits';
import { addTrip, removeTrip } from './trip-rows';

/** The part of the Geolocation API the form uses. */
export type Locator = Pick<Geolocation, 'getCurrentPosition'>;

/** What the location control reports back to the page. */
export interface LocationEvents {
  readonly located: (coords: Coords) => void;
  readonly typed: () => void;
}

function announce(id: string, message: string): void {
  byId(id, HTMLElement).textContent = message;
}

/** Wires the add and remove trip buttons and starts with one example trip. */
export function wireTrips(): void {
  const list = byId('trip-list', HTMLOListElement);
  const template = byId('tpl-trip', HTMLTemplateElement);
  const add = byId('add-trip', HTMLButtonElement);
  const sync = (): void => {
    add.disabled = list.children.length >= BROWSER_LIMITS.maxTrips;
  };
  addTrip(list, template, EXAMPLE_TRIP);
  add.addEventListener('click', () => {
    addTrip(list, template)?.focus();
    sync();
    announce('trip-status', TRIPS.added(list.children.length));
  });
  list.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest('[data-remove]') : null;
    if (button === null) return;
    removeTrip(list, button);
    sync();
    add.focus();
    announce('trip-status', TRIPS.removed(list.children.length));
  });
}

/** Shows the community questions only when "a community" is chosen. */
export function wireAudience(form: HTMLFormElement): void {
  const fields = byId('community-fields', HTMLElement);
  form.addEventListener('change', (event) => {
    if (event.target instanceof HTMLInputElement && event.target.name === 'audience.kind') {
      fields.hidden = event.target.value !== 'community';
    }
  });
}

function locate(locator: Locator, events: LocationEvents, input: HTMLInputElement): void {
  announce('location-status', LOCATION.asking);
  locator.getCurrentPosition(
    ({ coords }) => {
      events.located({ latitude: coords.latitude, longitude: coords.longitude });
      input.value = LOCATION.fieldValue;
      announce('location-status', LOCATION.found);
    },
    () => {
      announce('location-status', LOCATION.denied);
    },
    { timeout: BROWSER_LIMITS.locationTimeoutMs, maximumAge: BROWSER_LIMITS.locationMaxAgeMs },
  );
}

/** Wires "Use my current location"; typing a place name afterwards switches back to it. */
export function wireLocation(events: LocationEvents, locator: Locator | undefined): void {
  const input = byId('f-location-name', HTMLInputElement);
  input.addEventListener('input', events.typed);
  byId('use-location', HTMLButtonElement).addEventListener('click', () => {
    if (locator === undefined) announce('location-status', LOCATION.unsupported);
    else locate(locator, events, input);
  });
}
