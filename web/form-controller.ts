/**
 * Form behaviour: trip rows, the community toggle, "Use my current location" and
 * submitting. Every change is announced through a polite live region.
 */
import { byId } from './dom';
import type { Coords } from './form-read';
import { MAX_TRIPS, addTrip, removeTrip } from './trip-rows';

/** State the form shares with the rest of the page. */
export interface FormState {
  coords: Coords | null;
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
    add.disabled = list.children.length >= MAX_TRIPS;
  };
  addTrip(list, template, { label: 'Commute', km: 8, mode: 'car', departHour: 9, perWeek: 10 });
  add.addEventListener('click', () => {
    addTrip(list, template)?.focus();
    sync();
    announce('trip-status', `Trip ${String(list.children.length)} added.`);
  });
  list.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest('[data-remove]') : null;
    if (button === null) return;
    removeTrip(list, button);
    sync();
    add.focus();
    announce('trip-status', `Trip removed. ${String(list.children.length)} left.`);
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

/** Wires "Use my current location"; typing a place name afterwards switches back to it. */
export function wireLocation(state: FormState, geolocation: Geolocation | undefined): void {
  const input = byId('f-location-name', HTMLInputElement);
  const button = byId('use-location', HTMLButtonElement);
  input.addEventListener('input', () => {
    state.coords = null;
  });
  button.addEventListener('click', () => {
    if (geolocation === undefined) {
      announce('location-status', 'This browser cannot share its location. Please type a place.');
      return;
    }
    announce('location-status', 'Asking your browser for your location…');
    geolocation.getCurrentPosition(
      ({ coords }) => {
        state.coords = { latitude: coords.latitude, longitude: coords.longitude };
        input.value = 'My current location';
        announce('location-status', 'Location found. The plan will use it.');
      },
      () => {
        announce('location-status', 'Location was not shared. Please type a place instead.');
      },
      { timeout: 10_000, maximumAge: 600_000 },
    );
  });
}
