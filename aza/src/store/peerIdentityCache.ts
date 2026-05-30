/**
 * Trust-on-first-use (TOFU) cache of peer identity public keys.
 *
 * The first time we see a peer's identity public key we record it; on every
 * subsequent fetch we compare. A mismatch means either the peer rotated
 * their key (legitimate but worth alerting the user) or the server is
 * impersonating them. Either way, the UI should warn and ask the user
 * to re-verify the safety number before sending further.
 *
 * Stored as plaintext in AsyncStorage — public keys aren't sensitive.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { bytesToBase64, base64ToBytes, constantTimeEqual } from '../crypto/codec';

const KEY = (selfUserId: string, peerId: string) =>
  `aza_peer_idpk_${selfUserId}_${peerId}`;
const SEEN_AT_KEY = (selfUserId: string, peerId: string) =>
  `aza_peer_idpk_at_${selfUserId}_${peerId}`;

export type PeerIdentityState =
  | { kind: 'first-seen' }
  | { kind: 'unchanged'; firstSeenAt: number }
  | { kind: 'changed'; previous: Uint8Array; firstSeenAt: number };

/**
 * Record (or compare against) the cached peer identity. Returns a state
 * describing what happened — callers use it to surface key-rotation warnings.
 *
 * NOTE: when `changed` is returned we DO update the cache to the new key.
 * The user-facing warning is one-shot; once acknowledged in the UI, future
 * fetches return `unchanged`.
 */
export async function recordPeerIdentity(
  selfUserId: string,
  peerId: string,
  identityPublicKey: Uint8Array,
): Promise<PeerIdentityState> {
  const existingB64 = await AsyncStorage.getItem(KEY(selfUserId, peerId));
  const now = Date.now();
  if (!existingB64) {
    await AsyncStorage.multiSet([
      [KEY(selfUserId, peerId), bytesToBase64(identityPublicKey)],
      [SEEN_AT_KEY(selfUserId, peerId), String(now)],
    ]);
    return { kind: 'first-seen' };
  }
  const previous = base64ToBytes(existingB64);
  if (constantTimeEqual(previous, identityPublicKey)) {
    const firstSeenAt = Number(
      (await AsyncStorage.getItem(SEEN_AT_KEY(selfUserId, peerId))) || now,
    );
    return { kind: 'unchanged', firstSeenAt };
  }
  // Mismatch — update to the new key but flag the change.
  const firstSeenAt = Number(
    (await AsyncStorage.getItem(SEEN_AT_KEY(selfUserId, peerId))) || now,
  );
  await AsyncStorage.multiSet([
    [KEY(selfUserId, peerId), bytesToBase64(identityPublicKey)],
    [SEEN_AT_KEY(selfUserId, peerId), String(now)],
  ]);
  return { kind: 'changed', previous, firstSeenAt };
}

/** Wipe all peer-identity caches for a user. Called on logout. */
export async function wipePeerIdentityCache(selfUserId: string): Promise<void> {
  const allKeys = await AsyncStorage.getAllKeys();
  const ours = allKeys.filter(
    (k) =>
      k.startsWith(`aza_peer_idpk_${selfUserId}_`) ||
      k.startsWith(`aza_peer_idpk_at_${selfUserId}_`),
  );
  if (ours.length) await AsyncStorage.multiRemove(ours);
}
