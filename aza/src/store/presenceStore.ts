import { create } from 'zustand';

type PresenceState = {
  onlineUserIds: Set<string>;
  lastSeenByUserId: Record<string, number>;
  setOnline: (userId: string) => void;
  setOffline: (userId: string) => void;
  isOnline: (userId: string) => boolean;
  setLastSeen: (userId: string, ts: number) => void;
  getLastSeen: (userId: string) => number | null;
};

export const usePresenceStore = create<PresenceState>((set, get) => ({
  onlineUserIds: new Set(),
  lastSeenByUserId: {},

  setOnline: (userId) =>
    set((s) => {
      if (s.onlineUserIds.has(userId)) return s;
      const next = new Set(s.onlineUserIds);
      next.add(userId);
      return { onlineUserIds: next };
    }),

  setOffline: (userId) =>
    set((s) => {
      if (!s.onlineUserIds.has(userId)) return s;
      const next = new Set(s.onlineUserIds);
      next.delete(userId);
      return {
        onlineUserIds: next,
        lastSeenByUserId: { ...s.lastSeenByUserId, [userId]: Date.now() },
      };
    }),

  isOnline: (userId) => get().onlineUserIds.has(userId),

  setLastSeen: (userId, ts) =>
    set((s) => ({ lastSeenByUserId: { ...s.lastSeenByUserId, [userId]: ts } })),

  getLastSeen: (userId) => get().lastSeenByUserId[userId] ?? null,
}));
