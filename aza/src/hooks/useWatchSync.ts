import { useEffect, useRef } from 'react';
import { useWallet } from './useWallet';
import { useDisplayContext } from '../providers/DisplayProvider';
import { formatCurrency } from '../utils/transactionUtils';
import {
  addWatchRefreshListener,
  isWatchAppAvailable,
  sendWatchSnapshot,
  type WatchSnapshot,
} from '../../modules/aza-watch';

/** The watch shows a short list; sending more just burns payload size. */
const MAX_TRANSACTIONS = 5;

/**
 * Mirrors the wallet to a paired Apple Watch.
 *
 * Mount once, below AuthProvider and DisplayProvider. Everything here is a
 * no-op unless the module resolved (iOS only) and a watch is paired with the
 * app installed, so it is safe to mount unconditionally.
 */
export function useWatchSync(): void {
  const { wallet, recentTransactions, refresh } = useWallet();
  const { balanceHiddenByDefault } = useDisplayContext();

  // The store handler must not go stale inside the native listener closure,
  // which is registered once.
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  // WatchConnectivity throttles application-context updates, and re-sending an
  // identical payload wastes that budget for no gain. Compare on content, not
  // on object identity — react-query hands back a new array on every refetch.
  const lastSentRef = useRef<string | null>(null);

  useEffect(() => {
    const subscription = addWatchRefreshListener(() => {
      refreshRef.current();
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!wallet || !isWatchAppAvailable()) return;

    const snapshot: WatchSnapshot = {
      formattedBalance: wallet.formattedBalance,
      currency: wallet.currency,
      balanceHidden: balanceHiddenByDefault,
      transactions: recentTransactions.slice(0, MAX_TRANSACTIONS).map((txn) => ({
        id: txn.id,
        name: txn.name,
        amount: formatCurrency(txn.amount, txn.currency ?? wallet.currency),
        isCredit: txn.isCredit,
        time: txn.time,
      })),
      // Filled in below, deliberately excluded from the change comparison:
      // a new timestamp on identical data is not a change worth sending.
      capturedAt: '',
    };

    const fingerprint = JSON.stringify(snapshot);
    if (fingerprint === lastSentRef.current) return;
    lastSentRef.current = fingerprint;

    snapshot.capturedAt = new Date().toISOString();
    void sendWatchSnapshot(snapshot).catch(() => {
      // A failed push is not worth surfacing: the watch keeps showing its cached
      // value with an honest "as of" time, and the next change retries. Clear the
      // fingerprint so that retry is not skipped as a duplicate.
      lastSentRef.current = null;
    });
  }, [wallet, recentTransactions, balanceHiddenByDefault]);
}
