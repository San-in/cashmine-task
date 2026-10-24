import type { Claim, ClaimStatus, CreateClaimBody } from '@/api/claims';
import { createPersistentStore } from '@/lib/persistent-store';

import type { TrackedClaim } from './claim-adjustments';

/** Claims created from this browser; drives the balance correction and "recent claims". */
export const trackedClaimsStore = createPersistentStore<TrackedClaim[]>('cashmine.trackedClaims', []);

/**
 * A confirmed claim whose result we do not know yet. The key and body are fixed at
 * confirmation and reused for every retry, so a retry can never create a second claim.
 * Persisted so a reload resumes it instead of letting the user claim again.
 */
export type ClaimIntent = { key: string; body: CreateClaimBody; confirmedAt: string };

export const claimIntentStore = createPersistentStore<ClaimIntent | null>('cashmine.claimIntent', null);

export function trackClaim(claim: Claim): void {
  const settled = claim.status !== 'pending';
  trackedClaimsStore.set((prev) => [
    ...prev.filter((c) => c.id !== claim.id),
    {
      id: claim.id,
      asset: claim.asset,
      amount: claim.amount,
      createdAt: claim.createdAt,
      status: claim.status,
      failureReason: claim.failureReason,
      settledAt: settled ? new Date().toISOString() : null,
    },
  ]);
}

/** Returns true if the status changed. */
export function updateTrackedClaim(claim: Claim): boolean {
  const current = trackedClaimsStore.get().find((c) => c.id === claim.id);
  if (!current || current.status === claim.status) return false;
  trackedClaimsStore.set((prev) =>
    prev.map((c) =>
      c.id === claim.id
        ? {
            ...c,
            status: claim.status as ClaimStatus,
            failureReason: claim.failureReason,
            settledAt: claim.status === 'pending' ? null : new Date().toISOString(),
          }
        : c,
    ),
  );
  return true;
}

/** Claims belong to a token: forget them when the token changes. */
export function resetClaimStores(): void {
  trackedClaimsStore.set([]);
  claimIntentStore.set(null);
}

export function newIdempotencyKey(): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID();
  const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
