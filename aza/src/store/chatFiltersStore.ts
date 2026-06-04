import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'aza_chat_filters_v1';

export type ChatFilter = {
  id: string;
  name: string;
  peerIds: string[];
};

type ChatFiltersState = {
  filters: ChatFilter[];
  loaded: boolean;
  load: () => Promise<void>;
  create: (name: string) => Promise<ChatFilter>;
  rename: (id: string, name: string) => Promise<void>;
  delete: (id: string) => Promise<void>;
  addPeer: (filterId: string, peerId: string) => Promise<void>;
  removePeer: (filterId: string, peerId: string) => Promise<void>;
};

async function persist(filters: ChatFilter[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(filters));
}

export const useChatFiltersStore = create<ChatFiltersState>((set, get) => ({
  filters: [],
  loaded: false,

  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      set({ filters: raw ? JSON.parse(raw) : [], loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  create: async (name) => {
    const filter: ChatFilter = {
      id: `cf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim(),
      peerIds: [],
    };
    const next = [...get().filters, filter];
    set({ filters: next });
    await persist(next);
    return filter;
  },

  rename: async (id, name) => {
    const next = get().filters.map((f) =>
      f.id === id ? { ...f, name: name.trim() } : f,
    );
    set({ filters: next });
    await persist(next);
  },

  delete: async (id) => {
    const next = get().filters.filter((f) => f.id !== id);
    set({ filters: next });
    await persist(next);
  },

  addPeer: async (filterId, peerId) => {
    const next = get().filters.map((f) =>
      f.id === filterId && !f.peerIds.includes(peerId)
        ? { ...f, peerIds: [...f.peerIds, peerId] }
        : f,
    );
    set({ filters: next });
    await persist(next);
  },

  removePeer: async (filterId, peerId) => {
    const next = get().filters.map((f) =>
      f.id === filterId
        ? { ...f, peerIds: f.peerIds.filter((id) => id !== peerId) }
        : f,
    );
    set({ filters: next });
    await persist(next);
  },
}));
