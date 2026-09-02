/**
 * Local record of money requests this device has settled (paid or declined).
 *
 * Request cards normally flip to Paid/Declined via E2EE receipt/control
 * messages in the chat, but those sends can fail silently. This store is the
 * local backstop: it is written the moment the server call succeeds, so the
 * payer's own card flips immediately and can't offer a second "Pay" even if
 * the chat message never lands.
 *
 * Keys are money-request transaction ids, or — for legacy request cards sent
 * before the request id was embedded — the request card's chat message id.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { accountPersistOptions, bindAccountStore } from './persistence';

const STORE_NAME = 'aza_settled_requests';

interface SettledRequestsState {
  paidIds: string[];
  declinedIds: string[];
  markPaid: (id: string) => void;
  markDeclined: (id: string) => void;
}

export const useSettledRequestsStore = create<SettledRequestsState>()(
  persist(
    (set) => ({
      paidIds: [],
      declinedIds: [],

      markPaid: (id) => set((s) => ({ paidIds: [...new Set([...s.paidIds, id])] })),

      markDeclined: (id) => set((s) => ({ declinedIds: [...new Set([...s.declinedIds, id])] })),
    }),
    accountPersistOptions<SettledRequestsState>({
      name: STORE_NAME,
      version: 1,
      partialize: (s) => ({ paidIds: s.paidIds, declinedIds: s.declinedIds }),
    }),
  ),
);

// These are transaction ids the signed-in user settled. Carried across a logout
// they would suppress the Pay button on another account's live requests.
bindAccountStore(useSettledRequestsStore, {
  name: STORE_NAME,
  empty: () => ({ paidIds: [], declinedIds: [] }),
});
