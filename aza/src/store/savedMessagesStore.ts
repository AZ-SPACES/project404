import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Message } from '../components/chat/chatTypes';
import { accountPersistOptions, bindAccountStore } from './persistence';

const STORE_NAME = 'aza_saved_messages';

type SavedMessagesState = {
  messages: Message[];
  addMessage: (msg: Message) => void;
  deleteMessage: (id: string) => void;
  clearAll: () => void;
};

export const useSavedMessagesStore = create<SavedMessagesState>()(
  persist(
    (set) => ({
      messages: [],
      addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
      deleteMessage: (id) => set((s) => ({ messages: s.messages.filter((m) => m.id !== id) })),
      clearAll: () => set({ messages: [] }),
    }),
    accountPersistOptions<SavedMessagesState>({
      name: STORE_NAME,
      version: 1,
      partialize: (s) => ({ messages: s.messages }),
    }),
  ),
);

// Whole message objects, in plaintext. Account-scoped so they go with the
// encrypted thread caches on logout instead of outliving them.
bindAccountStore(useSavedMessagesStore, { name: STORE_NAME, empty: () => ({ messages: [] }) });
