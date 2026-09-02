import { isExpoGo } from '../lib/expoGo';

/**
 * Thrown when a feature is asked for that this binary cannot provide. The
 * message is user-facing: it names the feature and says what to do about it.
 */
export class NativeModuleUnavailableError extends Error {
  constructor(feature: string) {
    super(
      isExpoGo
        ? `${feature} needs native code that Expo Go does not include. Run a development build (npx expo run:ios / npx expo run:android) to use it.`
        : `${feature} needs native code that is missing from this build. Rebuild the app to use it.`,
    );
    this.name = 'NativeModuleUnavailableError';
  }
}

export function isNativeModuleUnavailable(error: unknown): boolean {
  return error instanceof NativeModuleUnavailableError;
}

/**
 * Resolve a native-backed package, or `null` when this binary does not have it.
 *
 * `load` must be a bare `() => require('pkg')`. The require has to stay inside
 * the callback: Metro still records the dependency and bundles the package, but
 * only runs its module factory when we call it, which is the entire point —
 * several of these packages touch their native module at the top level and
 * throw as they evaluate. A static `import` would run that on app start,
 * before any try/catch of ours exists.
 *
 * Both guards are load-bearing. The Expo Go check keeps us from triggering the
 * throw at all (it would otherwise surface as a red box even when caught), and
 * the try/catch covers the other case this has to survive: a development or
 * production build made before the dependency was added, reached by an OTA
 * update that expects it.
 */
export function loadOptionalModule<T>(load: () => T): T | null {
  if (isExpoGo) return null;
  try {
    return load();
  } catch {
    return null;
  }
}
