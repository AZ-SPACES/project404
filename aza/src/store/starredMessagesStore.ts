import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Message } from '../components/chat/chatTypes';

const KEY = 'aza_starred_messages_v1';

export type StarredEntry = {
  messageId: string;
  chatId: string;
  chatName: string;
  message: Message;
  starredAt: number;
};

type StarredState = {
  entries: StarredEntry[];
  loaded: boolean;
  load: () => Promise<void>;
  star: (message: Message, chatId: string, chatName: string) => Promise<void>;
  unstar: (messageId: string) => Promise<void>;
  isStarred: (messageId: string) => boolean;
  countForChat: (chatId: string) => number;
};

async function save(entries: StarredEntry[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(entries));
}

export const useStarredMessagesStore = create<StarredState>((set, get) => ({
  entries: [],
  loaded: false,

  load: async () => {
    if (get().loaded) return;
    try {
      const raw = await AsyncStorage.getItem(KEY);
      set({ entries: raw ? JSON.parse(raw) : [], loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  star: async (message, chatId, chatName) => {
    const { entries } = get();
    if (entries.some(e => e.messageId === message.id)) return;
    const entry: StarredEntry = {
      messageId: message.id,
      chatId,
      chatName,
      message,
      starredAt: Date.now(),
    };
    const next = [entry, ...entries];
    set({ entries: next });
    await save(next);
  },

  unstar: async (messageId) => {
    const next = get().entries.filter(e => e.messageId !== messageId);
    set({ entries: next });
    await save(next);
  },

  isStarred: (messageId) => get().entries.some(e => e.messageId === messageId),

  countForChat: (chatId) => get().entries.filter(e => e.chatId === chatId).length,
}));
