import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
    { name: 'aza_drafts_v1', storage: createJSONStorage(() => AsyncStorage) }
  )
);
