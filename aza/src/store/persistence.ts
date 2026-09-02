/**
 * One way to persist a Zustand store.
 *
 * Before this module there were three: the `persist` middleware, a bare
 * `AsyncStorage.getItem().then()` at file scope, and a hand-written `load()`
 * the caller had to remember to invoke. None of them declared a scope, none
 * declared a schema version, and the import-time variants raced the first
 * render with no way to tell hydrated-empty from not-yet-hydrated.
 *
 * Every persisted store now goes through `accountPersistOptions` or
 * `devicePersistOptions`, which forces both questions to be answered:
 *
 *   - **account** — belongs to the signed-in user. Namespaced by user id,
 *     hydrated on login, erased on logout. See `accountSession`.
 *   - **device** — belongs to the phone. Survives logout by design.
 *
 * Both require a `version`, so a shape change can ship a `migrate` instead of
 * rehydrating malformed state into a running app.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';
import { getAccountUserId, registerAccountScopedStore } from './accountSession';

/** On-disk key for a store slice belonging to one account. */
export function accountStorageKey(name: string, userId: string): string {
  return `${name}__${userId}`;
}

/**
 * An AsyncStorage-shaped backend that resolves the account id at call time.
 *
 * Two properties matter. Keys carry the user id, so one account can never read
 * another's slice. And with no session open every operation is a no-op, so a
 * screen still mounted through a logout cannot write the outgoing user's data
 * back to disk after the wipe.
 */
const accountStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const userId = getAccountUserId();
    if (!userId) return null;
    return AsyncStorage.getItem(accountStorageKey(name, userId));
  },
  setItem: async (name: string, value: string): Promise<void> => {
    const userId = getAccountUserId();
    if (!userId) return;
    await AsyncStorage.setItem(accountStorageKey(name, userId), value);
  },
  removeItem: async (name: string): Promise<void> => {
    const userId = getAccountUserId();
    if (!userId) return;
    await AsyncStorage.removeItem(accountStorageKey(name, userId));
  },
};

type PersistOptionsInput<T> = {
  /** Base key. The account id is appended for account-scoped stores. */
  name: string;
  /** Bump whenever the persisted shape changes, and add a `migrate`. */
  version: number;
  /** Persist only these fields. Actions are never persisted. */
  partialize?: (state: T) => unknown;
  migrate?: (persisted: unknown, from: number) => unknown;
};

function baseOptions<T>(options: PersistOptionsInput<T>) {
  return {
    name: options.name,
    version: options.version,
    ...(options.partialize ? { partialize: options.partialize as (s: T) => T } : {}),
    ...(options.migrate ? { migrate: options.migrate } : {}),
  };
}

/**
 * `persist` options for a store whose data belongs to the signed-in user.
 *
 * `skipHydration` is the load-bearing part: the store is created at import
 * time, when the account id usually isn't known yet. Hydration is deferred to
 * `beginAccountSession`, which knows who is signed in. Pair every call with
 * `bindAccountStore`, or the store will never hydrate.
 */
export function accountPersistOptions<T>(options: PersistOptionsInput<T>) {
  return {
    ...baseOptions(options),
    storage: createJSONStorage(() => accountStorage),
    skipHydration: true,
  };
}

/**
 * `persist` options for a store whose data belongs to the device, not the
 * person — appearance, layout, per-device toggles. Hydrates at import time and
 * survives logout, both intentionally.
 */
export function devicePersistOptions<T>(options: PersistOptionsInput<T>) {
  return {
    ...baseOptions(options),
    storage: createJSONStorage(() => AsyncStorage),
  };
}

/**
 * The slice of the zustand persist API this module needs. Declared structurally
 * so it doesn't pin us to a `zustand/middleware` type that moves between minors.
 */
type PersistedStore<S> = {
  setState: (partial: Partial<S>) => void;
  persist: { rehydrate: () => Promise<void> | void };
};

/**
 * Register an account-scoped store with the session lifecycle.
 *
 * `empty` must return the zero value for every persisted field — it is what the
 * store is reset to on logout, and a field left out of it keeps that field's
 * data in memory for the next account.
 */
export function bindAccountStore<S>(
  store: PersistedStore<S>,
  { name, empty }: { name: string; empty: () => Partial<S> },
): void {
  registerAccountScopedStore({
    hydrate: async () => {
      await store.persist.rehydrate();
    },
    clear: async (userId) => {
      store.setState(empty());
      // The session is already closed, so accountStorage would refuse to touch
      // this — delete by the explicit id we were handed instead.
      if (userId) {
        try {
          await AsyncStorage.removeItem(accountStorageKey(name, userId));
        } catch {
          // Best effort: the in-memory wipe above is what the UI reads.
        }
      }
    },
  });
}
