import type { AssetBalance, Balances } from '@/api/balances';
import type { ClaimStatus } from '@/api/claims';
import { toMinorUnits } from '@/lib/amount';

/** A claim created from this browser, remembered until the snapshot has caught up with it. */
export type TrackedClaim = {
  id: string;
  asset: string;
  amount: string;
  /** For display only; null for entries saved before this field existed. */
  receiveAmount: string | null;
  createdAt: string;
  status: ClaimStatus;
  failureReason: string | null;
  /** Local time we saw the claim settle; settled claims stay visible for a short while. */
  settledAt: string | null;
};

const MAX_TRACK_AGE_MS = 24 * 60 * 60 * 1000;
// Long enough for the user to notice "failed, amount returned" on Home.
const SHOW_SETTLED_FOR_MS = 2 * 60 * 1000;

/** The snapshot was computed before the claim existed, so it does not reflect it yet. */
export function isMissingFromSnapshot(claim: TrackedClaim, asOf: string): boolean {
  return Date.parse(claim.createdAt) > Date.parse(asOf);
}

export type AdjustedBalances = Balances & {
  /** Assets whose numbers include a local correction for claims not yet in the snapshot. */
  adjustedAssets: string[];
};

/**
 * Balance-after-claim decision: show the server snapshot, corrected only for claims the
 * snapshot cannot know about yet. Both times come from the server, so device clock skew
 * does not matter. Once a snapshot with asOf >= createdAt arrives the correction stops and
 * the server numbers already match, so nothing jumps.
 *
 * - pending:   available -= amount, claiming += amount (what the server does at once)
 * - completed: available -= amount (money has left)
 * - failed:    no correction (the amount went back to available, as in the old snapshot)
 */
export function applyUnsnapshottedClaims(balances: Balances, claims: TrackedClaim[]): AdjustedBalances {
  const adjustedAssets = new Set<string>();
  const items = balances.items.map((item): AssetBalance => {
    let { available, claiming } = item;
    for (const claim of claims) {
      if (claim.asset !== item.asset || claim.status === 'failed') continue;
      if (!isMissingFromSnapshot(claim, balances.asOf)) continue;
      const amount = toMinorUnits(claim.amount, item.decimals);
      available -= amount;
      if (claim.status === 'pending') claiming += amount;
      adjustedAssets.add(item.asset);
    }
    // Never show a negative balance, even if the server and our records briefly disagree.
    return { ...item, available: available < 0n ? 0n : available, claiming };
  });
  return { asOf: balances.asOf, items, adjustedAssets: [...adjustedAssets] };
}

/** Keep claims that still matter: not settled, not yet in the snapshot, or settled just now. */
export function pruneTrackedClaims(claims: TrackedClaim[], asOf: string, now: number): TrackedClaim[] {
  return claims.filter(
    (claim) =>
      now - Date.parse(claim.createdAt) < MAX_TRACK_AGE_MS &&
      (claim.status === 'pending' ||
        isMissingFromSnapshot(claim, asOf) ||
        (claim.settledAt !== null && now - Date.parse(claim.settledAt) < SHOW_SETTLED_FOR_MS)),
  );
}
