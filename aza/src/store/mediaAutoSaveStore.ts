import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { devicePersistOptions } from './persistence';

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
    // Device-scoped: whether media lands in this phone's gallery is a property
    // of the phone, not of whoever is signed in. Key name kept so the setting
    // survives the upgrade.
    devicePersistOptions<MediaAutoSaveState>({
      name: 'aza_media_auto_save_v1',
      version: 1,
      partialize: (s) => ({ settings: s.settings }),
    }),
  ),
);
