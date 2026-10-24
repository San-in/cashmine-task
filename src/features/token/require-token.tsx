import type { ReactNode } from 'react';

import { LoadingState, Screen } from '@/components/ui';
import { useTokenContext } from '@/features/token/token-context';
import { TokenForm } from '@/features/token/token-form';

/** Renders children only when a token exists; otherwise asks for one in place. */
export function RequireToken({ children }: { children: ReactNode }) {
  const { state } = useTokenContext();
  if (state.status === 'loading') {
    return (
      <Screen>
        <LoadingState message="Loading…" />
      </Screen>
    );
  }
  if (!state.token) {
    return (
      <Screen>
        <TokenForm />
      </Screen>
    );
  }
  return children;
}
