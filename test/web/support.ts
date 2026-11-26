/** jsdom helpers: load the real page, build real plans and fake browser services. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import axe from 'axe-core';
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

/** axe-core violations for WCAG A/AA rules and best practices (contrast is checked separately). */
export async function axeViolations(): Promise<string[]> {
  const result = await axe.run(document, {
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'],
    },
    rules: { 'color-contrast': { enabled: false } },
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
