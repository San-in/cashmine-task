import { useQuery } from '@tanstack/react-query';

import { fetchBalances } from '@/api/balances';
import { nextRefetchDelay } from '@/features/balances/snapshot-timing';
import { useToken } from '@/features/token/token-context';

export const balancesQueryKey = ['balances'] as const;

export function useBalances() {
  const token = useToken();
  return useQuery({
    queryKey: balancesQueryKey,
    queryFn: ({ signal }) => fetchBalances(token, signal),
    // Re-evaluated after every fetch, so polling stays in step with the server snapshots.
    refetchInterval: (query) => nextRefetchDelay(query.state.data?.asOf, Date.now()),
  });
}
