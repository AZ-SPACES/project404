import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type EmojiReaction = { emoji: string; count: number; byMe: boolean };

type ReactionState = {
  reactions: Record<string, EmojiReaction[]>;
  addReaction: (messageId: string, emoji: string) => void;
  removeReaction: (messageId: string, emoji: string) => void;
};

const EMPTY: EmojiReaction[] = [];

export const useReactionStore = create<ReactionState>()(
  persist(
    (set) => ({
      reactions: {},
      addReaction: (messageId, emoji) => {
        set((state) => {
          const existing = state.reactions[messageId] ?? EMPTY;
          const idx = existing.findIndex((r) => r.emoji === emoji);
          let updated: EmojiReaction[];
          if (idx >= 0) {
            const r = existing[idx]!;
            if (r.byMe) return state;
            updated = existing.map((item, i) =>
              i === idx ? { ...item, count: item.count + 1, byMe: true } : item
            );
          } else {
            updated = [...existing, { emoji, count: 1, byMe: true }];
          }
          return { reactions: { ...state.reactions, [messageId]: updated } };
        });
      },
      removeReaction: (messageId, emoji) => {
        set((state) => {
          const existing = state.reactions[messageId] ?? EMPTY;
          const idx = existing.findIndex((r) => r.emoji === emoji);
          if (idx < 0) return state;
          const r = existing[idx]!;
          if (!r.byMe) return state;
          let updated: EmojiReaction[];
          if (r.count <= 1) {
            updated = existing.filter((_, i) => i !== idx);
          } else {
            updated = existing.map((item, i) =>
              i === idx ? { ...item, count: item.count - 1, byMe: false } : item
            );
          }
          return { reactions: { ...state.reactions, [messageId]: updated } };
        });
      },
    }),
    { name: 'aza_reactions_v1', storage: createJSONStorage(() => AsyncStorage) }
  )
);
