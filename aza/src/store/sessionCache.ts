/**
 * Per-peer "first-message-sent" flag.
 *
 * The X3DH preKeyId in our SendMessagePayload is only meaningful on the
 * very first message we send in a new session. Earlier we approximated
 * "first" with `!chat.lastMessageAt`, which is wrong when the peer sent
 * the opener — our first reply omitted preKeyId even though it's our
 * first contact-from-this-side.
 *
 * This flag tracks whether *we* have sent at least one message to this
 * peer using our current identity. Wiped on logout or E2EE reset.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = (selfUserId: string, peerId: string) =>
  `aza_session_established_${selfUserId}_${peerId}`;

export async function hasSessionWithPeer(
  selfUserId: string,
  peerId: string,
): Promise<boolean> {
  const v = await AsyncStorage.getItem(KEY(selfUserId, peerId));
  return v === '1';
}

export async function markSessionEstablished(
  selfUserId: string,
  peerId: string,
): Promise<void> {
  await AsyncStorage.setItem(KEY(selfUserId, peerId), '1');
}

/** Wipe all session-established flags for a user. */
export async function wipeSessionFlags(selfUserId: string): Promise<void> {
  const allKeys = await AsyncStorage.getAllKeys();
  const ours = allKeys.filter((k) =>
    k.startsWith(`aza_session_established_${selfUserId}_`),
  );
  if (ours.length) await AsyncStorage.multiRemove(ours);
}
