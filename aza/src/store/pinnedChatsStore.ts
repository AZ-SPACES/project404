import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'aza_pinned_chats_v1';
const MAX_PINS = 5;

type PinnedState = {
  pinnedIds: string[];
  loaded: boolean;
  load: () => Promise<void>;
  pin: (peerId: string) => Promise<void>;
  unpin: (peerId: string) => Promise<void>;
  isPinned: (peerId: string) => boolean;
};

export const usePinnedStore = create<PinnedState>((set, get) => ({
  pinnedIds: [],
  loaded: false,

  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      set({ pinnedIds: raw ? JSON.parse(raw) : [], loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  pin: async (peerId) => {
    const { pinnedIds } = get();
    if (pinnedIds.includes(peerId) || pinnedIds.length >= MAX_PINS) return;
    const next = [peerId, ...pinnedIds];
    set({ pinnedIds: next });
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  },

  unpin: async (peerId) => {
    const next = get().pinnedIds.filter((id) => id !== peerId);
    set({ pinnedIds: next });
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  },

  isPinned: (peerId) => get().pinnedIds.includes(peerId),
}));
