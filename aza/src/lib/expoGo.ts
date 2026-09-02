import Constants, { ExecutionEnvironment } from 'expo-constants';

/**
 * True when this JS is running inside the Expo Go sandbox rather than a build
 * of our own.
 *
 * Expo Go ships a fixed set of native modules, so anything we add beyond that
 * set — WebRTC, InCallManager, view-shot, the watch bridge, the native tab bar
 * — simply is not in the binary. Reaching for one there throws
 * "Invariant Violation: Your JavaScript code tried to access a native module
 * that doesn't exist" *while the bundle is still evaluating*, which takes the
 * whole app down before React ever mounts and before an error boundary exists
 * to catch it.
 *
 * So this is checked before requiring those modules, never after: see
 * src/native/optional.ts. Everything gated on it degrades to a no-op or a
 * clear message; a development build (`npx expo run:ios` / `run:android`) is
 * still required to exercise the real feature.
 */
export const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
