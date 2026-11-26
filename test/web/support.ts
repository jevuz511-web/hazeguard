/** jsdom helpers: load the real page, build real plans and fake browser services. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import axe from 'axe-core';
import type { Locator } from '../../web/form-controller';
import { createCoach, type Plan, type PlanRequest } from '../../src/services/coach';
import { fixedAir, goodReply, memoryLogger, planRequest, scriptedModel } from '../fixtures';

const PAGE = readFileSync(join(process.cwd(), 'public', 'index.html'), 'utf8');

/** Replaces the jsdom document with public/index.html (scripts are not run). */
export function loadPage(): void {
  const parsed = new DOMParser().parseFromString(PAGE, 'text/html');
  document.replaceChild(
    document.importNode(parsed.documentElement, true),
    document.documentElement,
  );
}

/** A real plan from the coach, written by a scripted model or by the rules. */
export async function makePlan(
  overrides: Partial<PlanRequest> = {},
  reply: string | null = goodReply(),
): Promise<Plan> {
  const model = reply === null ? null : scriptedModel([reply]);
  const coach = createCoach({
    air: fixedAir(),
    model,
    models: ['gemini-test'],
    logger: memoryLogger(),
  });
  return coach.plan(planRequest(overrides));
}

/** An in-memory Storage; `broken` makes every call throw like blocked storage. */
export function memoryStorage(broken = false): Storage {
  const items = new Map<string, string>();
  const guard = () => {
    if (broken) throw new DOMException('blocked', 'SecurityError');
  };
  return {
    get length() {
      return items.size;
    },
    clear: () => {
      guard();
      items.clear();
    },
    getItem: (key) => {
      guard();
      return items.get(key) ?? null;
    },
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => {
      guard();
      items.delete(key);
    },
    setItem: (key, value) => {
      guard();
      items.set(key, value);
    },
  };
}

/** axe-core violations for every WCAG A, AA and AAA rule, best practices and experimental rules. */
export async function axeViolations(): Promise<string[]> {
  const result = await axe.run(document, {
    runOnly: {
      type: 'tag',
      values: [
        'wcag2a',
        'wcag2aa',
        'wcag2aaa',
        'wcag21a',
        'wcag21aa',
        'wcag21aaa',
        'wcag22aa',
        'best-practice',
        'experimental',
      ],
    },
    // jsdom has no layout, so contrast is checked from the CSS tokens in contrast.test.ts.
    rules: { 'color-contrast': { enabled: false }, 'color-contrast-enhanced': { enabled: false } },
  });
  return result.violations.map(
    (violation) =>
      `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
  );
}

/** Lets pending promise callbacks run. */
export async function settle(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}

/** A Locator that always reports the given coordinates. */
export function fixedLocator(latitude: number, longitude: number): Locator {
  return {
    getCurrentPosition: (success) => {
      const coords = {
        latitude,
        longitude,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
        toJSON: () => ({}),
      };
      success({ coords, timestamp: 0, toJSON: () => ({}) });
    },
  };
}
