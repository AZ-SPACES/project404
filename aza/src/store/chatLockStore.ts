import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { accountPersistOptions, bindAccountStore } from './persistence';

const STORE_NAME = 'aza_chat_locks';

interface ChatLockState {
  lockedChatIds: string[];
  lock: (chatId: string) => void;
  unlock: (chatId: string) => void;
  isLocked: (chatId: string) => boolean;
}

export const useChatLockStore = create<ChatLockState>()(
  persist(
    (set, get) => ({
      lockedChatIds: [],

      lock: (chatId) =>
        set((s) => ({ lockedChatIds: [...new Set([...s.lockedChatIds, chatId])] })),

      unlock: (chatId) =>
        set((s) => ({ lockedChatIds: s.lockedChatIds.filter((id) => id !== chatId) })),

      isLocked: (chatId) => get().lockedChatIds.includes(chatId),
    }),
    accountPersistOptions<ChatLockState>({
      name: STORE_NAME,
      version: 1,
      partialize: (s) => ({ lockedChatIds: s.lockedChatIds }),
    }),
  ),
);

// Which chats are locked is a per-account privacy setting — carrying it across
// a logout would either expose or hide the wrong person's chats.
bindAccountStore(useChatLockStore, { name: STORE_NAME, empty: () => ({ lockedChatIds: [] }) });
