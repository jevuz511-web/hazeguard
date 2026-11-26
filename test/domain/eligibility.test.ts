import { describe, expect, it } from 'vitest';
import { CATALOGUE, actionById } from '../../src/domain/catalogue';
import { type Situation, eligibleActions, fits } from '../../src/domain/eligibility';
import { outlook } from '../../src/domain/forecast';
import { dayOfHours, forecast, household } from '../fixtures';

const smoggy = outlook(forecast());
const clean = outlook(forecast([{ time: '2026-12-01T12:00', pm2_5: 10, pm10: 10 }]));

function situation(overrides: Partial<Situation> = {}): Situation {
  return { household: household(), outlook: smoggy, audience: { kind: 'household' }, ...overrides };
}

const ids = (value: Situation) => eligibleActions(value).map((action) => action.id);

describe('catalogue', () => {
  it('has unique ids, short titles and a detail for every action', () => {
    const all = CATALOGUE.map((action) => action.id);
    expect(new Set(all).size).toBe(all.length);
    for (const action of CATALOGUE) {
      expect(action.title.length).toBeLessThanOrEqual(60);
      expect(action.detail.length).toBeGreaterThan(40);
    }
  });

  it('looks actions up by id', () => {
    expect(actionById('no-burning')?.room).toBe('community');
    expect(actionById('nope')).toBeUndefined();
  });
});

describe('eligibleActions', () => {
  it('ranks urgent actions first for a household with a child on a smoggy day', () => {
    const list = ids(situation());
    expect(list.slice(0, 2)).toEqual(['clean-room', 'windows-at-peaks']);
    expect(list).toContain('fan-filter');
    expect(list).toContain('fitted-mask');
    expect(list).not.toContain('purifier-closed-room');
    expect(list).not.toContain('no-burning');
  });

  it('switches purifier advice when the home has one', () => {
    const home = { ...household().home, purifier: true };
    const list = ids(situation({ household: household({ home }) }));
    expect(list).toContain('purifier-closed-room');
    expect(list).toContain('check-filter');
    expect(list).not.toContain('fan-filter');
  });

  it('adds fuel, heater, smoking and outdoor-work actions only when they apply', () => {
    const home = {
      cooking: 'biomass',
      heating: 'wood-or-coal',
      purifier: false,
      smoker: true,
    } as const;
    const list = ids(situation({ household: household({ home, members: ['outdoor-worker'] }) }));
    expect(list).toEqual(
      expect.arrayContaining([
        'clean-cooking-fuel',
        'electric-heating',
        'smoke-outside',
        'outdoor-work-breaks',
      ]),
    );
    expect(list).not.toContain('clean-room');
    const kerosene = { ...home, cooking: 'kerosene', heating: 'kerosene', smoker: false } as const;
    expect(ids(situation({ household: household({ home: kerosene }) }))).toEqual(
      expect.arrayContaining(['clean-cooking-fuel', 'electric-heating']),
    );
  });

  it('drops bad-air actions on a clean day', () => {
    const list = ids(situation({ outlook: clean }));
    expect(list).not.toContain('fitted-mask');
    expect(list).not.toContain('seal-gaps');
  });

  it('adds community actions, and school ones only for schools', () => {
    const residents = ids(
      situation({ audience: { kind: 'community', setting: 'residents', people: 300 } }),
    );
    expect(residents).toContain('no-burning');
    expect(residents).not.toContain('indoor-assembly');
    const school = ids(
      situation({ audience: { kind: 'community', setting: 'school', people: 900 } }),
    );
    expect(school).toContain('indoor-assembly');
  });

  it('checks every condition of an action', () => {
    const action = { ...CATALOGUE[0]!, when: ['sensitive', 'purifier'] as const };
    expect(fits(action, situation())).toBe(false);
    expect(dayOfHours()).toHaveLength(24);
  });
});
