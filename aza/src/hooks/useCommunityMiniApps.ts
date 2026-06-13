import { useState, useEffect, useCallback } from 'react';
import { getCommunityMiniApps } from '../services/api';
import { MiniAppEntry } from '../features/hub/miniapps/types';

interface RegistryEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  iconUrl: string;
  url: string;
  developerName: string;
  version: string;
  requestedPermissions: string[];
}

export function useCommunityMiniApps() {
  const [apps, setApps] = useState<MiniAppEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      const res = await getCommunityMiniApps();
      const entries: MiniAppEntry[] = (res.data?.data ?? []).map((r: RegistryEntry) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        icon: r.iconUrl || '📦',
        category: r.category as any,
        url: r.url,
        developerName: r.developerName,
        requestedPermissions: r.requestedPermissions,
      }));
      setApps(entries);
    } catch {
      // Community apps are additive — silently degrade if unavailable
      setApps([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { communityApps: apps, communityLoading: loading, refetchCommunity: fetch };
}
