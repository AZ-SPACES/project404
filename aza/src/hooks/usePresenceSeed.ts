import { useEffect, useMemo } from 'react';
import { getPresenceBatch } from '../services/api';
import { usePresenceStore } from '../store/presenceStore';

// Server caps batch lookups at 100 ids; seed the first page of a list.
const MAX_BATCH = 100;

/**
 * Seed the presence store for a list of user ids in one round trip.
 * Live WS events only cover transitions that happen while we're connected,
 * so without this, online dots on contact lists start out blank.
 */
export function usePresenceSeed(userIds: (string | null | undefined)[]) {
  const key = useMemo(() => {
    const ids = Array.from(new Set(userIds.filter((id): id is string => !!id))).sort();
    return ids.slice(0, MAX_BATCH).join(',');
  }, [userIds]);

  useEffect(() => {
    if (!key) return;
    const ids = key.split(',');
    let cancelled = false;
    getPresenceBatch(ids)
      .then((res) => {
        if (cancelled) return;
        const map: Record<string, { status?: string; lastSeenAt?: string | null }> =
          res.data?.data ?? {};
        const sync = usePresenceStore.getState().syncFromServer;
        for (const [userId, presence] of Object.entries(map)) {
          const ts = presence?.lastSeenAt ? new Date(presence.lastSeenAt).getTime() : null;
          sync(userId, presence?.status, ts);
        }
      })
      .catch(() => {
        // Presence seeding is best-effort; dots fill in from live events.
      });
    return () => {
      cancelled = true;
    };
  }, [key]);
}
