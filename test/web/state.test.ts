import { beforeAll, describe, expect, it } from 'vitest';
import type { Plan } from '../../src/services/coach';
import { hasShape, isPlan, isRecord, isTextList } from '../../web/guards';
import { type PageEvent, type PageState, initialState, tick, transition } from '../../web/state';
import { createStore } from '../../web/store';
import { makePlan } from './support';

let plan: Plan;
beforeAll(async () => {
  plan = await makePlan();
});

const run = (events: PageEvent[], start: PageState = initialState(null)): PageState =>
  events.reduce(transition, start);

describe('transition', () => {
  it('remembers and forgets browser coordinates', () => {
    const coords = { latitude: 26.8, longitude: 80.9 };
    expect(run([{ type: 'located', coords }]).coords).toEqual(coords);
    expect(run([{ type: 'located', coords }, { type: 'place-typed' }]).coords).toBeNull();
  });

  it('is busy from submit until a plan or a failure arrives', () => {
    expect(run([{ type: 'submitted' }]).busy).toBe(true);
    expect(run([{ type: 'submitted' }, { type: 'failed' }]).busy).toBe(false);
    const planned = run([{ type: 'submitted' }, { type: 'planned', plan }]);
    expect(planned).toEqual({ coords: null, busy: false, saved: { plan, done: [] } });
  });

  it('ticks and unticks actions, and ignores ticks without a plan', () => {
    const ticked = run([
      { type: 'planned', plan },
      { type: 'ticked', id: 'clean-room', done: true },
      { type: 'ticked', id: 'wet-cleaning', done: true },
      { type: 'ticked', id: 'clean-room', done: false },
    ]);
    expect(ticked.saved?.done).toEqual(['wet-cleaning']);
    const empty = initialState(null);
    expect(transition(empty, { type: 'ticked', id: 'x', done: true })).toBe(empty);
  });

  it('clears the saved plan', () => {
    expect(run([{ type: 'planned', plan }, { type: 'cleared' }]).saved).toBeNull();
  });

  it('never ticks an action twice', () => {
    const saved = { plan, done: ['a'] };
    expect(tick(saved, 'a', true).done).toEqual(['a']);
  });
});

describe('createStore', () => {
  it('reports each change with the new and previous state', () => {
    const changes: [boolean, boolean][] = [];
    const store = createStore(initialState(null), (next, previous) =>
      changes.push([next.busy, previous.busy]),
    );
    store.dispatch({ type: 'submitted' });
    store.dispatch({ type: 'failed' });
    expect(changes).toEqual([
      [true, false],
      [false, true],
    ]);
    expect(store.current().busy).toBe(false);
  });
});

describe('guards', () => {
  it('accepts a real plan and rejects look-alikes', () => {
    expect(isPlan(plan)).toBe(true);
    expect(isPlan({ ...plan, language: 'fr' })).toBe(false);
    expect(isPlan({ ...plan, author: { kind: 'robot' } })).toBe(false);
    expect(isPlan({ ...plan, writing: { summary: 3, picks: [] } })).toBe(false);
    expect(isPlan(null)).toBe(false);
    expect(isPlan('plan')).toBe(false);
  });

  it('checks shapes, records and string lists', () => {
    expect(hasShape({ a: 'x' }, { a: (value) => value === 'x' })).toBe(true);
    expect(hasShape([], { a: () => true })).toBe(true);
    expect(isRecord(null)).toBe(false);
    expect(isTextList(['a', 'b'])).toBe(true);
    expect(isTextList(['a', 1])).toBe(false);
    expect(isTextList('a')).toBe(false);
  });
});
