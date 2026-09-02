/**
 * One-time removal of the pre-account-scoping storage keys.
 *
 * These keys were written device-globally, with no user id and no logout wipe.
 * Several held message content in plaintext — saved, starred and pinned
 * messages, and unsent drafts — which meant the next account to sign in on a
 * device could read the previous account's messages, defeating the encrypted
 * thread cache that `encryptedMessageStore` maintains a few files away.
 *
 * Those stores are now account-scoped (see `persistence`), so nothing writes
 * these keys any more. That stops the bleeding but doesn't clean the wound:
 * data already on disk stays there until something deletes it. This does.
 *
 * Runs once per install, guarded by a marker key, and is safe to call on every
 * launch. Deliberately not account-scoped — it has to run before anyone signs
 * in, precisely because what it deletes may belong to someone who already
 * signed out.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const CLEANUP_MARKER = 'aza_legacy_storage_purged_v1';

/**
 * Exact keys, superseded by their account-scoped equivalents.
 * The `_vN` suffixes were the old versioning scheme; schema versions now live
 * in the `persist` config, so the new keys carry no suffix.
 */
const LEGACY_KEYS = [
  // Held plaintext message content.
  'aza_drafts_v1',
  'aza_saved_messages_v1',
  'aza_starred_messages_v1',
  'aza_pinned_v2',
  // Held chat and payment-request state tied to one account.
  'aza_pinned_chats_v1',
  'aza_chat_locks_v1',
  'aza_chat_filters_v1',
  'aza_chat_themes_v2',
  'aza_chat_themes_v1',
  'aza_reactions_v1',
  'aza_read_receipts_v1',
  'aza_scheduled_v1',
  'aza_poll_votes_v1',
  'aza_settled_requests_v1',
  'aza_mute_duration_v1',
  'aza_online_alerts_v1',
  // Full profile — name, handle, email, phone, home address — written on every
  // fetch and never read back by anything.
  'aza_profile',
];

/**
 * Prefixes whose key space is unbounded and has to be swept rather than listed.
 *
 * Notification preferences were keyed by the bearer token itself, so every
 * token rotation orphaned the previous key and left a JWT sitting in a key
 * name. They are keyed by user id now.
 */
const LEGACY_KEY_PREFIXES = ['@notification_prefs_'];

export async function purgeLegacyGlobalStorage(): Promise<void> {
  try {
    if (await AsyncStorage.getItem(CLEANUP_MARKER)) return;

    const allKeys = await AsyncStorage.getAllKeys();
    const doomed = allKeys.filter(
      (key) =>
        LEGACY_KEYS.includes(key) ||
        LEGACY_KEY_PREFIXES.some((prefix) => key.startsWith(prefix)),
    );

    if (doomed.length) await AsyncStorage.multiRemove(doomed);
    await AsyncStorage.setItem(CLEANUP_MARKER, String(Date.now()));
  } catch {
    // Leaving the marker unset means we retry on the next launch, which is the
    // behaviour we want — better to sweep twice than to skip the sweep.
  }
}
