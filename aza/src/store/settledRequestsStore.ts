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
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'aza_settled_requests_v1';

interface SettledRequestsState {
  paidIds: string[];
  declinedIds: string[];
  markPaid: (id: string) => void;
  markDeclined: (id: string) => void;
}

function persist(state: Pick<SettledRequestsState, 'paidIds' | 'declinedIds'>) {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
}

export const useSettledRequestsStore = create<SettledRequestsState>((set, get) => ({
  paidIds: [],
  declinedIds: [],
  markPaid: (id) => {
    const next = [...new Set([...get().paidIds, id])];
    set({ paidIds: next });
    persist({ paidIds: next, declinedIds: get().declinedIds });
  },
  markDeclined: (id) => {
    const next = [...new Set([...get().declinedIds, id])];
    set({ declinedIds: next });
    persist({ paidIds: get().paidIds, declinedIds: next });
  },
}));

AsyncStorage.getItem(STORAGE_KEY).then(val => {
  if (!val) return;
  try {
    const { paidIds, declinedIds } = JSON.parse(val) as { paidIds?: string[]; declinedIds?: string[] };
    useSettledRequestsStore.setState({
      paidIds: Array.isArray(paidIds) ? paidIds : [],
      declinedIds: Array.isArray(declinedIds) ? declinedIds : [],
    });
  } catch {}
}).catch(() => {});
