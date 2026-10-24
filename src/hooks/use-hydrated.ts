import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * false during static rendering and the hydration pass, true once running in the browser.
 * Lets us read browser-only state (localStorage) without a setState-in-effect round trip.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
