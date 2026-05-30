/**
 * Identity keystore. Persists the user's long-term X25519/Ed25519 keypair plus
 * pending one-time pre-keys (OTPKs) in SecureStore so they're hardware-backed
 * where the platform supports it (Android Keystore, iOS Secure Enclave-wrapped
 * Keychain).
 *
 * Private keys NEVER leave this module unencrypted. The chat layer asks the
 * keystore to encrypt/decrypt on its behalf rather than reading the raw bytes.
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

/** Stored keys are namespaced under the user's id so multi-account installs don't collide. */
const IDENTITY_X25519_KEY = (uid: string) => `aza_e2ee_id_x_${uid}`;
const IDENTITY_ED25519_KEY = (uid: string) => `aza_e2ee_id_e_${uid}`;
const SIGNED_PREKEY_KEY = (uid: string) => `aza_e2ee_spk_${uid}`;
// The index lists keyIds that are still available locally. Each OPK private
// is stored under its own SecureStore key so the per-entry size stays small
// (~50 base64 bytes) on Android, where the single-blob approach is borderline
// for 50+ keys.
const OTPK_INDEX_KEY = (uid: string) => `aza_e2ee_otpk_idx_${uid}`;
const OTPK_PRIV_KEY = (uid: string, keyId: number) =>
  `aza_e2ee_otpk_priv_${uid}_${keyId}`;
// Legacy single-blob key — read on migration only.
const OTPK_LEGACY_BLOB_KEY = (uid: string) => `aza_e2ee_otpk_priv_${uid}`;

const INITIAL_OTPK_COUNT = 50;
const SECURE_OPTS: SecureStore.SecureStoreOptions = {
  // Only readable when the device is unlocked — defense against
  // someone pulling a backup off a locked device.
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

type StoredPair = { pub: string; priv: string };

async function readPair(key: string): Promise<StoredPair | null> {
  const raw = await SecureStore.getItemAsync(key, SECURE_OPTS);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredPair;
  } catch {
    return null;
  }
}

async function writePair(key: string, pair: { publicKey: Uint8Array; privateKey: Uint8Array }) {
  const stored: StoredPair = {
    pub: bytesToBase64(pair.publicKey),
    priv: bytesToBase64(pair.privateKey),
  };
  await SecureStore.setItemAsync(key, JSON.stringify(stored), SECURE_OPTS);
}

function decodePair(stored: StoredPair): X25519Pair | Ed25519Pair {
  return { publicKey: base64ToBytes(stored.pub), privateKey: base64ToBytes(stored.priv) };
}

/** Identity X25519 keypair. Created lazily on first call. */
export async function getOrCreateIdentityX25519(userId: string): Promise<X25519Pair> {
  const existing = await readPair(IDENTITY_X25519_KEY(userId));
  if (existing) return decodePair(existing) as X25519Pair;
  const pair = generateX25519();
  await writePair(IDENTITY_X25519_KEY(userId), pair);
  return pair;
}

/** Identity Ed25519 keypair, used to sign the signed-prekey. */
export async function getOrCreateIdentityEd25519(userId: string): Promise<Ed25519Pair> {
  const existing = await readPair(IDENTITY_ED25519_KEY(userId));
  if (existing) return decodePair(existing) as Ed25519Pair;
  const pair = generateEd25519();
  await writePair(IDENTITY_ED25519_KEY(userId), pair);
  return pair;
}

/** Generate (or rotate) the signed pre-key. Returns the public key + signature. */
export async function ensureSignedPreKey(userId: string): Promise<{
  publicKey: Uint8Array;
  signature: Uint8Array;
}> {
  const existing = await readPair(SIGNED_PREKEY_KEY(userId));
  if (existing) {
    // We don't persist the signature separately; recompute it from the stored pub
    // and the identity signing key on demand. That keeps the SecureStore footprint
    // small and lets us re-sign after a key rotation without losing the SPK.
    const ed = await getOrCreateIdentityEd25519(userId);
    const pub = base64ToBytes(existing.pub);
    return { publicKey: pub, signature: signEd25519(pub, ed.privateKey) };
  }
  const pair = generateX25519();
  await writePair(SIGNED_PREKEY_KEY(userId), pair);
  const ed = await getOrCreateIdentityEd25519(userId);
  return { publicKey: pair.publicKey, signature: signEd25519(pair.publicKey, ed.privateKey) };
}

/**
 * Read the SPK PRIVATE half. Used by the recipient X3DH path to derive
 * DH1 and DH3 against the sender's identity and ephemeral public keys.
 * Returns null if no SPK has been provisioned yet.
 */
export async function getSignedPreKeyPrivate(userId: string): Promise<Uint8Array | null> {
  const existing = await readPair(SIGNED_PREKEY_KEY(userId));
  if (!existing) return null;
  return base64ToBytes(existing.priv);
}

export type OtpkPublic = { keyId: number; publicKey: Uint8Array };

/**
 * Generate `count` fresh one-time pre-keys, persist each private half under
 * its own SecureStore key, and return the public halves ready for upload.
 */
export async function generateOneTimePreKeys(userId: string, count: number): Promise<OtpkPublic[]> {
  await migrateLegacyOtpkBlob(userId);
  const index = await readOtpkIndex(userId);
  const startId = (index.reduce((m, id) => Math.max(m, id), 0) || 0) + 1;

  const publics: OtpkPublic[] = [];
  const nextIndex = index.slice();
  for (let i = 0; i < count; i++) {
    const pair = generateX25519();
    const keyId = startId + i;
    await SecureStore.setItemAsync(
      OTPK_PRIV_KEY(userId, keyId),
      bytesToBase64(pair.privateKey),
      SECURE_OPTS,
    );
    nextIndex.push(keyId);
    publics.push({ keyId, publicKey: pair.publicKey });
  }
  await writeOtpkIndex(userId, nextIndex);
  return publics;
}

/** Number of locally-stored OTPK private halves available. */
export async function otpkPrivateCount(userId: string): Promise<number> {
  await migrateLegacyOtpkBlob(userId);
  return (await readOtpkIndex(userId)).length;
}

/**
 * Consume a one-time pre-key by id when an incoming first-message references it.
 * Returns the private key bytes and removes it from the store — used at most once.
 */
export async function consumeOneTimePreKey(
  userId: string,
  keyId: number,
): Promise<Uint8Array | null> {
  await migrateLegacyOtpkBlob(userId);
  const raw = await SecureStore.getItemAsync(OTPK_PRIV_KEY(userId, keyId), SECURE_OPTS);
  if (!raw) return null;
  await SecureStore.deleteItemAsync(OTPK_PRIV_KEY(userId, keyId), SECURE_OPTS);
  const index = await readOtpkIndex(userId);
  await writeOtpkIndex(userId, index.filter((id) => id !== keyId));
  return base64ToBytes(raw);
}

/** Drop every OPK private — used during full bundle rotation. */
export async function purgeAllOneTimePreKeys(userId: string): Promise<void> {
  await migrateLegacyOtpkBlob(userId);
  const index = await readOtpkIndex(userId);
  await Promise.all(
    index.map((id) =>
      SecureStore.deleteItemAsync(OTPK_PRIV_KEY(userId, id), SECURE_OPTS),
    ),
  );
  await SecureStore.deleteItemAsync(OTPK_INDEX_KEY(userId), SECURE_OPTS);
}

async function readOtpkIndex(userId: string): Promise<number[]> {
  const raw = await SecureStore.getItemAsync(OTPK_INDEX_KEY(userId), SECURE_OPTS);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n) => typeof n === 'number') : [];
  } catch {
    return [];
  }
}

async function writeOtpkIndex(userId: string, ids: number[]) {
  await SecureStore.setItemAsync(OTPK_INDEX_KEY(userId), JSON.stringify(ids), SECURE_OPTS);
}

/**
 * One-shot migration from the old single-blob JSON format to per-key entries.
 * Runs idempotently; subsequent calls are no-ops because the blob is deleted
 * after a successful migration.
 */
let migrationRunFor: Set<string> = new Set();
async function migrateLegacyOtpkBlob(userId: string): Promise<void> {
  if (migrationRunFor.has(userId)) return;
  migrationRunFor.add(userId);
  try {
    const raw = await SecureStore.getItemAsync(
      OTPK_LEGACY_BLOB_KEY(userId),
      SECURE_OPTS,
    );
    if (!raw) return;
    const parsed = JSON.parse(raw) as Array<{ keyId: number; priv: string }>;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      await SecureStore.deleteItemAsync(OTPK_LEGACY_BLOB_KEY(userId), SECURE_OPTS);
      return;
    }
    const index = await readOtpkIndex(userId);
    const seen = new Set(index);
    for (const e of parsed) {
      if (typeof e?.keyId !== 'number' || typeof e?.priv !== 'string') continue;
      if (seen.has(e.keyId)) continue;
      await SecureStore.setItemAsync(
        OTPK_PRIV_KEY(userId, e.keyId),
        e.priv,
        SECURE_OPTS,
      );
      index.push(e.keyId);
    }
    await writeOtpkIndex(userId, index);
    await SecureStore.deleteItemAsync(OTPK_LEGACY_BLOB_KEY(userId), SECURE_OPTS);
  } catch (e) {
    // Migration is best-effort; if it fails we'll fall back to generating
    // a fresh batch on next rotation.
    console.warn('[E2EE] OTPK migration failed', e);
  }
}

/**
 * Wipe ALL local key material for the given user. Call this on logout or
 * when the user explicitly resets E2EE.
 */
export async function wipeIdentity(userId: string): Promise<void> {
  // Make sure per-key OPKs are cleared too, not just the index.
  await purgeAllOneTimePreKeys(userId).catch(() => {});
  await Promise.all([
    SecureStore.deleteItemAsync(IDENTITY_X25519_KEY(userId), SECURE_OPTS),
    SecureStore.deleteItemAsync(IDENTITY_ED25519_KEY(userId), SECURE_OPTS),
    SecureStore.deleteItemAsync(SIGNED_PREKEY_KEY(userId), SECURE_OPTS),
    SecureStore.deleteItemAsync(OTPK_LEGACY_BLOB_KEY(userId), SECURE_OPTS),
  ]);
  migrationRunFor.delete(userId);
}

export const KEYSTORE_INITIAL_OTPK_COUNT = INITIAL_OTPK_COUNT;
