import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { accountPersistOptions, bindAccountStore } from './persistence';

const STORE_NAME = 'aza_poll_votes';

interface PollState {
  votes: Record<string, number>;
  vote: (messageId: string, optionIndex: number) => void;
  getVote: (messageId: string) => number | null;
}

export const usePollStore = create<PollState>()(
  persist(
    (set, get) => ({
      votes: {},

      vote: (messageId, optionIndex) =>
        set((s) => ({ votes: { ...s.votes, [messageId]: optionIndex } })),

      getVote: (messageId) => {
        const v = get().votes[messageId];
        return v !== undefined ? v : null;
      },
    }),
    accountPersistOptions<PollState>({
      name: STORE_NAME,
      version: 1,
      partialize: (s) => ({ votes: s.votes }),
    }),
  ),
);

// "Which option did I pick" is answered per account, not per device.
bindAccountStore(usePollStore, { name: STORE_NAME, empty: () => ({ votes: {} }) });
