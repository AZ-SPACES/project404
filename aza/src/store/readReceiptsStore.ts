import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ReadReceiptsState = {
  enabled: Record<string, boolean>;
  isEnabled: (chatId: string) => boolean;
  setEnabled: (chatId: string, val: boolean) => void;
};

export const useReadReceiptsStore = create<ReadReceiptsState>()(
  persist(
    (set, get) => ({
      enabled: {},
      isEnabled: (chatId) => get().enabled[chatId] ?? true,
      setEnabled: (chatId, val) =>
        set((s) => ({ enabled: { ...s.enabled, [chatId]: val } })),
    }),
    { name: 'aza_read_receipts_v1', storage: createJSONStorage(() => AsyncStorage) }
  )
);
