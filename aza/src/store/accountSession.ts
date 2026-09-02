/**
 * Account-session registry.
 *
 * Client state falls into two scopes:
 *
 *   - **device** — belongs to the phone, not the person. Theme, layout, whether
 *     media auto-saves to the gallery. Survives logout by design.
 *   - **account** — belongs to whoever is signed in. Drafts, starred messages,
 *     pinned chats, per-chat themes. Must not survive logout, and must never be
 *     visible to the next account on the same device.
 *
 * Before this module, account-scoped state was device-scoped by accident: each
 * store picked its own AsyncStorage key with no user id in it, and remembering
 * to wipe on logout was a per-store judgement call that most stores got wrong.
 * A store now declares its scope once, at creation, and the lifecycle is handled
 * for it — the default is safe rather than leaky.
 *
 * `beginAccountSession` runs when the signed-in user id is known;
 * `endAccountSession` runs on logout, before anything else tears down.
 */

type AccountScopedStore = {
  /** Load this store's slice for `userId`. */
  hydrate: (userId: string) => void | Promise<void>;
  /**
   * Drop in-memory state and erase the on-disk slice. Receives the id of the
   * account being torn down because, by the time this runs, the session is
   * already closed and the id is no longer resolvable from the module.
   */
  clear: (userId: string | null) => void | Promise<void>;
};

const stores = new Set<AccountScopedStore>();

let currentUserId: string | null = null;

/**
 * The signed-in user id, or null when no session is open.
 *
 * `accountStorage` keys off this, so a null return is what makes reads and
 * writes fail closed while logged out.
 */
export function getAccountUserId(): string | null {
  return currentUserId;
}

/**
 * Register a store to be hydrated on login and wiped on logout.
 *
 * Stores are module singletons created on first import, which can happen at any
 * point — including after login, when a chat screen pulls one in for the first
 * time. A store registering into an already-open session is hydrated on the
 * spot, so late imports behave the same as early ones.
 */
export function registerAccountScopedStore(store: AccountScopedStore): () => void {
  stores.add(store);
  if (currentUserId) {
    void Promise.resolve(store.hydrate(currentUserId)).catch(() => {});
  }
  return () => {
    stores.delete(store);
  };
}

/**
 * Open a session for `userId` and hydrate every account-scoped store.
 *
 * Idempotent for the same id — the identity bootstrap that calls this can run
 * more than once per launch. A different id means the device switched accounts
 * without a clean logout, so the previous session is torn down first.
 */
export async function beginAccountSession(userId: string): Promise<void> {
  if (currentUserId === userId) return;
  if (currentUserId) await endAccountSession();

  currentUserId = userId;
  await Promise.all(
    [...stores].map((s) => Promise.resolve(s.hydrate(userId)).catch(() => {})),
  );
}

/**
 * Close the session and wipe every account-scoped store.
 *
 * The id is cleared *first*, before any store is touched. `accountStorage`
 * refuses to read or write without one, so from that line on nothing can
 * re-create a slice we are in the middle of deleting — the same trailing-write
 * hazard `chatStore.resetForLogout` cancels its debounced saves to avoid.
 */
export async function endAccountSession(): Promise<void> {
  const userId = currentUserId;
  currentUserId = null;

  await Promise.all(
    [...stores].map((s) => Promise.resolve(s.clear(userId)).catch(() => {})),
  );
}
