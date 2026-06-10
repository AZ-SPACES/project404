import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ScheduledMessage {
  id: string;
  chatId: string;
  text: string;
  scheduledAt: number;
}

interface ScheduledMessagesState {
  messages: ScheduledMessage[];
  schedule: (msg: ScheduledMessage) => void;
  remove: (id: string) => void;
  getDue: (chatId: string) => ScheduledMessage[];
}

export const useScheduledMessagesStore = create<ScheduledMessagesState>((set, get) => ({
  messages: [],
  schedule: (msg) => {
    const next = [...get().messages, msg];
    set({ messages: next });
    AsyncStorage.setItem('aza_scheduled_v1', JSON.stringify(next)).catch(() => {});
  },
  remove: (id) => {
    const next = get().messages.filter(m => m.id !== id);
    set({ messages: next });
    AsyncStorage.setItem('aza_scheduled_v1', JSON.stringify(next)).catch(() => {});
  },
  getDue: (chatId) => {
    const now = Date.now();
    return get().messages.filter(m => m.chatId === chatId && m.scheduledAt <= now);
  },
}));

AsyncStorage.getItem('aza_scheduled_v1').then(val => {
  if (!val) return;
  try {
    useScheduledMessagesStore.setState({ messages: JSON.parse(val) as ScheduledMessage[] });
  } catch {}
}).catch(() => {});
