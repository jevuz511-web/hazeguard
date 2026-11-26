/**
 * A small in-memory cache with a time-to-live and a size cap, used so repeated plans for
 * the same city reuse one forecast instead of calling Open-Meteo again.
 */

/** Cache settings. `now` is injectable so tests control time. */
export interface TtlCacheOptions {
  readonly ttlMs: number;
  readonly maxEntries: number;
  readonly now?: () => number;
}

/** A string-keyed cache whose entries expire. */
export interface TtlCache<T> {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
  /** Returns the cached value or loads, stores and returns a fresh one. */
  remember(key: string, load: () => Promise<T>): Promise<T>;
}

/** Maps keep insertion order, so the first key is the oldest. */
function evictOldest(entries: Map<string, unknown>): void {
  for (const oldest of entries.keys()) {
    entries.delete(oldest);
    return;
  }
}

/** Creates a cache; the oldest entry is evicted once `maxEntries` is reached. */
export function createTtlCache<T>(options: TtlCacheOptions): TtlCache<T> {
  const now = options.now ?? Date.now;
  const entries = new Map<string, { value: T; expires: number }>();
  const cache: TtlCache<T> = {
    get(key) {
      const entry = entries.get(key);
      if (entry === undefined) return undefined;
      if (entry.expires > now()) return entry.value;
      entries.delete(key);
      return undefined;
    },
    set(key, value) {
      entries.delete(key);
      if (entries.size >= options.maxEntries) evictOldest(entries);
      entries.set(key, { value, expires: now() + options.ttlMs });
    },
    async remember(key, load) {
      const cached = cache.get(key);
      if (cached !== undefined) return cached;
      const value = await load();
      cache.set(key, value);
      return value;
    },
  };
  return cache;
}
