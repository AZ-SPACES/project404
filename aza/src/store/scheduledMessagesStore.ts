import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { accountPersistOptions, bindAccountStore } from './persistence';

const STORE_NAME = 'aza_scheduled_messages';

export interface ScheduledMessage {
  id: string;
  chatId: string;
  text: string;
  scheduledAt: number;
}

interface ScheduledMessagesState {
  messages: ScheduledMessage[];
  schedule: (msg: ScheduledMessage) => void;
  remove: (id: string) => void;
  getDue: (chatId: string) => ScheduledMessage[];
}

export const useScheduledMessagesStore = create<ScheduledMessagesState>()(
  persist(
    (set, get) => ({
      messages: [],

      schedule: (msg) => set((s) => ({ messages: [...s.messages, msg] })),

      remove: (id) => set((s) => ({ messages: s.messages.filter((m) => m.id !== id) })),

      getDue: (chatId) => {
        const now = Date.now();
        return get().messages.filter((m) => m.chatId === chatId && m.scheduledAt <= now);
      },
    }),
    accountPersistOptions<ScheduledMessagesState>({
      name: STORE_NAME,
      version: 1,
      partialize: (s) => ({ messages: s.messages }),
    }),
  ),
);

// Scheduled messages hold unsent message text, like drafts — account-scoped so
// a logout doesn't leave them queued to send from someone else's session.
bindAccountStore(useScheduledMessagesStore, { name: STORE_NAME, empty: () => ({ messages: [] }) });
