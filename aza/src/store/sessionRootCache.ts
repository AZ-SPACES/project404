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

export async function loadSessionRoot(
  selfUserId: string,
  peerUserId: string,
  expectedPeerIdentityPub: Uint8Array,
): Promise<Uint8Array | null> {
  const raw = await SecureStore.getItemAsync(KEY(selfUserId, peerUserId), SECURE_OPTS);
  if (!raw) return null;
  let parsed: StoredRoot;
  try {
    parsed = JSON.parse(raw) as StoredRoot;
  } catch {
    return null;
  }
  // Refuse to return the root if the peer's identity has rotated — we'd
  // be decrypting under a key derived against the old identity, which is
  // wrong. The caller will fall back to a fresh X3DH on the next first-message.
  const cachedPub = base64ToBytes(parsed.peerIdentityPub);
  if (cachedPub.length !== expectedPeerIdentityPub.length) return null;
  for (let i = 0; i < cachedPub.length; i++) {
    if (cachedPub[i] !== expectedPeerIdentityPub[i]) return null;
  }
  return base64ToBytes(parsed.rootKey);
}

export async function saveSessionRoot(
  selfUserId: string,
  peerUserId: string,
  rootKey: Uint8Array,
  peerIdentityPub: Uint8Array,
): Promise<void> {
  const payload: StoredRoot = {
    rootKey: bytesToBase64(rootKey),
    peerIdentityPub: bytesToBase64(peerIdentityPub),
  };
  await SecureStore.setItemAsync(
    KEY(selfUserId, peerUserId),
    JSON.stringify(payload),
    SECURE_OPTS,
  );
}

export async function deleteSessionRoot(
  selfUserId: string,
  peerUserId: string,
): Promise<void> {
  await SecureStore.deleteItemAsync(KEY(selfUserId, peerUserId), SECURE_OPTS);
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

/** Mark a peer as having a session root stored. Idempotent. */
export async function indexSessionRoot(
  selfUserId: string,
  peerUserId: string,
): Promise<void> {
  const ids = await readIndex(selfUserId);
  if (ids.includes(peerUserId)) return;
  ids.push(peerUserId);
  await writeIndex(selfUserId, ids);
}

/** Drop every session root for a user. Called on logout / E2EE reset. */
export async function wipeAllSessionRoots(selfUserId: string): Promise<void> {
  const ids = await readIndex(selfUserId);
  await Promise.all(ids.map((id) => deleteSessionRoot(selfUserId, id)));
  await SecureStore.deleteItemAsync(INDEX_KEY(selfUserId), SECURE_OPTS);
}
