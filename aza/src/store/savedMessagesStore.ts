import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Message } from '../components/chat/chatTypes';

type SavedMessagesState = {
  messages: Message[];
  addMessage: (msg: Message) => void;
  deleteMessage: (id: string) => void;
  clearAll: () => void;
};

export const useSavedMessagesStore = create<SavedMessagesState>()(
  persist(
    (set) => ({
      messages: [],
      addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
      deleteMessage: (id) => set((s) => ({ messages: s.messages.filter((m) => m.id !== id) })),
      clearAll: () => set({ messages: [] }),
    }),
    { name: 'aza_saved_messages_v1', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
