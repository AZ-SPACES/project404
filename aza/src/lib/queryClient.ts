import { QueryClient } from '@tanstack/react-query';

/**
 * Retry predicate for queries. Retries up to 2× on transient failures
 * (5xx, network-level errors with no response) but never on client errors
 * (4xx) which won't resolve on their own and should surface immediately.
 * Exported for unit testing.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  const status = (error as any)?.response?.status;
  if (status !== undefined && status >= 400 && status < 500) return false;
  return true;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60 * 1000,
      retry: shouldRetry,
      retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 10_000),
      refetchOnWindowFocus: false,
    },
    mutations: {
      // Mutations are not idempotent in general — never auto-retry.
      retry: false,
    },
  },
});
