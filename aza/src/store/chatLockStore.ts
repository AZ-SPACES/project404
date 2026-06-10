import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ChatLockState {
  lockedChatIds: string[];
  lock: (chatId: string) => void;
  unlock: (chatId: string) => void;
  isLocked: (chatId: string) => boolean;
}

export const useChatLockStore = create<ChatLockState>((set, get) => ({
  lockedChatIds: [],
  lock: (chatId) => {
    const next = [...new Set([...get().lockedChatIds, chatId])];
    set({ lockedChatIds: next });
    AsyncStorage.setItem('aza_chat_locks_v1', JSON.stringify(next)).catch(() => {});
  },
  unlock: (chatId) => {
    const next = get().lockedChatIds.filter(id => id !== chatId);
    set({ lockedChatIds: next });
    AsyncStorage.setItem('aza_chat_locks_v1', JSON.stringify(next)).catch(() => {});
  },
  isLocked: (chatId) => get().lockedChatIds.includes(chatId),
}));

AsyncStorage.getItem('aza_chat_locks_v1').then(val => {
  if (!val) return;
  try {
    const ids = JSON.parse(val) as string[];
    useChatLockStore.setState({ lockedChatIds: ids });
  } catch {}
}).catch(() => {});
