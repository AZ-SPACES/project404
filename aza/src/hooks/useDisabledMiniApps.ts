import { useQuery } from '@tanstack/react-query';
import { getMiniAppStatuses } from '../services/api';
import { queryKeys } from '../lib/queryKeys';

export interface MiniAppStatus {
  appId: string;
  status: 'DISABLED' | 'MAINTENANCE';
  message: string | null;
}

export interface MiniAppStatusMap {
  disabled: Set<string>;
  maintenance: Map<string, string | null>;
}

/**
 * Platform status for every mini app that isn't fully active.
 * Fails open — if the lookup errors, no apps are affected.
 */
export function useDisabledMiniApps(): MiniAppStatusMap {
  const { data } = useQuery({
    queryKey: queryKeys.disabledMiniApps(),
    queryFn: () => getMiniAppStatuses().then(r => (r.data?.data ?? []) as MiniAppStatus[]),
    staleTime: 0,
  });

  const statuses = data ?? [];
  const disabled = new Set(statuses.filter(s => s.status === 'DISABLED').map(s => s.appId));
  const maintenance = new Map(
    statuses.filter(s => s.status === 'MAINTENANCE').map(s => [s.appId, s.message]),
  );
  return { disabled, maintenance };
}
