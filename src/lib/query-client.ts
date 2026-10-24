import { QueryClient } from '@tanstack/react-query';

import { isRetryable, retryDelayFor } from '@/api/client';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Retry only transient failures (429, 5xx, timeouts, network), honouring Retry-After.
        retry: (failureCount, error) => failureCount < 3 && isRetryable(error),
        retryDelay: (attempt, error) => retryDelayFor(error, attempt),
      },
      mutations: {
        // Claims manage their own retries with a fixed Idempotency-Key.
        retry: false,
      },
    },
  });
}
