import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

type MuteDurationState = {
  mutedUntil: Record<string, number>;
  setMutedUntil: (chatId: string, ts: number) => void;
  clearMutedUntil: (chatId: string) => void;
  getMutedUntil: (chatId: string) => number | null;
  isEffectiveMuted: (chatId: string, baseMuted: boolean) => boolean;
};

export const useMuteDurationStore = create<MuteDurationState>()(
  persist(
    (set, get) => ({
      mutedUntil: {},

      setMutedUntil: (chatId, ts) =>
        set((s) => ({ mutedUntil: { ...s.mutedUntil, [chatId]: ts } })),

      clearMutedUntil: (chatId) =>
        set((s) => {
          const next = { ...s.mutedUntil };
          delete next[chatId];
          return { mutedUntil: next };
        }),

      getMutedUntil: (chatId) => get().mutedUntil[chatId] ?? null,

      isEffectiveMuted: (chatId, baseMuted) => {
        const until = get().mutedUntil[chatId];
        if (until && until <= Date.now()) return false;
        return baseMuted || !!until;
      },
    }),
    { name: 'aza_mute_duration_v1', storage: createJSONStorage(() => AsyncStorage) }
  )
);
