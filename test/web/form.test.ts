// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { byId, fill, find, h } from '../../web/dom';
import { wireAudience, wireLocation, wireTrips } from '../../web/form-controller';
import { clearErrors, fieldId, showErrors } from '../../web/form-errors';
import { readForm } from '../../web/form-read';
import { MAX_TRIPS, addTrip, removeTrip } from '../../web/trip-rows';
import { loadPage } from './support';

beforeEach(loadPage);

const list = () => byId('trip-list', HTMLOListElement);
const template = () => byId('tpl-trip', HTMLTemplateElement);
const form = () => byId('planner', HTMLFormElement);

describe('dom helpers', () => {
  it('fails loudly when the page is missing an element or it has the wrong type', () => {
    expect(() => byId('nope', HTMLElement)).toThrow('#nope is missing');
    expect(() => byId('planner', HTMLInputElement)).toThrow('not a HTMLInputElement');
    expect(() => find(document, '.nope', HTMLElement)).toThrow('.nope is missing');
  });

  it('builds elements from text, never HTML', () => {
    const element = h('p', { class: 'x' }, '<b>not bold</b>', null);
    expect(element.textContent).toBe('<b>not bold</b>');
    expect(element.children).toHaveLength(0);
    fill(element, 'replaced', null);
    expect(element.textContent).toBe('replaced');
  });
});

describe('trip rows', () => {
  it('names fields by index and links labels to them', () => {
    addTrip(list(), template());
    addTrip(list(), template(), {
      label: 'School run',
      km: 2,
      mode: 'walk',
      departHour: 7,
      perWeek: 5,
    });
    const second = byId('f-trips-1-label', HTMLInputElement);
    expect(second.name).toBe('trips.1.label');
    expect(second.value).toBe('School run');
    expect(document.querySelector('label[for="f-trips-1-km"]')?.textContent).toBe('Distance in km');
    expect(list().children[1]?.querySelector('legend')?.textContent).toBe('Trip 2');
    expect(byId('f-trips-0-departHour', HTMLSelectElement).options).toHaveLength(24);
  });

  it('stops at five trips and renumbers after a removal', () => {
    for (let i = 0; i < MAX_TRIPS; i += 1) addTrip(list(), template());
    expect(addTrip(list(), template())).toBeNull();
    removeTrip(list(), find(list(), '[data-remove]', HTMLButtonElement));
    expect(list().children).toHaveLength(4);
    expect(list().querySelector('[data-remove]')?.textContent).toBe('Remove trip 1');
    removeTrip(list(), h('button'));
    expect(list().children).toHaveLength(4);
  });

  it('rejects a broken template', () => {
    const broken = document.createElement('template');
    expect(() => addTrip(list(), broken)).toThrow('li is missing');
    const row = h('li', {}, h('legend', { 'data-slot': 'legend' }));
    list().append(row);
    expect(() => {
      removeTrip(list(), h('button'));
    }).toThrow('trip field label is missing');
  });
});

describe('form controller', () => {
  it('adds and removes trips with announcements and disables Add at the limit', () => {
    wireTrips();
    const add = byId('add-trip', HTMLButtonElement);
    expect(list().children).toHaveLength(1);
    for (let i = 0; i < 4; i += 1) add.click();
    expect(add.disabled).toBe(true);
    expect(byId('trip-status', HTMLElement).textContent).toBe('Trip 5 added.');
    find(list(), '[data-remove]', HTMLButtonElement).click();
    expect(add.disabled).toBe(false);
    expect(document.activeElement).toBe(add);
    expect(byId('trip-status', HTMLElement).textContent).toBe('Trip removed. 4 left.');
    list().click();
    const text = document.createTextNode('x');
    list().append(text);
    text.dispatchEvent(new Event('click', { bubbles: true }));
    expect(list().children).toHaveLength(4);
  });

  it('shows community questions only for a community plan', () => {
    wireAudience(form());
    const community = find(form(), 'input[value="community"]', HTMLInputElement);
    community.click();
    expect(byId('community-fields', HTMLElement).hidden).toBe(false);
    find(form(), 'input[value="household"]', HTMLInputElement).click();
    expect(byId('community-fields', HTMLElement).hidden).toBe(true);
    byId('f-language', HTMLSelectElement).dispatchEvent(new Event('change', { bubbles: true }));
    expect(byId('community-fields', HTMLElement).hidden).toBe(true);
  });

  it('uses the browser location and switches back when a place is typed', () => {
    const state = { coords: null as { latitude: number; longitude: number } | null };
    const geolocation = {
      getCurrentPosition: (success: PositionCallback) => {
        success({ coords: { latitude: 26.8, longitude: 80.9 } } as GeolocationPosition);
      },
    } as unknown as Geolocation;
    wireLocation(state, geolocation);
    byId('use-location', HTMLButtonElement).click();
    expect(state.coords).toEqual({ latitude: 26.8, longitude: 80.9 });
    expect(byId('location-status', HTMLElement).textContent).toBe(
      'Location found. The plan will use it.',
    );
    byId('f-location-name', HTMLInputElement).dispatchEvent(new Event('input'));
    expect(state.coords).toBeNull();
  });

  it('explains when location is refused or unsupported', () => {
    const denied = {
      getCurrentPosition: (_: PositionCallback, failure: PositionErrorCallback) => {
        failure({ code: 1 } as GeolocationPositionError);
      },
    } as unknown as Geolocation;
    wireLocation({ coords: null }, denied);
    byId('use-location', HTMLButtonElement).click();
    expect(byId('location-status', HTMLElement).textContent).toMatch(/not shared/u);
    loadPage();
    wireLocation({ coords: null }, undefined);
    byId('use-location', HTMLButtonElement).click();
    expect(byId('location-status', HTMLElement).textContent).toMatch(/cannot share/u);
  });
});

describe('readForm', () => {
  it('reads every answer into the request body', () => {
    wireTrips();
    byId('f-location-name', HTMLInputElement).value = '  Patna ';
    find(form(), 'input[value="older-adult"]', HTMLInputElement).checked = true;
    find(form(), 'input[name="home.purifier"]', HTMLInputElement).checked = true;
    find(form(), 'input[value="community"]', HTMLInputElement).checked = true;
    byId('f-trips-0-km', HTMLInputElement).value = '';
    byId('f-note', HTMLTextAreaElement).value = 'Near a brick kiln';
    expect(readForm(form(), null)).toEqual({
      location: { kind: 'name', name: 'Patna' },
      members: ['older-adult'],
      home: { cooking: 'lpg', heating: 'none', purifier: true, smoker: false },
      trips: [{ label: 'Commute', km: null, mode: 'car', departHour: 9, perWeek: 10 }],
      transit: { bus: false, metro: false },
      flexHours: 1,
      audience: { kind: 'community', setting: 'residents', people: 200 },
      language: 'en',
      note: 'Near a brick kiln',
    });
  });

  it('sends coordinates instead of the name, and no note when empty', () => {
    const body = readForm(form(), { latitude: 1, longitude: 2 });
    expect(body['location']).toEqual({ kind: 'coords', latitude: 1, longitude: 2 });
    expect(body['note']).toBeNull();
    expect(body['audience']).toEqual({ kind: 'household' });
    expect(readForm(h('form'), null)['flexHours']).toBeNull();
  });
});

describe('form errors', () => {
  it('lists errors with links, marks fields and focuses the summary', () => {
    wireTrips();
    showErrors('Some answers need checking.', {
      'location.name': 'Please fill this in.',
      'trips.0.km': 'Use at least 0.1 km.',
      body: 'Odd',
    });
    const summary = byId('error-summary', HTMLElement);
    expect(summary.hidden).toBe(false);
    expect(document.activeElement).toBe(summary);
    const links = [...summary.querySelectorAll('a')].map((link) => [
      link.getAttribute('href'),
      link.textContent,
    ]);
    expect(links).toEqual([
      ['#f-location-name', 'City or neighbourhood: Please fill this in.'],
      ['#f-trips-0-km', 'Distance in km: Use at least 0.1 km.'],
      ['#planner', 'body: Odd'],
    ]);
    expect(byId('f-location-name', HTMLInputElement).getAttribute('aria-invalid')).toBe('true');
    expect(byId('f-location-name-error', HTMLElement).textContent).toBe('Please fill this in.');
    clearErrors();
    expect(summary.hidden).toBe(true);
    expect(document.querySelectorAll('[aria-invalid]')).toHaveLength(0);
    expect(fieldId('audience.people')).toBe('f-audience-people');
  });
});
