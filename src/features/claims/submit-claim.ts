import { createClaim, type Claim, type CreateClaimBody } from '@/api/claims';
import { isApiError, retryDelayFor } from '@/api/client';

import { claimIntentStore, newIdempotencyKey, trackClaim } from './claims-store';

const MAX_ATTEMPTS = 5;

export type SubmitOutcome =
  | { kind: 'created'; claim: Claim }
  /** The server definitely did not create a claim (4xx). Safe to edit and try again. */
  | { kind: 'rejected'; error: unknown }
  /** We still do not know. The intent is kept; only "check again" with the same key is offered. */
  | { kind: 'unknown'; error: unknown };

/** Freezes key + body at confirmation. Ignored if an unresolved claim already exists. */
export function confirmClaimIntent(body: CreateClaimBody): void {
  if (claimIntentStore.get()) return;
  claimIntentStore.set({ key: newIdempotencyKey(), body, confirmedAt: new Date().toISOString() });
}

/**
 * 5xx, 504, timeouts and dropped connections may have created the claim; 429 did not run
 * but is also retried. Anything we cannot classify is treated as unknown, to be safe.
 */
function mayHaveSucceeded(error: unknown): boolean {
  return !isApiError(error) || error.outcomeUnknown || error.code === 'RATE_LIMITED';
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// One submission at a time across the whole app (a remount or reload joins the running one).
let running: Promise<SubmitOutcome> | null = null;

export function submitClaimIntent(token: string, onAttempt?: (attempt: number) => void): Promise<SubmitOutcome> {
  if (!running) {
    running = run(token, onAttempt).finally(() => {
      running = null;
    });
  }
  return running;
}

async function run(token: string, onAttempt?: (attempt: number) => void): Promise<SubmitOutcome> {
  const intent = claimIntentStore.get();
  if (!intent) return { kind: 'rejected', error: new Error('There is no claim to submit') };

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // Callers start at attempt 1, so only report retries (and never synchronously on start).
    if (attempt > 1) onAttempt?.(attempt);
    try {
      // Same key and same body on every attempt.
      const { claim } = await createClaim(token, intent.key, intent.body);
      trackClaim(claim);
      claimIntentStore.set(null);
      return { kind: 'created', claim };
    } catch (error) {
      if (!mayHaveSucceeded(error)) {
        claimIntentStore.set(null);
        return { kind: 'rejected', error };
      }
      lastError = error;
      if (attempt < MAX_ATTEMPTS) await sleep(retryDelayFor(error, attempt - 1));
    }
  }
  return { kind: 'unknown', error: lastError };
}
