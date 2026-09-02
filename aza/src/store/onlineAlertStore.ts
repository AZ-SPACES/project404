import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { accountPersistOptions, bindAccountStore } from './persistence';

const STORE_NAME = 'aza_online_alerts';

type OnlineAlertState = {
  alerts: Record<string, boolean>;
  isEnabled: (userId: string) => boolean;
  setEnabled: (userId: string, enabled: boolean) => void;
};

export const useOnlineAlertStore = create<OnlineAlertState>()(
  persist(
    (set, get) => ({
      alerts: {},
      isEnabled: (userId) => get().alerts[userId] ?? false,
      setEnabled: (userId, enabled) =>
        set((s) => ({ alerts: { ...s.alerts, [userId]: enabled } })),
    }),
    accountPersistOptions<OnlineAlertState>({
      name: STORE_NAME,
      version: 1,
      partialize: (s) => ({ alerts: s.alerts }),
    }),
  ),
);

// "Alert me when this person comes online" is a watch list the signed-in user
// built, and telling the next account who was on it would leak it.
bindAccountStore(useOnlineAlertStore, { name: STORE_NAME, empty: () => ({ alerts: {} }) });
