import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { accountPersistOptions, bindAccountStore } from './persistence';

const STORE_NAME = 'aza_chat_themes';

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

type ChatThemeState = {
  themes: Record<string, ChatThemeConfig>;
  setBubbleColor: (chatId: string, color: string) => void;
  setWallpaper: (chatId: string, wallpaper: ChatWallpaper) => void;
  setFontSize: (chatId: string, size: ChatFontSize) => void;
  setPattern: (chatId: string, pattern: ChatWallpaperPattern | null) => void;
  getBubbleColor: (chatId: string) => string;
  getWallpaper: (chatId: string) => ChatWallpaper;
  getFontSize: (chatId: string) => ChatFontSize;
  getPattern: (chatId: string) => ChatWallpaperPattern | null;
  resetTheme: (chatId: string) => void;
};

function configFor(themes: Record<string, ChatThemeConfig>, chatId: string): ChatThemeConfig {
  return themes[chatId] ?? DEFAULT_CONFIG;
}

export const useChatThemeStore = create<ChatThemeState>()(
  persist(
    (set, get) => ({
      themes: {},

      setBubbleColor: (chatId, bubbleColor) =>
        set((s) => ({
          themes: { ...s.themes, [chatId]: { ...configFor(s.themes, chatId), bubbleColor } },
        })),

      setWallpaper: (chatId, wallpaper) =>
        set((s) => ({
          themes: { ...s.themes, [chatId]: { ...configFor(s.themes, chatId), wallpaper } },
        })),

      setFontSize: (chatId, fontSize) =>
        set((s) => ({
          themes: { ...s.themes, [chatId]: { ...configFor(s.themes, chatId), fontSize } },
        })),

      setPattern: (chatId, pattern) =>
        set((s) => {
          const updated: ChatThemeConfig = { ...configFor(s.themes, chatId) };
          if (pattern === null) delete updated.pattern;
          else updated.pattern = pattern;
          return { themes: { ...s.themes, [chatId]: updated } };
        }),

      resetTheme: (chatId) =>
        set((s) => {
          const next = { ...s.themes };
          delete next[chatId];
          return { themes: next };
        }),

      getBubbleColor: (chatId) => configFor(get().themes, chatId).bubbleColor,
      getWallpaper: (chatId) => configFor(get().themes, chatId).wallpaper,
      getFontSize: (chatId) => configFor(get().themes, chatId).fontSize ?? 'medium',
      getPattern: (chatId) => configFor(get().themes, chatId).pattern ?? null,
    }),
    accountPersistOptions<ChatThemeState>({
      name: STORE_NAME,
      version: 1,
      partialize: (s) => ({ themes: s.themes }),
    }),
  ),
);

// Per-chat appearance is per-account: chat ids mean nothing to the next person
// to sign in on this device. The old `aza_chat_themes_v2` key was device-global
// and is purged on upgrade rather than migrated — attributing it to whoever
// signs in first is the bug this scoping exists to prevent.
bindAccountStore(useChatThemeStore, { name: STORE_NAME, empty: () => ({ themes: {} }) });
