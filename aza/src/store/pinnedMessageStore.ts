import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Message } from '../components/chat/chatTypes';
import { accountPersistOptions, bindAccountStore } from './persistence';

const STORE_NAME = 'aza_pinned_messages';
const MAX_PINS = 3;

type PinnedState = {
  pinned: Record<string, Message[]>;
  pin: (chatId: string, message: Message) => void;
  unpin: (chatId: string, messageId: string) => void;
  unpinAll: (chatId: string) => void;
  getPinned: (chatId: string) => Message[];
  isPinned: (chatId: string, messageId: string) => boolean;
};

export const usePinnedMessageStore = create<PinnedState>()(
  persist(
    (set, get) => ({
      pinned: {},

      pin: (chatId, message) =>
        set((s) => {
          const current = s.pinned[chatId] ?? [];
          // Remove if already pinned, then prepend (most recent pin first)
          const filtered = current.filter((m) => m.id !== message.id);
          const next = [message, ...filtered].slice(0, MAX_PINS);
          return { pinned: { ...s.pinned, [chatId]: next } };
        }),

      unpin: (chatId, messageId) =>
        set((s) => {
          const current = s.pinned[chatId] ?? [];
          const next = current.filter((m) => m.id !== messageId);
          const updated = { ...s.pinned };
          if (next.length === 0) delete updated[chatId];
          else updated[chatId] = next;
          return { pinned: updated };
        }),

      unpinAll: (chatId) =>
        set((s) => {
          const updated = { ...s.pinned };
          delete updated[chatId];
          return { pinned: updated };
        }),

      getPinned: (chatId) => get().pinned[chatId] ?? [],

      isPinned: (chatId, messageId) =>
        (get().pinned[chatId] ?? []).some((m) => m.id === messageId),
    }),
    accountPersistOptions<PinnedState>({
      name: STORE_NAME,
      version: 1,
      partialize: (s) => ({ pinned: s.pinned }),
    }),
  ),
);

// Whole message objects, in plaintext. Account-scoped for the same reason as
// savedMessagesStore.
bindAccountStore(usePinnedMessageStore, { name: STORE_NAME, empty: () => ({ pinned: {} }) });
