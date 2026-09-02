import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Message } from '../components/chat/chatTypes';
import { accountPersistOptions, bindAccountStore } from './persistence';

const STORE_NAME = 'aza_starred_messages';

export type StarredEntry = {
  messageId: string;
  chatId: string;
  chatName: string;
  message: Message;
  starredAt: number;
};

type StarredState = {
  entries: StarredEntry[];
  star: (message: Message, chatId: string, chatName: string) => void;
  unstar: (messageId: string) => void;
  isStarred: (messageId: string) => boolean;
  countForChat: (chatId: string) => number;
};

export const useStarredMessagesStore = create<StarredState>()(
  persist(
    (set, get) => ({
      entries: [],

      star: (message, chatId, chatName) => {
        const { entries } = get();
        if (entries.some((e) => e.messageId === message.id)) return;
        const entry: StarredEntry = {
          messageId: message.id,
          chatId,
          chatName,
          message,
          starredAt: Date.now(),
        };
        set({ entries: [entry, ...entries] });
      },

      unstar: (messageId) =>
        set((s) => ({ entries: s.entries.filter((e) => e.messageId !== messageId) })),

      isStarred: (messageId) => get().entries.some((e) => e.messageId === messageId),

      countForChat: (chatId) => get().entries.filter((e) => e.chatId === chatId).length,
    }),
    accountPersistOptions<StarredState>({
      name: STORE_NAME,
      version: 1,
      partialize: (s) => ({ entries: s.entries }),
    }),
  ),
);

// Whole message objects plus the chat name they came from. Account-scoped, and
// hydrated by the session rather than by a `load()` each screen had to remember
// to call before reading.
bindAccountStore(useStarredMessagesStore, { name: STORE_NAME, empty: () => ({ entries: [] }) });
