import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Message } from '../components/chat/chatTypes';

type PinnedState = {
  pinned: Record<string, Message>;
  pin: (chatId: string, message: Message) => void;
  unpin: (chatId: string) => void;
  getPinned: (chatId: string) => Message | null;
};

export const usePinnedMessageStore = create<PinnedState>()(
  persist(
    (set, get) => ({
      pinned: {},
      pin: (chatId, message) =>
        set((s) => ({ pinned: { ...s.pinned, [chatId]: message } })),
      unpin: (chatId) =>
        set((s) => {
          const next = { ...s.pinned };
          delete next[chatId];
          return { pinned: next };
        }),
      getPinned: (chatId) => get().pinned[chatId] ?? null,
    }),
    { name: 'aza_pinned_v1', storage: createJSONStorage(() => AsyncStorage) }
  )
);
