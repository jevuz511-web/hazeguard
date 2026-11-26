/**
 * Keeps the last plan and the ticked actions in localStorage so a family can come back
 * to its checklist. Storage that is full, blocked or corrupted is treated as empty.
 */
import type { Plan } from '../src/services/coach';

const ITEM = 'hazeguard.saved.v1';

/** A plan and the ids of the actions already done. */
export interface Saved {
  readonly plan: Plan;
  readonly done: readonly string[];
}

function looksSaved(value: unknown): value is Saved {
  if (typeof value !== 'object' || value === null) return false;
  const { plan, done } = value as Record<string, unknown>;
  return (
    typeof plan === 'object' &&
    plan !== null &&
    Array.isArray(done) &&
    done.every((id) => typeof id === 'string')
  );
}

/** The saved plan, or null when there is none or it cannot be read. */
export function loadSaved(storage: Storage): Saved | null {
  try {
    const value: unknown = JSON.parse(storage.getItem(ITEM) ?? 'null');
    return looksSaved(value) ? value : null;
  } catch {
    return null;
  }
}

/** Saves the plan; returns false when the browser refuses. */
export function save(storage: Storage, saved: Saved): boolean {
  try {
    storage.setItem(ITEM, JSON.stringify(saved));
    return true;
  } catch {
    return false;
  }
}

/** Forgets the saved plan. */
export function forget(storage: Storage): void {
  try {
    storage.removeItem(ITEM);
  } catch {
    // Blocked storage has nothing to forget.
  }
}
