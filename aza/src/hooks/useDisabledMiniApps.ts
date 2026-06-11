import { useQuery } from '@tanstack/react-query';
import { getDisabledMiniApps } from '../services/api';
import { queryKeys } from '../lib/queryKeys';

/**
 * Mini app IDs disabled platform-wide by an admin (kill switch).
 * Fails open: if the lookup errors, no apps are hidden.
 */
export function useDisabledMiniApps(): string[] {
  const { data } = useQuery({
    queryKey: queryKeys.disabledMiniApps(),
    queryFn: () => getDisabledMiniApps().then(r => (r.data?.data ?? []) as string[]),
    staleTime: 60_000,
  });
  return data ?? [];
}
