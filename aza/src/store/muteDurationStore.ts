import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { accountPersistOptions, bindAccountStore } from './persistence';

const STORE_NAME = 'aza_mute_duration';

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
    accountPersistOptions<MuteDurationState>({
      name: STORE_NAME,
      version: 1,
      partialize: (s) => ({ mutedUntil: s.mutedUntil }),
    }),
  ),
);

// Keyed by chat id, which is meaningless to the next account on this device.
bindAccountStore(useMuteDurationStore, { name: STORE_NAME, empty: () => ({ mutedUntil: {} }) });
