import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useWallet } from './useWallet';
import { useAuth } from '../providers/AuthProvider';
import { useProfile } from '../providers/ProfileProvider';
import { useDisplayContext } from '../providers/DisplayProvider';
import { subscribeAuthEvents } from '../providers/authEvents';
import { formatCurrency } from '../utils/transactionUtils';
import {
  getBudgetStatus,
  getSpendingSummary,
  getTodaySent,
  getTransactions,
} from '../services/api';
import {
  addWatchRefreshListener,
  addWatchStateListener,
  clearWatchSnapshot,
  isWatchAppAvailable,
  sendWatchSnapshot,
  type WatchBudget,
  type WatchSnapshot,
  type WatchSpending,
} from '../../modules/aza-watch';

/** The watch shows a short list; sending more just burns payload size. */
const MAX_TRANSACTIONS = 5;

/**
 * Resend an unchanged snapshot at least this often.
 *
 * The watch marks a snapshot stale after 15 minutes and says so in orange. Left
 * to content-change alone, a balance that simply hasn't moved since morning goes
 * orange by lunchtime while being perfectly current — the watch calling a correct
 * figure stale is worse than the staleness warning it was meant to be. So the
 * timestamp is refreshed on a beat comfortably inside that window, while the
 * payload comparison still suppresses the redundant *content* sends that
 * WatchConnectivity throttles.
 */
const HEARTBEAT_MS = 10 * 60_000;

/** Secondary wallet figures, refreshed lazily — nothing here is on the phone's critical path. */
const EXTRAS_STALE_MS = 5 * 60_000;

/**
 * The server caps a page at 100. Having more than that pending at once is not a
 * state the watch is trying to summarise accurately — the badge is a nudge to
 * open the phone, and it says "99+" long before the cap bites.
 */
const PENDING_PAGE_SIZE = 100;

/** Only the two fields the counts turn on; the rest of the row is not read here. */
type PendingItem = { type?: string; direction?: string };

type WatchExtras = {
  spending: WatchSpending;
  budget: WatchBudget | null;
  pendingCount: number;
  requestCount: number;
};

/** Only the fields the ring needs; the phone keeps the per-category breakdown. */
type BudgetItem = { spent?: number; budgetAmount?: number };

/** The budget endpoints are month-scoped, and the ring is a this-month figure. */
function currentMonthRange(now = new Date()): { start: string; end: string } {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return {
    start: iso(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

/**
 * Sums every category into the single figure a watch face has room for.
 *
 * Returns null when nothing is budgeted rather than a 0/0 ring: an empty gauge
 * reads as "you have spent nothing", which is the opposite of "you have set no
 * budget".
 */
export function summariseBudget(items: BudgetItem[], currency: string): WatchBudget | null {
  const budgeted = items.filter((b) => Number(b.budgetAmount ?? 0) > 0);
  if (budgeted.length === 0) return null;

  const limit = budgeted.reduce((total, b) => total + Number(b.budgetAmount ?? 0), 0);
  const spent = budgeted.reduce((total, b) => total + Number(b.spent ?? 0), 0);

  return {
    spent: formatCurrency(spent, currency),
    limit: formatCurrency(limit, currency),
    fraction: limit > 0 ? spent / limit : 0,
  };
}

/** Short enough for a 41mm screen: the phone's "Tuesday, August 12" does not fit. */
export function dayLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);

  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export async function fetchWatchExtras(currency: string): Promise<WatchExtras> {
  const { start, end } = currentMonthRange();
  const [summaryRes, todayRes, pendingRes, budgetRes] = await Promise.all([
    getSpendingSummary(),
    getTodaySent(),
    // One page of PENDING, counted here rather than by four filtered queries.
    //
    // `TransferService.getTransactionHistory` applies exactly ONE filter, first
    // match wins: direction, then type, then status. Passing all three does not
    // narrow — it silently degrades to direction alone, so asking for
    // "pending incoming requests" would return every incoming transaction the
    // user has ever had and report it as a request count.
    getTransactions(0, PENDING_PAGE_SIZE, undefined, 'PENDING'),
    // Most users keep no budgets, so this is allowed to fail quietly rather
    // than take the whole snapshot down with it.
    getBudgetStatus(start, end).catch(() => null),
  ]);

  const summary = summaryRes.data?.data ?? summaryRes.data ?? {};
  const today = todayRes.data?.data ?? todayRes.data ?? {};

  const page = pendingRes.data?.data ?? pendingRes.data ?? {};
  const pending: PendingItem[] = Array.isArray(page.content) ? page.content : [];

  // A request awaiting *our* payment has us as the transaction's sender, and the
  // API reports direction from the recipient's side — so it reads OUTGOING, not
  // INCOMING. `declineMoneyRequest` enforces the same relationship server-side.
  const requests = pending.filter((t) => t.type === 'REQUEST' && t.direction === 'OUTGOING');

  const budgetItems = budgetRes?.data?.data ?? budgetRes?.data ?? [];

  return {
    budget: summariseBudget(Array.isArray(budgetItems) ? budgetItems : [], currency),
    spending: {
      sentToday: formatCurrency(Number(today.sentToday ?? 0), today.currency ?? currency),
      spentThisMonth: formatCurrency(
        Number(summary.spentThisMonth ?? 0),
        summary.currency ?? currency,
      ),
    },
    pendingCount: pending.length - requests.length,
    requestCount: requests.length,
  };
}

/**
 * Mirrors the wallet to a paired Apple Watch.
 *
 * Mount once, below AuthProvider, ProfileProvider and DisplayProvider.
 * Everything here is a no-op unless the module resolved (iOS only) and a watch is
 * paired with the app installed, so it is safe to mount unconditionally.
 */
export function useWatchSync(): void {
  const { userToken } = useAuth();
  const { wallet, recentTransactions, refresh } = useWallet();
  const { balanceHiddenByDefault } = useDisplayContext();
  const { handle, displayName } = useProfile();

  // Pairing state is not static: a watch app installed an hour after launch
  // would otherwise receive nothing until the balance happened to move.
  const [available, setAvailable] = useState(isWatchAppAvailable);

  const { data: extras } = useQuery({
    queryKey: ['watch-extras', wallet?.currency ?? 'GHS'],
    queryFn: () => fetchWatchExtras(wallet?.currency ?? 'GHS'),
    enabled: !!userToken && available,
    staleTime: EXTRAS_STALE_MS,
  });

  // The store handler must not go stale inside the native listener closure,
  // which is registered once.
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  // WatchConnectivity throttles application-context updates, and re-sending an
  // identical payload wastes that budget for no gain. Compare on content, not
  // on object identity — react-query hands back a new array on every refetch.
  const lastSentRef = useRef<string | null>(null);
  const lastSentAtRef = useRef(0);

  // Read inside callbacks that must not be re-created on every wallet tick.
  const snapshotRef = useRef<WatchSnapshot | null>(null);

  snapshotRef.current = wallet
    ? {
        formattedBalance: wallet.formattedBalance,
        currency: wallet.currency,
        balanceHidden: balanceHiddenByDefault,
        handle: handle ?? '',
        payLink: handle ? `https://aza.systems/pay/${handle}` : '',
        displayName: displayName ?? '',
        spending: extras?.spending ?? null,
        budget: extras?.budget ?? null,
        pendingCount: extras?.pendingCount ?? 0,
        requestCount: extras?.requestCount ?? 0,
        transactions: recentTransactions.slice(0, MAX_TRANSACTIONS).map((txn) => ({
          id: txn.id,
          name: txn.name,
          amount: formatCurrency(txn.amount, txn.currency ?? wallet.currency),
          isCredit: txn.isCredit,
          time: txn.time,
          day: dayLabel(txn.fullDate),
          kind: txn.type,
          status: txn.status ?? '',
          isPending: txn.isPending ?? false,
          note: txn.note ?? '',
          // `mapBackendTransaction` labels a REQUEST as "Money Request", and the
          // payer is the transaction's sender — which the API reports as
          // OUTGOING. Same relationship `declineMoneyRequest` re-checks.
          canDecline:
            txn.type === 'Money Request' &&
            txn.direction === 'OUTGOING' &&
            (txn.isPending ?? false),
        })),
        // Filled in at send time, deliberately excluded from the change
        // comparison: a new timestamp on identical data is not a *content*
        // change, and the heartbeat below owns when it is worth resending anyway.
        capturedAt: '',
      }
    : null;

  const send = useCallback((force = false) => {
    const snapshot = snapshotRef.current;
    if (!snapshot || !isWatchAppAvailable()) return;

    const fingerprint = JSON.stringify(snapshot);
    const due = Date.now() - lastSentAtRef.current >= HEARTBEAT_MS;
    if (!force && !due && fingerprint === lastSentRef.current) return;

    lastSentRef.current = fingerprint;
    lastSentAtRef.current = Date.now();

    void sendWatchSnapshot({ ...snapshot, capturedAt: new Date().toISOString() }).catch(() => {
      // A failed push is not worth surfacing: the watch keeps showing its cached
      // value with an honest "as of" time, and the next change retries. Clear the
      // fingerprint so that retry is not skipped as a duplicate.
      lastSentRef.current = null;
      lastSentAtRef.current = 0;
    });
  }, []);

  useEffect(() => {
    const subscription = addWatchRefreshListener(() => {
      refreshRef.current();
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const subscription = addWatchStateListener(() => {
      const nowAvailable = isWatchAppAvailable();
      setAvailable(nowAvailable);
      // A watch that just appeared has nothing on it, and the payload we would
      // send is byte-identical to the one dropped on the floor while it was
      // absent. Force past the duplicate check.
      if (nowAvailable) send(true);
    });
    return () => subscription.remove();
  }, [send]);

  /**
   * Wipe the wrist on sign-out.
   *
   * The watch holds no session of its own, so nothing else ever expires the
   * balance sitting on it. Subscribing to the event hub rather than watching
   * `userToken` keeps this working when the API interceptor force-logs-out on a
   * 403, which unmounts faster than a render can observe.
   */
  useEffect(() => {
    return subscribeAuthEvents((event) => {
      if (event.type !== 'logout') return;
      lastSentRef.current = null;
      lastSentAtRef.current = 0;
      void clearWatchSnapshot().catch(() => {});
    });
  }, []);

  /**
   * Push as the app leaves the foreground.
   *
   * This is the last moment the phone is guaranteed to be running, and the one
   * the watch is most likely to be read after. Sending on the way back to active
   * costs nothing and covers a return from a long background stretch.
   */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'active') send(true);
    });
    return () => subscription.remove();
  }, [send]);

  useEffect(() => {
    const timer = setInterval(() => send(), HEARTBEAT_MS);
    return () => clearInterval(timer);
  }, [send]);

  useEffect(() => {
    send();
  }, [wallet, recentTransactions, balanceHiddenByDefault, handle, displayName, extras, send]);
}
