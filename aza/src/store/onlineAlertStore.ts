import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
    { name: 'aza_online_alerts_v1', storage: createJSONStorage(() => AsyncStorage) }
  )
);
