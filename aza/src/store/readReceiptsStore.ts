import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { accountPersistOptions, bindAccountStore } from './persistence';

const STORE_NAME = 'aza_read_receipts';

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
    accountPersistOptions<ReadReceiptsState>({
      name: STORE_NAME,
      version: 1,
      partialize: (s) => ({ enabled: s.enabled }),
    }),
  ),
);

// A per-chat privacy setting, so it follows the account rather than the phone.
bindAccountStore(useReadReceiptsStore, { name: STORE_NAME, empty: () => ({ enabled: {} }) });
