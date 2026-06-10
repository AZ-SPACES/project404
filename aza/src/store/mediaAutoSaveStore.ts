import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

type MediaAutoSaveState = {
  settings: Record<string, boolean>;
  isEnabled: (chatId: string) => boolean;
  setEnabled: (chatId: string, enabled: boolean) => void;
};

export const useMediaAutoSaveStore = create<MediaAutoSaveState>()(
  persist(
    (set, get) => ({
      settings: {},
      isEnabled: (chatId) => get().settings[chatId] ?? false,
      setEnabled: (chatId, enabled) =>
        set((s) => ({ settings: { ...s.settings, [chatId]: enabled } })),
    }),
    { name: 'aza_media_auto_save_v1', storage: createJSONStorage(() => AsyncStorage) }
  )
);
