/**
 * Persistent cache of X3DH session root keys.
 *
 * Stored in SecureStore — these keys can decrypt every message in the
 * session, so they need the same protection as the identity private key.
 *
 * Layout: one SecureStore entry per (selfUserId, peerUserId), value is
 * { rootKey: base64(32 bytes), peerIdentityFingerprint: base64(sha256(IK)).
 * The fingerprint is used to detect a mid-session peer-identity swap:
 * if the peer's IK changes underneath us, the cached root key is
 * meaningless and we should re-establish.
 *
 * Latency: every text send used to pay a SecureStore read *and* a SecureStore
 * write before the message could be published, and each of those is a Keychain
 * / Android-Keystore round trip on the JS thread. Both now go through an
 * in-memory layer: reads are served from RAM after the first miss, and writes
 * update RAM synchronously then drain to SecureStore in the background so the
 * send path never awaits the disk. The drain starts immediately (no debounce),
 * so the durable copy still lands within a few milliseconds of the send.
 */

import * as SecureStore from 'expo-secure-store';

import { base64ToBytes, bytesToBase64 } from '../crypto/codec';
// We avoid pulling in @noble/hashes here — peerIdentityCache already keeps
// the full IK_pub on disk for TOFU. For the fingerprint we just keep the
// raw IK_pub bytes (it's 32 bytes, plenty small) and compare directly.

const KEY = (selfUserId: string, peerId: string) =>
  `aza_e2ee_session_${selfUserId}_${peerId}`;
const SECURE_OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

type StoredRoot = {
  /** base64(32-byte HKDF output) */
  rootKey: string;
  /** base64(peer identity public key at the moment the session was established) */
  peerIdentityPub: string;
};

// ─── In-memory layer ────────────────────────────────────────────────────────
// `memory` mirrors what is (or is about to be) on disk. A `null` value is a
// negative cache entry: we read SecureStore and there was nothing there, so a
// later read can skip the round trip instead of missing again on every send.
const memory = new Map<string, StoredRoot | null>();
const inFlightReads = new Map<string, Promise<StoredRoot | null>>();
const pendingWrites = new Map<string, StoredRoot | null>();
let drain: Promise<void> | null = null;

/** Kick the write-behind loop. Coalesces repeat writes to the same key. */
function scheduleDrain(): void {
  if (drain) return;
  drain = (async () => {
    try {
      while (pendingWrites.size > 0) {
        const next = pendingWrites.entries().next();
        if (next.done) break;
        const [key, payload] = next.value;
        pendingWrites.delete(key);
        try {
          if (payload === null) {
            await SecureStore.deleteItemAsync(key, SECURE_OPTS);
          } else {
            await SecureStore.setItemAsync(key, JSON.stringify(payload), SECURE_OPTS);
          }
        } catch (e) {
          console.warn('[e2ee] session-root write failed', e);
        }
      }
    } finally {
      drain = null;
    }
  })();
}

/**
 * Await every queued session-root write. Call before backgrounding the app or
 * in tests; the send path deliberately does not.
 */
export async function flushSessionRoots(): Promise<void> {
  while (drain) {
    await drain;
  }
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

async function readStored(key: string): Promise<StoredRoot | null> {
  if (memory.has(key)) return memory.get(key) ?? null;

  const existing = inFlightReads.get(key);
  if (existing) return existing;

  const read = (async () => {
    let parsed: StoredRoot | null = null;
    try {
      const raw = await SecureStore.getItemAsync(key, SECURE_OPTS);
      if (raw) parsed = JSON.parse(raw) as StoredRoot;
    } catch {
      parsed = null;
    }
    if (!memory.has(key)) memory.set(key, parsed);
    inFlightReads.delete(key);
    return memory.get(key) ?? null;
  })();

  inFlightReads.set(key, read);
  return read;
}

export async function loadSessionRoot(
  selfUserId: string,
  peerUserId: string,
  expectedPeerIdentityPub: Uint8Array,
): Promise<Uint8Array | null> {
  const stored = await readStored(KEY(selfUserId, peerUserId));
  if (!stored) return null;
  if (!sameBytes(base64ToBytes(stored.peerIdentityPub), expectedPeerIdentityPub)) return null;
  return base64ToBytes(stored.rootKey);
}

/**
 * Record the next root key for a session.
 *
 * The in-memory copy is updated synchronously, so a `loadSessionRoot` later in
 * the same tick already sees the ratcheted value. The SecureStore write is
 * queued and drains in the background; awaiting this call does not wait for
 * the disk.
 *
 * `rootKey` is encoded up front, so the caller is free to zero its buffer as
 * soon as this returns.
 */
export async function saveSessionRoot(
  selfUserId: string,
  peerUserId: string,
  rootKey: Uint8Array,
  peerIdentityPub: Uint8Array,
): Promise<void> {
  const key = KEY(selfUserId, peerUserId);
  const payload: StoredRoot = {
    rootKey: bytesToBase64(rootKey),
    peerIdentityPub: bytesToBase64(peerIdentityPub),
  };
  memory.set(key, payload);
  pendingWrites.set(key, payload);
  scheduleDrain();
}

export async function deleteSessionRoot(
  selfUserId: string,
  peerUserId: string,
): Promise<void> {
  const key = KEY(selfUserId, peerUserId);
  memory.set(key, null);
  pendingWrites.delete(key);
  await SecureStore.deleteItemAsync(key, SECURE_OPTS);
}

/**
 * Wipe ALL session roots for a user. SecureStore can't enumerate keys, so
 * we keep a separate index list of peer ids whose roots we hold.
 */
const INDEX_KEY = (selfUserId: string) => `aza_e2ee_session_idx_${selfUserId}`;

async function readIndex(selfUserId: string): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(INDEX_KEY(selfUserId), SECURE_OPTS);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

async function writeIndex(selfUserId: string, ids: string[]): Promise<void> {
  await SecureStore.setItemAsync(
    INDEX_KEY(selfUserId),
    JSON.stringify(ids),
    SECURE_OPTS,
  );
}

/**
 * Mark a peer as having a session root stored. Idempotent, and memoised so the
 * steady-state send path skips the index read/write entirely.
 */
const indexed = new Set<string>();
export async function indexSessionRoot(
  selfUserId: string,
  peerUserId: string,
): Promise<void> {
  const memo = `${selfUserId} ${peerUserId}`;
  if (indexed.has(memo)) return;
  const ids = await readIndex(selfUserId);
  if (!ids.includes(peerUserId)) {
    ids.push(peerUserId);
    await writeIndex(selfUserId, ids);
  }
  indexed.add(memo);
}

/** Drop every session root for a user. Called on logout / E2EE reset. */
export async function wipeAllSessionRoots(selfUserId: string): Promise<void> {
  const ids = await readIndex(selfUserId);
  // Drop queued writes first so a mid-flight drain can't resurrect a root
  // after we've deleted it from disk.
  pendingWrites.clear();
  await flushSessionRoots();
  memory.clear();
  indexed.clear();
  await Promise.all(ids.map((id) => deleteSessionRoot(selfUserId, id)));
  await SecureStore.deleteItemAsync(INDEX_KEY(selfUserId), SECURE_OPTS);
}
