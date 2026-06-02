import { create } from 'zustand';
import {
  initiateTransfer as initiateTransferApi,
  confirmTransfer as confirmTransferApi,
  cancelTransfer as cancelTransferApi,
  requestMoney as requestMoneyApi,
  acceptMoneyRequest as acceptMoneyRequestApi,
  declineMoneyRequest as declineMoneyRequestApi,
} from '../services/api';
import { queryClient } from '../lib/queryClient';
import { queryKeys } from '../lib/queryKeys';
import { extractErrorMessage } from '../utils/errorUtils';

type TransferStatus = 'idle' | 'initiating' | 'confirming' | 'requesting' | 'success' | 'error';

interface TransferState {
  status: TransferStatus;
  pendingTransactionId: string | null;
  error: string | null;

  initiateTransfer: (params: {
    recipientIdentifier: string;
    amount: number;
    note: string;
    category?: string;
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

/** Generates a cryptographically secure UUID v4 idempotency key. */
function generateIdempotencyKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40; // UUID v4 version bits
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // RFC 4122 variant bits
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}


export const useTransferStore = create<TransferState>((set, get) => ({
  status: 'idle',
  pendingTransactionId: null,
  error: null,

  initiateTransfer: async ({ recipientIdentifier, amount, note, category }) => {
    set({ status: 'initiating', error: null });
    try {
      const idempotencyKey = generateIdempotencyKey();
      const res = await initiateTransferApi({
        recipientIdentifier,
        amount,
        note,
        idempotencyKey,
        ...(category ? { category } : {}),
      });
      const txId: string = res.data?.data?.id || res.data?.id;
      if (!txId) throw new Error('No transaction ID in response');
      set({ status: 'idle', pendingTransactionId: txId });
      return txId;
    } catch (err) {
      const msg = extractErrorMessage(err);
      set({ status: 'error', error: msg });
      throw new Error(msg);
    }
  },

  confirmTransfer: async (txId, passcode) => {
    set({ status: 'confirming', error: null });
    try {
      await confirmTransferApi(txId, passcode);
      set({ status: 'success', pendingTransactionId: null });
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet() });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.spendingYearly() });
    } catch (err) {
      const msg = extractErrorMessage(err);
      set({ status: 'error', error: msg });
      throw new Error(msg);
    }
  },

  cancelPendingTransfer: async () => {
    const { pendingTransactionId } = get();
    if (!pendingTransactionId) return;
    try {
      await cancelTransferApi(pendingTransactionId);
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet() });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
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
      const msg = extractErrorMessage(err);
      set({ status: 'error', error: msg });
      throw new Error(msg);
    }
  },

  acceptMoneyRequest: async (txId, passcode) => {
    set({ status: 'confirming', error: null });
    try {
      await acceptMoneyRequestApi(txId, passcode);
      set({ status: 'success' });
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet() });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.spendingYearly() });
    } catch (err) {
      const msg = extractErrorMessage(err);
      set({ status: 'error', error: msg });
      throw new Error(msg);
    }
  },

  declineMoneyRequest: async (txId) => {
    set({ status: 'idle', error: null });
    try {
      await declineMoneyRequestApi(txId);
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    } catch (err) {
      const msg = extractErrorMessage(err);
      set({ status: 'error', error: msg });
      throw new Error(msg);
    }
  },

  reset: () => {
    set({ status: 'idle', pendingTransactionId: null, error: null });
  },
}));
