import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { accountPersistOptions, bindAccountStore } from './persistence';

const STORE_NAME = 'aza_pinned_chats';
const MAX_PINS = 5;

type PinnedState = {
  pinnedIds: string[];
  pin: (peerId: string) => void;
  unpin: (peerId: string) => void;
  isPinned: (peerId: string) => boolean;
};

export const usePinnedStore = create<PinnedState>()(
  persist(
    (set, get) => ({
      pinnedIds: [],

      pin: (peerId) => {
        const { pinnedIds } = get();
        if (pinnedIds.includes(peerId) || pinnedIds.length >= MAX_PINS) return;
        set({ pinnedIds: [peerId, ...pinnedIds] });
      },

      unpin: (peerId) =>
        set((s) => ({ pinnedIds: s.pinnedIds.filter((id) => id !== peerId) })),

      isPinned: (peerId) => get().pinnedIds.includes(peerId),
    }),
    accountPersistOptions<PinnedState>({
      name: STORE_NAME,
      version: 1,
      partialize: (s) => ({ pinnedIds: s.pinnedIds }),
    }),
  ),
);

// Pinned peers belong to the account that pinned them.
bindAccountStore(usePinnedStore, { name: STORE_NAME, empty: () => ({ pinnedIds: [] }) });
