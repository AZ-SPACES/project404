import { create } from 'zustand';
import {
  initiateTransfer as initiateTransferApi,
  confirmTransfer as confirmTransferApi,
  cancelTransfer as cancelTransferApi,
  requestMoney as requestMoneyApi,
  acceptMoneyRequest as acceptMoneyRequestApi,
  declineMoneyRequest as declineMoneyRequestApi,
} from '../services/api';

type TransferStatus = 'idle' | 'initiating' | 'confirming' | 'requesting' | 'success' | 'error';

interface TransferState {
  status: TransferStatus;
  pendingTransactionId: string | null;
  error: string | null;

  initiateTransfer: (params: {
    recipientIdentifier: string;
    amount: number;
    note: string;
  }) => Promise<string>;

  confirmTransfer: (txId: string, passcode: string) => Promise<void>;

  cancelPendingTransfer: () => Promise<void>;

  requestMoney: (params: {
    fromIdentifier: string;
    amount: number;
    note: string;
  }) => Promise<string>;

  acceptMoneyRequest: (txId: string, passcode: string) => Promise<void>;

  declineMoneyRequest: (txId: string) => Promise<void>;

  reset: () => void;
}

/** Generates a UUID v4 idempotency key (no external dependency). */
function generateIdempotencyKey(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Extracts a human-readable error message from an Axios error.
 *  Some backend error shapes put the message inside an object (e.g.
 *  `{ error: { code, message } }` or `{ errors: [{ message }] }`).
 *  If we returned that object verbatim, `new Error(obj)` would coerce it
 *  to the string "[object Object]" and surface that in the UI. So we
 *  walk candidates and only accept non-empty strings.
 */
function extractError(err: unknown): string {
  const pickString = (v: unknown): string | null =>
    typeof v === 'string' && v.trim() ? v : null;

  if (err && typeof err === 'object') {
    const axiosErr = err as any;
    const data = axiosErr.response?.data;

    const candidates: unknown[] = [
      data?.message,
      data?.error?.message,
      data?.error,
      Array.isArray(data?.errors) ? data.errors[0]?.message ?? data.errors[0] : undefined,
      data?.detail,
      axiosErr.message,
    ];

    for (const c of candidates) {
      const s = pickString(c);
      if (s) return s;
    }
  }
  return 'Something went wrong';
}

export const useTransferStore = create<TransferState>((set, get) => ({
  status: 'idle',
  pendingTransactionId: null,
  error: null,

  initiateTransfer: async ({ recipientIdentifier, amount, note }) => {
    set({ status: 'initiating', error: null });
    try {
      const idempotencyKey = generateIdempotencyKey();
      const res = await initiateTransferApi({
        recipientIdentifier,
        amount,
        note,
        idempotencyKey,
      });
      const txId: string = res.data?.data?.id || res.data?.id;
      if (!txId) throw new Error('No transaction ID in response');
      set({ status: 'idle', pendingTransactionId: txId });
      return txId;
    } catch (err) {
      const msg = extractError(err);
      set({ status: 'error', error: msg });
      throw new Error(msg);
    }
  },

  confirmTransfer: async (txId, passcode) => {
    set({ status: 'confirming', error: null });
    try {
      await confirmTransferApi(txId, passcode);
      set({ status: 'success', pendingTransactionId: null });
    } catch (err) {
      const msg = extractError(err);
      set({ status: 'error', error: msg });
      throw new Error(msg);
    }
  },

  cancelPendingTransfer: async () => {
    const { pendingTransactionId } = get();
    if (!pendingTransactionId) return;
    try {
      await cancelTransferApi(pendingTransactionId);
    } catch {
      // Best-effort cancel — don't surface this error to user
    } finally {
      set({ status: 'idle', pendingTransactionId: null, error: null });
    }
  },

  requestMoney: async ({ fromIdentifier, amount, note }) => {
    set({ status: 'requesting', error: null });
    try {
      const res = await requestMoneyApi({ fromIdentifier, amount, note });
      const txId: string = res.data?.data?.id || res.data?.id;
      if (!txId) throw new Error('No transaction ID in response');
      set({ status: 'success', pendingTransactionId: txId });
      return txId;
    } catch (err) {
      const msg = extractError(err);
      set({ status: 'error', error: msg });
      throw new Error(msg);
    }
  },

  acceptMoneyRequest: async (txId, passcode) => {
    set({ status: 'confirming', error: null });
    try {
      await acceptMoneyRequestApi(txId, passcode);
      set({ status: 'success' });
    } catch (err) {
      const msg = extractError(err);
      set({ status: 'error', error: msg });
      throw new Error(msg);
    }
  },

  declineMoneyRequest: async (txId) => {
    set({ status: 'idle', error: null });
    try {
      await declineMoneyRequestApi(txId);
    } catch (err) {
      const msg = extractError(err);
      set({ status: 'error', error: msg });
      throw new Error(msg);
    }
  },

  reset: () => {
    set({ status: 'idle', pendingTransactionId: null, error: null });
  },
}));
