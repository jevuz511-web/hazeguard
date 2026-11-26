/**
 * Keeps the last plan and the ticked actions in localStorage so a family can come back
 * to its checklist. Storage that is full, blocked or corrupted is treated as empty.
 */
import { hasShape, isPlan, isTextList } from './guards';
import type { Saved } from './state';

const ITEM = 'hazeguard.saved.v1';

/** The part of the Storage API this module uses. */
export type PlanStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function looksSaved(value: unknown): value is Saved {
  return hasShape(value, { plan: isPlan, done: isTextList });
}

/** The saved plan, or null when there is none or it cannot be read. */
export function loadSaved(storage: PlanStorage): Saved | null {
  try {
    const value: unknown = JSON.parse(storage.getItem(ITEM) ?? 'null');
    return looksSaved(value) ? value : null;
  } catch {
    return null;
  }
}

/** Saves the plan; returns false when the browser refuses. */
export function save(storage: PlanStorage, saved: Saved): boolean {
  try {
    storage.setItem(ITEM, JSON.stringify(saved));
    return true;
  } catch {
    return false;
  }
}

/** Forgets the saved plan. */
export function forget(storage: PlanStorage): void {
  try {
    storage.removeItem(ITEM);
  } catch {
    // Blocked storage has nothing to forget.
  }
}
