/**
 * @aza/miniapp-sdk
 *
 * Developer SDK for building Aza Mini Apps.
 * The `window.aza` bridge is injected automatically by the Aza app at runtime —
 * you do NOT need to include any runtime script. This package provides:
 *
 *   - TypeScript types for the entire `window.aza` API
 *   - `getAza()` — safe accessor that throws if called outside Aza
 *   - `waitForAza()` — Promise that resolves once the bridge is ready
 *   - `isInsideAza()` — synchronous check
 *
 * Usage:
 *   import { waitForAza } from '@aza/miniapp-sdk';
 *
 *   const aza = await waitForAza();
 *   const user = await aza.getUser();
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AzaUser {
  username: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  /** Only present if USER_PHONE permission was granted. */
  phone?: string;
  /** Only present if USER_EMAIL permission was granted. */
  email?: string;
}

export interface AzaBalance {
  balance: number;
}

export interface AzaPaymentRequest {
  /** Amount in GHS. */
  amount: number;
  /**
   * The Aza username, phone number, or email of the payment recipient.
   * Usually your own Aza account identifier as the mini-app developer.
   */
  recipientIdentifier: string;
  /** Short description shown on the user's receipt. Max 200 chars. */
  note?: string;
  /**
   * A unique key you generate per payment attempt.
   * Aza will deduplicate based on this — safe to retry on network error.
   */
  idempotencyKey: string;
}

export interface AzaPaymentResult {
  transactionId: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  amount: number;
  recipientUsername: string;
  note: string | null;
}

export interface AzaShareOptions {
  title?: string;
  message: string;
}

export interface AzaSDK {
  /**
   * Get the current user's profile.
   * Always available after consent — no extra permission needed beyond USER_PROFILE.
   */
  getUser(): Promise<AzaUser>;

  /**
   * Get the user's current Aza wallet balance in GHS.
   * Requires READ_BALANCE permission to be declared and consented.
   */
  getBalance(): Promise<AzaBalance>;

  /**
   * Request a payment from the user.
   *
   * The Aza app shows a native confirmation dialog — the user must tap "Confirm"
   * before any money moves. Your Promise resolves only after confirmation.
   *
   * Requires MAKE_PAYMENTS permission to be declared and consented.
   */
  requestPayment(params: AzaPaymentRequest): Promise<AzaPaymentResult>;

  /**
   * Close this mini app and return the user to the Aza hub.
   */
  close(): Promise<void>;

  /**
   * Open the native Aza share sheet.
   */
  share(options: AzaShareOptions): Promise<void>;

  /** SDK version string, e.g. "1.0.0" */
  readonly version: string;
}

// ─── Global augmentation ──────────────────────────────────────────────────────

declare global {
  interface Window {
    /** Injected by the Aza native app before page content loads. */
    aza?: AzaSDK;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns `true` when running inside the Aza app with the bridge available.
 */
export function isInsideAza(): boolean {
  return typeof window !== 'undefined' && typeof window.aza !== 'undefined';
}

/**
 * Synchronously returns the `window.aza` bridge.
 * Throws `AzaNotAvailableError` if called outside the Aza app or before the bridge is ready.
 */
export function getAza(): AzaSDK {
  if (!isInsideAza()) {
    throw new AzaNotAvailableError(
      'window.aza is not available. Make sure your app is running inside the Aza mini app player.'
    );
  }
  return window.aza!;
}

/**
 * Waits for the Aza bridge to be injected and returns it.
 *
 * - If `window.aza` is already available, resolves immediately.
 * - If the page loads before the bridge (e.g. in dev), waits for the `azaReady` event.
 * - Rejects after `timeoutMs` (default 5 000 ms) if the bridge never arrives.
 *
 * @example
 * const aza = await waitForAza();
 * const user = await aza.getUser();
 */
export function waitForAza(timeoutMs = 5_000): Promise<AzaSDK> {
  if (isInsideAza()) {
    return Promise.resolve(window.aza!);
  }

  return new Promise<AzaSDK>((resolve, reject) => {
    const timer = setTimeout(() => {
      window.removeEventListener('azaReady', onReady);
      reject(new AzaNotAvailableError(
        `Aza bridge did not initialise within ${timeoutMs}ms. ` +
        'Make sure your app is running inside the Aza mini app player.'
      ));
    }, timeoutMs);

    function onReady() {
      clearTimeout(timer);
      window.removeEventListener('azaReady', onReady);
      if (window.aza) {
        resolve(window.aza);
      } else {
        reject(new AzaNotAvailableError('azaReady fired but window.aza is still undefined.'));
      }
    }

    window.addEventListener('azaReady', onReady);
  });
}

/**
 * Thrown when the Aza SDK is not available in the current environment.
 */
export class AzaNotAvailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AzaNotAvailableError';
  }
}

// ─── React hook (optional, tree-shakeable) ────────────────────────────────────

export type AzaHookState =
  | { status: 'loading' }
  | { status: 'ready'; aza: AzaSDK }
  | { status: 'unavailable'; error: AzaNotAvailableError };

/**
 * React hook that resolves the Aza bridge.
 *
 * @example
 * function MyApp() {
 *   const { status, aza } = useAza();
 *   if (status === 'loading') return <Spinner />;
 *   if (status === 'unavailable') return <p>Open this in Aza</p>;
 *   // aza is fully typed as AzaSDK
 * }
 */
export function useAza(timeoutMs = 5_000): AzaHookState {
  // Lazy require React so the rest of the SDK works without React installed
  // (plain HTML / Vue / Svelte apps don't need React)
  const React = _requireReact();
  if (!React) {
    throw new Error(
      'useAza() requires React. Install react and react-dom, or use waitForAza() instead.'
    );
  }

  const [state, setState] = React.useState<AzaHookState>(
    isInsideAza() ? { status: 'ready', aza: window.aza! } : { status: 'loading' }
  );

  React.useEffect(() => {
    if (state.status === 'ready') return;
    let cancelled = false;

    waitForAza(timeoutMs)
      .then((aza) => { if (!cancelled) setState({ status: 'ready', aza }); })
      .catch((error) => { if (!cancelled) setState({ status: 'unavailable', error }); });

    return () => { cancelled = true; };
  }, []);

  return state;
}

// `require` is resolved by bundlers (webpack/vite/esbuild) at build time.
// Declaring it here avoids a dependency on @types/node while staying type-safe.
declare const require: undefined | ((id: string) => unknown);

function _requireReact(): typeof import('react') | null {
  try {
    if (typeof require === 'undefined') return null;
    return require('react') as typeof import('react');
  } catch {
    return null;
  }
}
