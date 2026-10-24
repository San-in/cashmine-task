import { useSyncExternalStore } from 'react';

import { readItem, writeItem } from '@/lib/storage';

export type PersistentStore<T> = {
  get: () => T;
  set: (update: T | ((prev: T) => T)) => void;
  useValue: () => T;
};

/**
 * A tiny global store mirrored to localStorage, for state that must survive a reload.
 * Loaded lazily on first client read; static rendering always sees `initial`.
 * T must be JSON-serialisable (no bigint).
 */
export function createPersistentStore<T>(key: string, initial: T): PersistentStore<T> {
  let loaded = false;
  let value = initial;
  const listeners = new Set<() => void>();

  const get = (): T => {
    if (!loaded && typeof window !== 'undefined') {
      loaded = true;
      const raw = readItem(key);
      if (raw) {
        try {
          value = JSON.parse(raw) as T;
        } catch {
          value = initial;
        }
      }
    }
    return value;
  };

  const set = (update: T | ((prev: T) => T)) => {
    const prev = get(); // make sure storage is loaded before we overwrite it
    const next = update instanceof Function ? update(prev) : update;
    if (Object.is(next, prev)) return;
    value = next;
    writeItem(key, JSON.stringify(next));
    listeners.forEach((listener) => listener());
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const useValue = () => useSyncExternalStore(subscribe, get, () => initial);

  return { get, set, useValue };
}
