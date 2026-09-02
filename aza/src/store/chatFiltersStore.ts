import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { accountPersistOptions, bindAccountStore } from './persistence';

const STORE_NAME = 'aza_chat_filters';

export type ChatFilter = {
  id: string;
  name: string;
  peerIds: string[];
};

type ChatFiltersState = {
  filters: ChatFilter[];
  create: (name: string) => ChatFilter;
  rename: (id: string, name: string) => void;
  delete: (id: string) => void;
  addPeer: (filterId: string, peerId: string) => void;
  removePeer: (filterId: string, peerId: string) => void;
};

export const useChatFiltersStore = create<ChatFiltersState>()(
  persist(
    (set, get) => ({
      filters: [],

      create: (name) => {
        const filter: ChatFilter = {
          id: `cf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name: name.trim(),
          peerIds: [],
        };
        set({ filters: [...get().filters, filter] });
        return filter;
      },

      rename: (id, name) =>
        set((s) => ({
          filters: s.filters.map((f) => (f.id === id ? { ...f, name: name.trim() } : f)),
        })),

      delete: (id) => set((s) => ({ filters: s.filters.filter((f) => f.id !== id) })),

      addPeer: (filterId, peerId) =>
        set((s) => ({
          filters: s.filters.map((f) =>
            f.id === filterId && !f.peerIds.includes(peerId)
              ? { ...f, peerIds: [...f.peerIds, peerId] }
              : f,
          ),
        })),

      removePeer: (filterId, peerId) =>
        set((s) => ({
          filters: s.filters.map((f) =>
            f.id === filterId
              ? { ...f, peerIds: f.peerIds.filter((id) => id !== peerId) }
              : f,
          ),
        })),
    }),
    accountPersistOptions<ChatFiltersState>({
      name: STORE_NAME,
      version: 1,
      partialize: (s) => ({ filters: s.filters }),
    }),
  ),
);

// Filters group peers by id, so they belong to the account that made them.
bindAccountStore(useChatFiltersStore, { name: STORE_NAME, empty: () => ({ filters: [] }) });
