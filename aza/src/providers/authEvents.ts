/**
 * Lightweight auth-lifecycle event hub.
 *
 * Providers that need to react to login/logout/token-rotation can subscribe
 * here without taking a hard dependency on AuthProvider (which would create
 * import cycles with the API layer and the chat store).
 *
 * Events are fire-and-forget; subscribers must be non-throwing.
 */

export type AuthEvent =
  | { type: 'logout' }
  | { type: 'tokenRotated'; accessToken: string };

type Listener = (e: AuthEvent) => void | Promise<void>;

const listeners = new Set<Listener>();

export function subscribeAuthEvents(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function emitAuthEvent(e: AuthEvent): void {
  for (const l of listeners) {
    try {
      const r = l(e);
      if (r && typeof (r as Promise<void>).catch === 'function') {
        (r as Promise<void>).catch((err) =>
          // eslint-disable-next-line no-console
          console.warn('[authEvents] listener rejected', err),
        );
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[authEvents] listener threw', err);
    }
  }
}
