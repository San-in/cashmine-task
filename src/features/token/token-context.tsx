import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { readItem, removeItem, writeItem } from '@/lib/storage';

const TOKEN_KEY = 'cashmine.token';

type TokenState =
  | { status: 'loading' }
  | { status: 'ready'; token: string | null; persisted: boolean };

type TokenContextValue = {
  state: TokenState;
  saveToken: (token: string) => void;
  clearToken: () => void;
};

const TokenContext = createContext<TokenContextValue | null>(null);

export function TokenProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<TokenState>({ status: 'loading' });

  // Read on the client only: there is no localStorage during static rendering.
  useEffect(() => {
    setState({ status: 'ready', token: readItem(TOKEN_KEY), persisted: true });
  }, []);

  const saveToken = useCallback(
    (token: string) => {
      const persisted = writeItem(TOKEN_KEY, token);
      // Data belongs to a token: never show one token's balances under another.
      queryClient.clear();
      setState({ status: 'ready', token, persisted });
    },
    [queryClient],
  );

  const clearToken = useCallback(() => {
    removeItem(TOKEN_KEY);
    queryClient.clear();
    setState({ status: 'ready', token: null, persisted: true });
  }, [queryClient]);

  const value = useMemo(() => ({ state, saveToken, clearToken }), [state, saveToken, clearToken]);
  return <TokenContext.Provider value={value}>{children}</TokenContext.Provider>;
}

export function useTokenContext(): TokenContextValue {
  const ctx = useContext(TokenContext);
  if (!ctx) throw new Error('useTokenContext must be used inside TokenProvider');
  return ctx;
}

/** For screens rendered behind the token gate, where a token always exists. */
export function useToken(): string {
  const { state } = useTokenContext();
  if (state.status !== 'ready' || !state.token) {
    throw new Error('useToken called without a token');
  }
  return state.token;
}

export function maskToken(token: string): string {
  return token.length <= 4 ? '••••' : `••••${token.slice(-4)}`;
}
