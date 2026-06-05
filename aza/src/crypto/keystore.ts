/**
 * Identity keystore. Persists the user's long-term X25519/Ed25519 keypair plus
 * pending one-time pre-keys (OTPKs) in SecureStore so they're hardware-backed
 * where the platform supports it (Android Keystore, iOS Secure Enclave-wrapped
 * Keychain).
 *
 * All keys are namespaced under (userId, deviceId) so each physical device
 * maintains its own independent identity — required for multi-device E2EE.
 * Private keys NEVER leave this module unencrypted.
 */

import './random';
import * as SecureStore from 'expo-secure-store';

import {
  bytesToBase64,
  base64ToBytes,
} from './codec';
import {
  generateEd25519,
  generateX25519,
  signEd25519,
  type Ed25519Pair,
  type X25519Pair,
} from './e2ee';

const IDENTITY_X25519_KEY = (uid: string, did: string) => `aza_e2ee_id_x_${uid}_${did}`;
const IDENTITY_ED25519_KEY = (uid: string, did: string) => `aza_e2ee_id_e_${uid}_${did}`;
const SIGNED_PREKEY_KEY    = (uid: string, did: string) => `aza_e2ee_spk_${uid}_${did}`;
const SIGNED_PREKEY_TS_KEY = (uid: string, did: string) => `aza_e2ee_spk_ts_${uid}_${did}`;
const PREV_SIGNED_PREKEY_PRIV_KEY = (uid: string, did: string) => `aza_e2ee_spk_prev_${uid}_${did}`;
const PREV_SIGNED_PREKEY_TS_KEY   = (uid: string, did: string) => `aza_e2ee_spk_prev_ts_${uid}_${did}`;
const OTPK_INDEX_KEY = (uid: string, did: string) => `aza_e2ee_otpk_idx_${uid}_${did}`;
const OTPK_PRIV_KEY  = (uid: string, did: string, keyId: number) =>
  `aza_e2ee_otpk_priv_${uid}_${did}_${keyId}`;
// Legacy (pre-multi-device) keys — userId-only namespace, read for migration.
const LEGACY_IDENTITY_X25519_KEY = (uid: string) => `aza_e2ee_id_x_${uid}`;
const LEGACY_IDENTITY_ED25519_KEY = (uid: string) => `aza_e2ee_id_e_${uid}`;
const LEGACY_SIGNED_PREKEY_KEY    = (uid: string) => `aza_e2ee_spk_${uid}`;
const LEGACY_OTPK_INDEX_KEY       = (uid: string) => `aza_e2ee_otpk_idx_${uid}`;
const LEGACY_OTPK_PRIV_KEY        = (uid: string, keyId: number) =>
  `aza_e2ee_otpk_priv_${uid}_${keyId}`;

const INITIAL_OTPK_COUNT = 50;
const SPK_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const SPK_GRACE_MS   = 30 * 24 * 60 * 60 * 1000;
const SECURE_OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

type StoredPair = { pub: string; priv: string };

async function readPair(key: string): Promise<StoredPair | null> {
  const raw = await SecureStore.getItemAsync(key, SECURE_OPTS);
  if (!raw) return null;
  try { return JSON.parse(raw) as StoredPair; } catch { return null; }
}

async function writePair(key: string, pair: { publicKey: Uint8Array; privateKey: Uint8Array }) {
  await SecureStore.setItemAsync(key, JSON.stringify({
    pub: bytesToBase64(pair.publicKey),
    priv: bytesToBase64(pair.privateKey),
  }), SECURE_OPTS);
}

function decodePair(stored: StoredPair): X25519Pair | Ed25519Pair {
  return { publicKey: base64ToBytes(stored.pub), privateKey: base64ToBytes(stored.priv) };
}

// ─── Identity X25519 ───────────────────────────────────────────────────────

export async function getOrCreateIdentityX25519(userId: string, deviceId: string): Promise<X25519Pair> {
  const existing = await readPair(IDENTITY_X25519_KEY(userId, deviceId));
  if (existing) return decodePair(existing) as X25519Pair;

  // One-time migration: if a legacy (userId-only) key exists for 'device_legacy',
  // re-use it so the server-side migration and the local key stay in sync.
  if (deviceId === 'device_legacy') {
    const legacy = await readPair(LEGACY_IDENTITY_X25519_KEY(userId));
    if (legacy) {
      await writePair(IDENTITY_X25519_KEY(userId, deviceId), decodePair(legacy) as X25519Pair);
      return decodePair(legacy) as X25519Pair;
    }
  }

  const pair = generateX25519();
  await writePair(IDENTITY_X25519_KEY(userId, deviceId), pair);
  return pair;
}

export async function getOrCreateIdentityEd25519(userId: string, deviceId: string): Promise<Ed25519Pair> {
  const existing = await readPair(IDENTITY_ED25519_KEY(userId, deviceId));
  if (existing) return decodePair(existing) as Ed25519Pair;

  if (deviceId === 'device_legacy') {
    const legacy = await readPair(LEGACY_IDENTITY_ED25519_KEY(userId));
    if (legacy) {
      await writePair(IDENTITY_ED25519_KEY(userId, deviceId), decodePair(legacy) as Ed25519Pair);
      return decodePair(legacy) as Ed25519Pair;
    }
  }

  const pair = generateEd25519();
  await writePair(IDENTITY_ED25519_KEY(userId, deviceId), pair);
  return pair;
}

// ─── Signed Pre-Key ────────────────────────────────────────────────────────

export async function ensureSignedPreKey(
  userId: string,
  deviceId: string,
): Promise<{ publicKey: Uint8Array; signature: Uint8Array }> {
  const existing = await readPair(SIGNED_PREKEY_KEY(userId, deviceId));
  if (existing) {
    const ts = await SecureStore.getItemAsync(SIGNED_PREKEY_TS_KEY(userId, deviceId), SECURE_OPTS);
    if (!ts) {
      await SecureStore.setItemAsync(SIGNED_PREKEY_TS_KEY(userId, deviceId), String(Date.now()), SECURE_OPTS);
    }
    const ed = await getOrCreateIdentityEd25519(userId, deviceId);
    const pub = base64ToBytes(existing.pub);
    return { publicKey: pub, signature: signEd25519(pub, ed.privateKey) };
  }

  // Migrate legacy SPK on first use
  if (deviceId === 'device_legacy') {
    const legacy = await readPair(LEGACY_SIGNED_PREKEY_KEY(userId));
    if (legacy) {
      await writePair(SIGNED_PREKEY_KEY(userId, deviceId), decodePair(legacy) as X25519Pair);
      await SecureStore.setItemAsync(SIGNED_PREKEY_TS_KEY(userId, deviceId), String(Date.now()), SECURE_OPTS);
      const ed = await getOrCreateIdentityEd25519(userId, deviceId);
      const pub = base64ToBytes(legacy.pub);
      return { publicKey: pub, signature: signEd25519(pub, ed.privateKey) };
    }
  }

  const pair = generateX25519();
  await writePair(SIGNED_PREKEY_KEY(userId, deviceId), pair);
  await SecureStore.setItemAsync(SIGNED_PREKEY_TS_KEY(userId, deviceId), String(Date.now()), SECURE_OPTS);
  const ed = await getOrCreateIdentityEd25519(userId, deviceId);
  return { publicKey: pair.publicKey, signature: signEd25519(pair.publicKey, ed.privateKey) };
}

export async function isSignedPreKeyStale(
  userId: string,
  deviceId: string,
  maxAgeMs = SPK_MAX_AGE_MS,
): Promise<boolean> {
  const existing = await readPair(SIGNED_PREKEY_KEY(userId, deviceId));
  if (!existing) return true;
  const tsRaw = await SecureStore.getItemAsync(SIGNED_PREKEY_TS_KEY(userId, deviceId), SECURE_OPTS);
  if (!tsRaw) return true;
  return Date.now() - parseInt(tsRaw, 10) > maxAgeMs;
}

export async function rotateSignedPreKey(
  userId: string,
  deviceId: string,
): Promise<{ publicKey: Uint8Array; signature: Uint8Array }> {
  const current = await readPair(SIGNED_PREKEY_KEY(userId, deviceId));
  if (current) {
    await SecureStore.setItemAsync(PREV_SIGNED_PREKEY_PRIV_KEY(userId, deviceId), current.priv, SECURE_OPTS);
    await SecureStore.setItemAsync(PREV_SIGNED_PREKEY_TS_KEY(userId, deviceId), String(Date.now()), SECURE_OPTS);
  }
  const pair = generateX25519();
  await writePair(SIGNED_PREKEY_KEY(userId, deviceId), pair);
  await SecureStore.setItemAsync(SIGNED_PREKEY_TS_KEY(userId, deviceId), String(Date.now()), SECURE_OPTS);
  const ed = await getOrCreateIdentityEd25519(userId, deviceId);
  return { publicKey: pair.publicKey, signature: signEd25519(pair.publicKey, ed.privateKey) };
}

export async function getSignedPreKeyPrivate(userId: string, deviceId: string): Promise<Uint8Array | null> {
  const existing = await readPair(SIGNED_PREKEY_KEY(userId, deviceId));
  if (!existing) return null;
  return base64ToBytes(existing.priv);
}

export async function getPreviousSignedPreKeyPrivate(userId: string, deviceId: string): Promise<Uint8Array | null> {
  const tsRaw = await SecureStore.getItemAsync(PREV_SIGNED_PREKEY_TS_KEY(userId, deviceId), SECURE_OPTS);
  if (!tsRaw) return null;
  if (Date.now() - parseInt(tsRaw, 10) > SPK_GRACE_MS) {
    await SecureStore.deleteItemAsync(PREV_SIGNED_PREKEY_PRIV_KEY(userId, deviceId), SECURE_OPTS);
    await SecureStore.deleteItemAsync(PREV_SIGNED_PREKEY_TS_KEY(userId, deviceId), SECURE_OPTS);
    return null;
  }
  const raw = await SecureStore.getItemAsync(PREV_SIGNED_PREKEY_PRIV_KEY(userId, deviceId), SECURE_OPTS);
  return raw ? base64ToBytes(raw) : null;
}

// ─── One-time Pre-Keys ─────────────────────────────────────────────────────

export type OtpkPublic = { keyId: number; publicKey: Uint8Array };

export async function generateOneTimePreKeys(
  userId: string,
  deviceId: string,
  count: number,
): Promise<OtpkPublic[]> {
  await migrateLegacyOtpkBlob(userId, deviceId);
  const index = await readOtpkIndex(userId, deviceId);
  const startId = (index.reduce((m, id) => Math.max(m, id), 0) || 0) + 1;

  const publics: OtpkPublic[] = [];
  const nextIndex = index.slice();
  for (let i = 0; i < count; i++) {
    const pair = generateX25519();
    const keyId = startId + i;
    await SecureStore.setItemAsync(
      OTPK_PRIV_KEY(userId, deviceId, keyId),
      bytesToBase64(pair.privateKey),
      SECURE_OPTS,
    );
    nextIndex.push(keyId);
    publics.push({ keyId, publicKey: pair.publicKey });
  }
  await writeOtpkIndex(userId, deviceId, nextIndex);
  return publics;
}

export async function otpkPrivateCount(userId: string, deviceId: string): Promise<number> {
  await migrateLegacyOtpkBlob(userId, deviceId);
  return (await readOtpkIndex(userId, deviceId)).length;
}

export async function consumeOneTimePreKey(
  userId: string,
  deviceId: string,
  keyId: number,
): Promise<Uint8Array | null> {
  await migrateLegacyOtpkBlob(userId, deviceId);
  const raw = await SecureStore.getItemAsync(OTPK_PRIV_KEY(userId, deviceId, keyId), SECURE_OPTS);
  if (!raw) return null;
  await SecureStore.deleteItemAsync(OTPK_PRIV_KEY(userId, deviceId, keyId), SECURE_OPTS);
  const index = await readOtpkIndex(userId, deviceId);
  await writeOtpkIndex(userId, deviceId, index.filter((id) => id !== keyId));
  return base64ToBytes(raw);
}

export async function readOneTimePreKey(
  userId: string,
  deviceId: string,
  keyId: number,
): Promise<Uint8Array | null> {
  await migrateLegacyOtpkBlob(userId, deviceId);
  const raw = await SecureStore.getItemAsync(OTPK_PRIV_KEY(userId, deviceId, keyId), SECURE_OPTS);
  return raw ? base64ToBytes(raw) : null;
}

export async function deleteConsumedOneTimePreKey(
  userId: string,
  deviceId: string,
  keyId: number,
): Promise<void> {
  await SecureStore.deleteItemAsync(OTPK_PRIV_KEY(userId, deviceId, keyId), SECURE_OPTS);
  const index = await readOtpkIndex(userId, deviceId);
  await writeOtpkIndex(userId, deviceId, index.filter((id) => id !== keyId));
}

export async function purgeAllOneTimePreKeys(userId: string, deviceId: string): Promise<void> {
  await migrateLegacyOtpkBlob(userId, deviceId);
  const index = await readOtpkIndex(userId, deviceId);
  await Promise.all(
    index.map((id) => SecureStore.deleteItemAsync(OTPK_PRIV_KEY(userId, deviceId, id), SECURE_OPTS)),
  );
  await SecureStore.deleteItemAsync(OTPK_INDEX_KEY(userId, deviceId), SECURE_OPTS);
}

// ─── Wipe ──────────────────────────────────────────────────────────────────

export async function wipeIdentity(userId: string, deviceId: string): Promise<void> {
  await purgeAllOneTimePreKeys(userId, deviceId).catch(() => {});
  await Promise.all([
    SecureStore.deleteItemAsync(IDENTITY_X25519_KEY(userId, deviceId), SECURE_OPTS),
    SecureStore.deleteItemAsync(IDENTITY_ED25519_KEY(userId, deviceId), SECURE_OPTS),
    SecureStore.deleteItemAsync(SIGNED_PREKEY_KEY(userId, deviceId), SECURE_OPTS),
    SecureStore.deleteItemAsync(SIGNED_PREKEY_TS_KEY(userId, deviceId), SECURE_OPTS),
    SecureStore.deleteItemAsync(PREV_SIGNED_PREKEY_PRIV_KEY(userId, deviceId), SECURE_OPTS),
    SecureStore.deleteItemAsync(PREV_SIGNED_PREKEY_TS_KEY(userId, deviceId), SECURE_OPTS),
  ]);
  migrationRunFor.delete(`${userId}:${deviceId}`);
}

// ─── Internals ─────────────────────────────────────────────────────────────

async function readOtpkIndex(userId: string, deviceId: string): Promise<number[]> {
  const raw = await SecureStore.getItemAsync(OTPK_INDEX_KEY(userId, deviceId), SECURE_OPTS);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n) => typeof n === 'number') : [];
  } catch { return []; }
}

async function writeOtpkIndex(userId: string, deviceId: string, ids: number[]) {
  await SecureStore.setItemAsync(OTPK_INDEX_KEY(userId, deviceId), JSON.stringify(ids), SECURE_OPTS);
}

let migrationRunFor: Set<string> = new Set();

async function migrateLegacyOtpkBlob(userId: string, deviceId: string): Promise<void> {
  const key = `${userId}:${deviceId}`;
  if (migrationRunFor.has(key)) return;
  migrationRunFor.add(key);

  // Only attempt legacy migration for the canonical legacy device id.
  if (deviceId !== 'device_legacy') return;

  try {
    // Legacy per-key entries stored without a deviceId suffix.
    const legacyIndex = await SecureStore.getItemAsync(LEGACY_OTPK_INDEX_KEY(userId), SECURE_OPTS);
    if (!legacyIndex) return;
    const ids: number[] = JSON.parse(legacyIndex);
    if (!Array.isArray(ids) || ids.length === 0) return;

    const newIndex = await readOtpkIndex(userId, deviceId);
    const seen = new Set(newIndex);
    for (const id of ids) {
      if (seen.has(id)) continue;
      const priv = await SecureStore.getItemAsync(LEGACY_OTPK_PRIV_KEY(userId, id), SECURE_OPTS);
      if (priv) {
        await SecureStore.setItemAsync(OTPK_PRIV_KEY(userId, deviceId, id), priv, SECURE_OPTS);
        newIndex.push(id);
      }
    }
    await writeOtpkIndex(userId, deviceId, newIndex);
  } catch (e) {
    console.warn('[E2EE] OTPK migration failed', e);
  }
}

export const KEYSTORE_INITIAL_OTPK_COUNT = INITIAL_OTPK_COUNT;
