import { requireOptionalNativeModule } from 'expo';

export type WatchTransaction = {
  id: string;
  name: string;
  /** Pre-formatted on the phone; currency rules live in utils/transactionUtils. */
  amount: string;
  isCredit: boolean;
  /** Clock time, e.g. "14:32". */
  time: string;
  /** "Today" | "Yesterday" | "12 Aug" — a bare clock time is ambiguous in a mixed-day list. */
  day: string;
  /** "Transfer" | "Money Request". */
  kind: string;
  status: string;
  isPending: boolean;
  /** Empty string when the transfer carried no note. */
  note: string;
  /**
   * True only for a still-pending money request awaiting *this* user's payment.
   * Declining is the one thing the watch may do to a transaction — it fails
   * closed, and the endpoint takes no passcode. Accepting stays on the phone.
   */
  canDecline: boolean;
};

/**
 * One ring's worth of budget: the categories are summed into a single figure
 * because a watch face has room for one gauge, not seven. The phone keeps the
 * breakdown.
 */
export type WatchBudget = {
  spent: string;
  limit: string;
  /** Spent ÷ limit. Deliberately not clamped — over budget is a real state. */
  fraction: number;
};

export type WatchSpending = {
  /** Pre-formatted. Both come from endpoints the phone already calls. */
  sentToday: string;
  spentThisMonth: string;
};

/**
 * The read-only slice of wallet state mirrored to the watch.
 *
 * Must stay structurally identical to `WalletSnapshot` in
 * targets/watch/WalletSnapshot.swift — encoded here, decoded there. The pairing
 * is enforced by src/hooks/__tests__/watchSchemaParity.test.ts, which reads the
 * Swift source: nothing else catches a field renamed on one side only.
 *
 * It carries no tokens, no key material, and no identifiers beyond what the
 * phone already displays. See docs/WATCH_APP_PLAN.md.
 */
export type WatchSnapshot = {
  formattedBalance: string;
  currency: string;
  transactions: WatchTransaction[];
  /** ISO-8601. Rendered on the watch so a stale balance cannot pass for a live one. */
  capturedAt: string;
  balanceHidden: boolean;
  /** Public payment handle. Safe on the wrist: receiving money reveals nothing. */
  handle: string;
  /** The universal link encoded into the watch's receive QR. */
  payLink: string;
  displayName: string;
  /** Null until the spending endpoints have answered at least once. */
  spending: WatchSpending | null;
  /** Null when the user has set no budgets at all, which is the common case. */
  budget: WatchBudget | null;
  pendingCount: number;
  requestCount: number;
};

/**
 * Actions the watch is allowed to ask the phone to perform.
 *
 * Every one of these fails *closed*: freezing a wallet, declining a request and
 * denying a sign-in can all be done by an attacker holding the watch, and none
 * of them moves money to anyone or grants any access. That is the whole
 * criterion for being on this list. The API agrees independently — each of these
 * endpoints takes no passcode, while every approving counterpart does.
 */
export type WatchCommandAction = 'freezeWallet' | 'declineRequest' | 'denyLogin';

export type WatchCommand = {
  /** Correlates the reply; the watch is blocked on it. */
  commandId: string;
  action: WatchCommandAction;
  /** Transaction id, 2FA request id, or empty for actions that take no target. */
  id: string;
};

type AzaWatchNativeModule = {
  isWatchAppAvailable: boolean;
  sendSnapshot(json: string): Promise<void>;
  /** Wipes the wrist. Called on logout — see useWatchSync. */
  clearSnapshot(): Promise<void>;
  addListener(
    event: 'onRefreshRequested' | 'onWatchStateChanged',
    listener: () => void,
  ): { remove(): void };
  addListener(
    event: 'onCommand',
    listener: (command: WatchCommand) => void,
  ): { remove(): void };
  resolveCommand(commandId: string, ok: boolean, message: string): Promise<void>;
};

/**
 * `null` on Android, on web, under Jest, and in any build without the native
 * module compiled in. Every export below degrades to a no-op rather than
 * throwing, so callers never have to branch on platform.
 */
const native = requireOptionalNativeModule<AzaWatchNativeModule>('AzaWatch');

const NOOP_SUBSCRIPTION = { remove: () => {} };

/** True only when a watch is paired AND the watch app is installed on it. */
export function isWatchAppAvailable(): boolean {
  return native?.isWatchAppAvailable ?? false;
}

export async function sendWatchSnapshot(snapshot: WatchSnapshot): Promise<void> {
  if (!native) return;
  await native.sendSnapshot(JSON.stringify(snapshot));
}

/**
 * Drops the snapshot from the watch and from its shared container.
 *
 * Without this, signing out on the phone leaves the last known balance legible
 * on the wrist indefinitely — the watch has no session of its own to expire.
 */
export async function clearWatchSnapshot(): Promise<void> {
  if (!native) return;
  await native.clearSnapshot();
}

export function addWatchRefreshListener(listener: () => void): { remove(): void } {
  return native?.addListener('onRefreshRequested', listener) ?? NOOP_SUBSCRIPTION;
}

/**
 * Fires when the watch is paired, unpaired, or the watch app is installed or
 * removed. `isWatchAppAvailable` is a snapshot of state that changes without
 * us: read once at launch, a watch app installed an hour later never receives
 * anything until the balance happens to move.
 */
export function addWatchStateListener(listener: () => void): { remove(): void } {
  return native?.addListener('onWatchStateChanged', listener) ?? NOOP_SUBSCRIPTION;
}

/**
 * A command the watch is waiting on. The handler must call
 * `resolveWatchCommand` exactly once, or the watch is left spinning until the
 * native timeout fires.
 */
export function addWatchCommandListener(
  listener: (command: WatchCommand) => void,
): { remove(): void } {
  return native?.addListener('onCommand', listener) ?? NOOP_SUBSCRIPTION;
}

/**
 * Answer a command. `message` is shown verbatim on the watch, so it is user-facing
 * copy rather than an error string.
 */
export async function resolveWatchCommand(
  commandId: string,
  ok: boolean,
  message: string,
): Promise<void> {
  if (!native) return;
  await native.resolveCommand(commandId, ok, message);
}
