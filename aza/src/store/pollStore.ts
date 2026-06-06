import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'aza_poll_votes_v1';

interface PollState {
  votes: Record<string, number>;
  vote: (messageId: string, optionIndex: number) => void;
  getVote: (messageId: string) => number | null;
}

export const usePollStore = create<PollState>((set, get) => ({
  votes: {},

  vote: (messageId, optionIndex) => {
    const next = { ...get().votes, [messageId]: optionIndex };
    set({ votes: next });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  },

  getVote: (messageId) => {
    const v = get().votes[messageId];
    return v !== undefined ? v : null;
  },
}));

AsyncStorage.getItem(STORAGE_KEY).then((v) => {
  if (v) {
    try {
      usePollStore.setState({ votes: JSON.parse(v) });
    } catch {}
  }
}).catch(() => {});
