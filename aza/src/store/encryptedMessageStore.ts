/**
 * Encrypted-at-rest message cache.
 *
 * Per chat, we store the decrypted message thread in AsyncStorage but
 * AES-256-GCM-encrypted under a per-device master key kept in SecureStore.
 * That gives us:
 *   - fast cold-start reads (AsyncStorage holds the bulk, not SecureStore which
 *     has size limits on iOS),
 *   - confidentiality if the device's app sandbox is exfiltrated without keychain access,
 *   - the ability to wipe everything (clear the master key) and immediately
 *     render every stored thread unreadable.
 */

import '../crypto/random';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { gcm } from '@noble/ciphers/aes.js';
import { randomBytes } from '@noble/ciphers/utils.js';

import {
  base64ToBytes,
  bytesToBase64,
  bytesToUtf8,
  utf8ToBytes,
} from '../crypto/codec';
import type { LocalMessage } from './chatTypes';

const MASTER_KEY_STORE = (uid: string) => `aza_chat_master_${uid}`;
const THREAD_KEY = (uid: string, chatId: string) => `aza_chat_thread_${uid}_${chatId}`;
const SECURE_OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

async function getOrCreateMasterKey(userId: string): Promise<Uint8Array> {
  const existing = await SecureStore.getItemAsync(MASTER_KEY_STORE(userId), SECURE_OPTS);
  if (existing) return base64ToBytes(existing);
  const key = randomBytes(32);
  await SecureStore.setItemAsync(MASTER_KEY_STORE(userId), bytesToBase64(key), SECURE_OPTS);
  return key;
}

async function encryptBlob(userId: string, plaintext: string): Promise<string> {
  const key = await getOrCreateMasterKey(userId);
  const nonce = randomBytes(12);
  const aad = utf8ToBytes(`aza.chat.cache.v1|${userId}`);
  const ct = gcm(key, nonce, aad).encrypt(utf8ToBytes(plaintext));
  const out = new Uint8Array(nonce.length + ct.length);
  out.set(nonce, 0);
  out.set(ct, nonce.length);
  return bytesToBase64(out);
}

async function decryptBlob(userId: string, blob: string): Promise<string | null> {
  try {
    const key = await getOrCreateMasterKey(userId);
    const bytes = base64ToBytes(blob);
    if (bytes.length < 12 + 16) return null;
    const nonce = bytes.slice(0, 12);
    const ct = bytes.slice(12);
    const aad = utf8ToBytes(`aza.chat.cache.v1|${userId}`);
    const pt = gcm(key, nonce, aad).decrypt(ct);
    return bytesToUtf8(pt);
  } catch {
    return null;
  }
}

function isExpired(m: LocalMessage, now: number): boolean {
  return typeof m.expiresAt === 'number' && m.expiresAt > 0 && m.expiresAt <= now;
}

/** Load all cached messages for a chat. Returns [] on cache miss or decryption failure.
 *  Expired disappearing messages are filtered out — we trust the local clock as a
 *  defense-in-depth measure when the server tombstone WS frame hasn't arrived yet.
 */
export async function loadCachedThread(
  userId: string,
  chatId: string,
): Promise<LocalMessage[]> {
  const blob = await AsyncStorage.getItem(THREAD_KEY(userId, chatId));
  if (!blob) return [];
  const json = await decryptBlob(userId, blob);
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as LocalMessage[];
    const now = Date.now();
    return parsed.filter((m) => !isExpired(m, now));
  } catch {
    return [];
  }
}

/** Persist (overwrite) a chat thread. Drops messages older than 90 days *and*
 *  any disappearing messages whose expiresAt is in the past.
 */
export async function saveCachedThread(
  userId: string,
  chatId: string,
  messages: LocalMessage[],
): Promise<void> {
  const now = Date.now();
  const ageCutoff = now - 90 * 24 * 60 * 60 * 1000;
  const trimmed = messages.filter(
    (m) => m.timestamp >= ageCutoff && !isExpired(m, now),
  );
  const blob = await encryptBlob(userId, JSON.stringify(trimmed));
  await AsyncStorage.setItem(THREAD_KEY(userId, chatId), blob);
}

/** Drop a single chat's cache. */
export async function clearCachedThread(userId: string, chatId: string): Promise<void> {
  await AsyncStorage.removeItem(THREAD_KEY(userId, chatId));
}

/**
 * Decrypt and return every cached thread for this user, keyed by chatId.
 * Used for history transfers and backups — the caller re-encrypts before
 * anything leaves the device.
 */
export async function exportAllThreads(
  userId: string,
): Promise<Record<string, LocalMessage[]>> {
  const allKeys = await AsyncStorage.getAllKeys();
  const prefix = `aza_chat_thread_${userId}_`;
  const threads: Record<string, LocalMessage[]> = {};
  for (const key of allKeys) {
    if (!key.startsWith(prefix)) continue;
    const chatId = key.slice(prefix.length);
    const messages = await loadCachedThread(userId, chatId);
    if (messages.length > 0) threads[chatId] = messages;
  }
  return threads;
}

/**
 * Merge imported threads (from a transfer or backup restore) into the local
 * cache. Existing local messages win on id collision — the device's own state
 * is fresher than a snapshot.
 */
export async function importThreads(
  userId: string,
  threads: Record<string, LocalMessage[]>,
): Promise<number> {
  let imported = 0;
  for (const [chatId, incoming] of Object.entries(threads)) {
    if (!Array.isArray(incoming) || incoming.length === 0) continue;
    const existing = await loadCachedThread(userId, chatId);
    const seen = new Set<string>();
    for (const m of existing) {
      if (m.serverId) seen.add(m.serverId);
      if (m.clientId) seen.add(m.clientId);
    }
    const merged = [...existing];
    for (const m of incoming) {
      const id = m.serverId ?? m.clientId;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      merged.push(m);
      imported++;
    }
    merged.sort((a, b) => a.timestamp - b.timestamp);
    await saveCachedThread(userId, chatId, merged);
  }
  return imported;
}

/**
 * Nuke all chat caches and rotate the master key. The next write produces a
 * fresh key, so any old AsyncStorage backups on disk become permanently
 * undecryptable. Call this on logout.
 */
export async function wipeAllChatCaches(userId: string): Promise<void> {
  const allKeys = await AsyncStorage.getAllKeys();
  const ours = allKeys.filter((k) => k.startsWith(`aza_chat_thread_${userId}_`));
  if (ours.length) await AsyncStorage.multiRemove(ours);
  await SecureStore.deleteItemAsync(MASTER_KEY_STORE(userId), SECURE_OPTS);
}
