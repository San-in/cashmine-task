import { queryOptions, useQueries, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import { fetchClaim } from '@/api/claims';
import { balancesQueryKey, useBalances } from '@/features/balances/use-balances';
import { useToken } from '@/features/token/token-context';

import { applyUnsnapshottedClaims, pruneTrackedClaims } from './claim-adjustments';
import { trackedClaimsStore, updateTrackedClaim } from './claims-store';

// A pending claim settles within about 20 seconds.
const CLAIM_POLL_MS = 2_000;

export function claimQueryOptions(token: string, id: string) {
  return queryOptions({
    queryKey: ['claim', id],
    queryFn: ({ signal }) => fetchClaim(token, id, signal),
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? CLAIM_POLL_MS : false),
  });
}

/** Server balances corrected for this browser's claims that the snapshot has not seen yet. */
export function useAdjustedBalances() {
  const query = useBalances();
  const tracked = trackedClaimsStore.useValue();
  const balances = useMemo(
    () => (query.data ? applyUnsnapshottedClaims(query.data, tracked) : undefined),
    [query.data, tracked],
  );

  useEffect(() => {
    if (!query.data) return;
    const asOf = query.data.asOf;
    trackedClaimsStore.set((prev) => {
      const next = pruneTrackedClaims(prev, asOf, Date.now());
      return next.length === prev.length ? prev : next;
    });
  }, [query.data]);

  return { query, balances, tracked };
}

/** Polls every tracked pending claim until it settles, then refreshes balances. */
export function useTrackedClaimsPolling() {
  const token = useToken();
  const queryClient = useQueryClient();
  const tracked = trackedClaimsStore.useValue();
  const pendingIds = tracked.filter((c) => c.status === 'pending').map((c) => c.id);
  const results = useQueries({ queries: pendingIds.map((id) => claimQueryOptions(token, id)) });

  const settledKey = results.map((r) => `${r.data?.id}:${r.data?.status}`).join(',');
  useEffect(() => {
    let changed = false;
    for (const result of results) {
      if (result.data) changed = updateTrackedClaim(result.data) || changed;
    }
    if (changed) void queryClient.invalidateQueries({ queryKey: balancesQueryKey });
    // results is a new array every render; settledKey captures what matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settledKey, queryClient]);
}
