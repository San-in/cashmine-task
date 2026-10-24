// The server recomputes the balances snapshot every 15 seconds. Instead of polling on our own
// 15s cycle (data up to ~30s old), we refetch right after the next snapshot should exist.
export const SNAPSHOT_INTERVAL_MS = 15_000;
// Margin for the server to publish the new snapshot and for request latency.
const SNAPSHOT_GRACE_MS = 1_000;
// Bounds protect against a wrong device clock and against hammering the API.
const MIN_DELAY_MS = 5_000;
const MAX_DELAY_MS = SNAPSHOT_INTERVAL_MS;

/** Milliseconds until the next balances refetch, given the current snapshot time. */
export function nextRefetchDelay(asOf: string | undefined, now: number): number {
  const asOfMs = asOf ? Date.parse(asOf) : Number.NaN;
  if (Number.isNaN(asOfMs)) return MAX_DELAY_MS;
  const delay = asOfMs + SNAPSHOT_INTERVAL_MS + SNAPSHOT_GRACE_MS - now;
  return Math.min(MAX_DELAY_MS, Math.max(MIN_DELAY_MS, delay));
}
