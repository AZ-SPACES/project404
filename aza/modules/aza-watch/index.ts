import { requireOptionalNativeModule } from 'expo';

export type WatchTransaction = {
  id: string;
  name: string;
  /** Pre-formatted on the phone; currency rules live in utils/transactionUtils. */
  amount: string;
  isCredit: boolean;
  time: string;
};

/**
 * The read-only slice of wallet state mirrored to the watch.
 *
 * Must stay structurally identical to `WalletSnapshot` in
 * targets/watch/WalletSnapshot.swift — encoded here, decoded there. It carries
 * no tokens, no key material, and no identifiers beyond what the phone already
 * displays. See docs/WATCH_APP_PLAN.md.
 */
export type WatchSnapshot = {
  formattedBalance: string;
  currency: string;
  transactions: WatchTransaction[];
  /** ISO-8601. Rendered on the watch so a stale balance cannot pass for a live one. */
  capturedAt: string;
  balanceHidden: boolean;
};

type AzaWatchNativeModule = {
  isWatchAppAvailable: boolean;
  sendSnapshot(json: string): Promise<void>;
  addListener(event: 'onRefreshRequested', listener: () => void): { remove(): void };
};

/**
 * `null` on Android, on web, under Jest, and in any build without the native
 * module compiled in. Every export below degrades to a no-op rather than
 * throwing, so callers never have to branch on platform.
 */
const native = requireOptionalNativeModule<AzaWatchNativeModule>('AzaWatch');

/** True only when a watch is paired AND the watch app is installed on it. */
export function isWatchAppAvailable(): boolean {
  return native?.isWatchAppAvailable ?? false;
}

export async function sendWatchSnapshot(snapshot: WatchSnapshot): Promise<void> {
  if (!native) return;
  await native.sendSnapshot(JSON.stringify(snapshot));
}

export function addWatchRefreshListener(listener: () => void): { remove(): void } {
  return native?.addListener('onRefreshRequested', listener) ?? { remove: () => {} };
}
