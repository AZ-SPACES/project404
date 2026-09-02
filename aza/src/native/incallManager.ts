import { loadOptionalModule } from './optional';

type InCallManagerApi = typeof import('react-native-incall-manager').default;

/** `undefined` = not tried yet, `null` = not in this binary. */
let cached: InCallManagerApi | null | undefined;

function load(): InCallManagerApi | null {
  if (cached === undefined) {
    cached = loadOptionalModule(() => {
      const mod = require('react-native-incall-manager').default as InCallManagerApi;
      // The package reads NativeModules.InCallManager at import and stores
      // whatever it finds, so importing it succeeds even when the native side
      // is absent — it only fails later, one TypeError per method call. Check
      // the module itself rather than trusting the import.
      const { NativeModules } = require('react-native');
      return NativeModules.InCallManager ? mod : null;
    });
  }
  return cached;
}

export function isInCallManagerAvailable(): boolean {
  return load() !== null;
}

/**
 * Audio routing, ringtones and screen-wake for calls — a no-op when the native
 * module is absent.
 *
 * Silence is the right degradation here: every one of these methods is a side
 * effect on the audio session, so skipping them leaves a call that still
 * connects and still has audio, just routed by OS defaults with no ringback.
 * Throwing instead would abort call setup over a ringtone.
 */
export const InCallManager: InCallManagerApi = new Proxy({} as InCallManagerApi, {
  get(_target, property) {
    const mod = load();
    if (!mod) return () => undefined;
    const value = (mod as unknown as Record<string | symbol, unknown>)[property];
    // Bound, because the library's methods keep state on `this` and would
    // otherwise write it onto this proxy instead of onto the instance.
    return typeof value === 'function' ? value.bind(mod) : value;
  },
});
