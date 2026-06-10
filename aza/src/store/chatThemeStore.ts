import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'aza_chat_themes_v2';

export type ChatWallpaper = {
  type: 'none' | 'solid' | 'image';
  value: string; // '' for none, hex for solid, uri for image
};

export type ChatFontSize = 'small' | 'medium' | 'large';

export type ChatWallpaperPattern = 'dots' | 'grid' | 'diagonal' | 'waves';

export type ChatThemeConfig = {
  bubbleColor: string; // '' = default (app primary), or hex
  wallpaper: ChatWallpaper;
  fontSize?: ChatFontSize;
  pattern?: ChatWallpaperPattern;
};

const DEFAULT_WALLPAPER: ChatWallpaper = { type: 'none', value: '' };
const DEFAULT_CONFIG: ChatThemeConfig = { bubbleColor: '', wallpaper: DEFAULT_WALLPAPER };

// V1 theme-id → hex migration map
const V1_COLOR_MAP: Record<string, string> = {
  default: '', blue: '#3B82F6', green: '#10B981',
  purple: '#8B5CF6', orange: '#F97316', pink: '#EC4899',
};

type ChatThemeState = {
  themes: Record<string, ChatThemeConfig>;
  loaded: boolean;
  load: () => Promise<void>;
  setBubbleColor: (chatId: string, color: string) => Promise<void>;
  setWallpaper: (chatId: string, wallpaper: ChatWallpaper) => Promise<void>;
  setFontSize: (chatId: string, size: ChatFontSize) => Promise<void>;
  setPattern: (chatId: string, pattern: ChatWallpaperPattern | null) => Promise<void>;
  getBubbleColor: (chatId: string) => string;
  getWallpaper: (chatId: string) => ChatWallpaper;
  getFontSize: (chatId: string) => ChatFontSize;
  getPattern: (chatId: string) => ChatWallpaperPattern | null;
  resetTheme: (chatId: string) => Promise<void>;
};

async function persist(themes: Record<string, ChatThemeConfig>) {
  await AsyncStorage.setItem(KEY, JSON.stringify(themes));
}

function get(themes: Record<string, ChatThemeConfig>, chatId: string): ChatThemeConfig {
  return themes[chatId] ?? DEFAULT_CONFIG;
}

export const useChatThemeStore = create<ChatThemeState>((set, getState) => ({
  themes: {},
  loaded: false,

  load: async () => {
    if (getState().loaded) return;
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Migrate v1: Record<chatId, themeId string>
        const firstVal = Object.values(parsed as object)[0];
        if (typeof firstVal === 'string') {
          const migrated: Record<string, ChatThemeConfig> = {};
          for (const [id, themeId] of Object.entries(parsed as Record<string, string>)) {
            migrated[id] = { bubbleColor: V1_COLOR_MAP[themeId] ?? '', wallpaper: DEFAULT_WALLPAPER };
          }
          set({ themes: migrated, loaded: true });
          await persist(migrated);
          return;
        }
        set({ themes: parsed, loaded: true });
      } else {
        set({ loaded: true });
      }
    } catch {
      set({ loaded: true });
    }
  },

  setBubbleColor: async (chatId, color) => {
    const current = get(getState().themes, chatId);
    const next = { ...getState().themes, [chatId]: { ...current, bubbleColor: color } };
    set({ themes: next });
    await persist(next);
  },

  setWallpaper: async (chatId, wallpaper) => {
    const current = get(getState().themes, chatId);
    const next = { ...getState().themes, [chatId]: { ...current, wallpaper } };
    set({ themes: next });
    await persist(next);
  },

  setFontSize: async (chatId, fontSize) => {
    const current = get(getState().themes, chatId);
    const next = { ...getState().themes, [chatId]: { ...current, fontSize } };
    set({ themes: next });
    await persist(next);
  },

  getBubbleColor: (chatId) => get(getState().themes, chatId).bubbleColor,

  getWallpaper: (chatId) => get(getState().themes, chatId).wallpaper,

  getFontSize: (chatId) => get(getState().themes, chatId).fontSize ?? 'medium',

  setPattern: async (chatId, pattern) => {
    const current = get(getState().themes, chatId);
    const updated: ChatThemeConfig = { ...current };
    if (pattern === null) delete updated.pattern;
    else updated.pattern = pattern;
    const next = { ...getState().themes, [chatId]: updated };
    set({ themes: next });
    await persist(next);
  },

  getPattern: (chatId) => get(getState().themes, chatId).pattern ?? null,

  resetTheme: async (chatId) => {
    const next = { ...getState().themes };
    delete next[chatId];
    set({ themes: next });
    await persist(next);
  },
}));
