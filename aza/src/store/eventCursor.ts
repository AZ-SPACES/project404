/**
 * Cursor into the server's durable event log.
 *
 * The backend appends every durable real-time event to a per-user Redis Stream
 * and stamps the entry id onto the event as `id`. Remembering the last id we
 * processed lets a reconnecting client ask for exactly what it missed
 * (/app/resync) instead of losing it — pub/sub delivery alone is fire-and-forget,
 * so anything published while the app was backgrounded or off network was gone.
 *
 * Persisted per user and per queue: cursors are meaningless across accounts, and
 * each queue is replayed independently by whichever provider owns it.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export type EventDest = 'chat' | 'notifications';

const KEY_PREFIX = 'aza_ws_cursor_v1';

/** Cursors are read on every reconnect, so keep the live copy in memory. */
const cursors = new Map<string, string>();

const storageKey = (userId: string, dest: EventDest) => `${KEY_PREFIX}:${userId}:${dest}`;

/**
 * Order two stream ids ("<millis>-<seq>"). Both halves are numbers of unbounded
 * width, so they must compare numerically — "9-0" is older than "10-0" but
 * sorts after it as a string.
 */
function compareIds(a: string, b: string): number {
  const [aMs, aSeq] = splitId(a);
  const [bMs, bSeq] = splitId(b);
  return aMs !== bMs ? aMs - bMs : aSeq - bSeq;
}

function splitId(id: string): [number, number] {
  const dash = id.indexOf('-');
  if (dash < 0) return [Number(id) || 0, 0];
  return [Number(id.slice(0, dash)) || 0, Number(id.slice(dash + 1)) || 0];
}

/** Pull the persisted cursor into memory. Call once per session, before connecting. */
export async function loadCursor(userId: string, dest: EventDest): Promise<string | null> {
  const key = storageKey(userId, dest);
  const cached = cursors.get(key);
  if (cached) return cached;
  try {
    const stored = await AsyncStorage.getItem(key);
    if (stored) cursors.set(key, stored);
    return stored;
  } catch {
    return null;
  }
}

export function getCursor(userId: string, dest: EventDest): string | null {
  return cursors.get(storageKey(userId, dest)) ?? null;
}

/**
 * Move the cursor forward. Ignores ids we are already past: a replay can
 * interleave with live events, and the two arrive in no guaranteed order
 * relative to each other.
 */
export function advanceCursor(userId: string, dest: EventDest, id: string): void {
  if (!id) return;
  const key = storageKey(userId, dest);
  const current = cursors.get(key);
  if (current && compareIds(id, current) <= 0) return;
  cursors.set(key, id);
  // Fire-and-forget: a cursor lost to a crashed write costs one extra replay,
  // and every event it would re-deliver is applied idempotently.
  AsyncStorage.setItem(key, id).catch(() => {});
}

/**
 * Jump the cursor to a server-supplied position, forward or back. Used when the
 * server reports our cursor has aged out of the log and hands us its current
 * tip, so the next reconnect resumes from there instead of reporting the same
 * gap forever.
 */
export function resetCursor(userId: string, dest: EventDest, id: string | null): void {
  const key = storageKey(userId, dest);
  if (!id) {
    cursors.delete(key);
    AsyncStorage.removeItem(key).catch(() => {});
    return;
  }
  cursors.set(key, id);
  AsyncStorage.setItem(key, id).catch(() => {});
}

/** Drop every cached cursor. Called on sign-out so the next account starts clean. */
export function clearCursors(): void {
  cursors.clear();
}

/**
 * Ids seen this session, so a replay overlapping events we already handled is
 * cheap to discard. Delivery is at-least-once by design; the store's merges are
 * idempotent anyway, so this is an optimization, not a correctness guard — which
 * is why it is memory-only and bounded.
 */
const RECENT_LIMIT = 500;
const recentIds = new Set<string>();
const recentOrder: string[] = [];

/** True if this id has already been processed this session. */
export function isDuplicate(id: string): boolean {
  return recentIds.has(id);
}

export function markSeen(id: string): void {
  if (recentIds.has(id)) return;
  recentIds.add(id);
  recentOrder.push(id);
  if (recentOrder.length > RECENT_LIMIT) {
    const evicted = recentOrder.shift();
    if (evicted) recentIds.delete(evicted);
  }
}

export function clearSeen(): void {
  recentIds.clear();
  recentOrder.length = 0;
}
