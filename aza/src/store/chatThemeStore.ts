import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'aza_chat_themes_v1';

export const CHAT_THEME_COLORS: Record<string, string> = {
  default: '',
  blue: '#3B82F6',
  green: '#10B981',
  purple: '#8B5CF6',
  orange: '#F97316',
  pink: '#EC4899',
};

type ChatThemeState = {
  themes: Record<string, string>; // chatId → themeId
  loaded: boolean;
  load: () => Promise<void>;
  setTheme: (chatId: string, themeId: string) => Promise<void>;
  getBubbleColor: (chatId: string) => string;
};

async function save(themes: Record<string, string>) {
  await AsyncStorage.setItem(KEY, JSON.stringify(themes));
}

export const useChatThemeStore = create<ChatThemeState>((set, get) => ({
  themes: {},
  loaded: false,

  load: async () => {
    if (get().loaded) return;
    try {
      const raw = await AsyncStorage.getItem(KEY);
      set({ themes: raw ? JSON.parse(raw) : {}, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  setTheme: async (chatId, themeId) => {
    const next = { ...get().themes, [chatId]: themeId };
    set({ themes: next });
    await save(next);
  },

  getBubbleColor: (chatId) => {
    const themeId = get().themes[chatId] ?? 'default';
    return CHAT_THEME_COLORS[themeId] ?? '';
  },
}));
