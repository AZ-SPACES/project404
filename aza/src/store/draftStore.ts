import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { accountPersistOptions, bindAccountStore } from './persistence';

const STORE_NAME = 'aza_drafts';

type DraftState = {
  drafts: Record<string, string>;
  setDraft: (chatId: string, text: string) => void;
  clearDraft: (chatId: string) => void;
  getDraft: (chatId: string) => string;
};

export const useDraftStore = create<DraftState>()(
  persist(
    (set, get) => ({
      drafts: {},

      setDraft: (chatId, text) =>
        set((s) => {
          if (!text) {
            const next = { ...s.drafts };
            delete next[chatId];
            return { drafts: next };
          }
          return { drafts: { ...s.drafts, [chatId]: text } };
        }),

      clearDraft: (chatId) =>
        set((s) => {
          const next = { ...s.drafts };
          delete next[chatId];
          return { drafts: next };
        }),

      getDraft: (chatId) => get().drafts[chatId] ?? '',
    }),
    accountPersistOptions<DraftState>({
      name: STORE_NAME,
      version: 1,
      partialize: (s) => ({ drafts: s.drafts }),
    }),
  ),
);

// Drafts are unsent message text. Account-scoped so they are erased on logout
// rather than shown to the next person to sign in on this device.
bindAccountStore(useDraftStore, { name: STORE_NAME, empty: () => ({ drafts: {} }) });
