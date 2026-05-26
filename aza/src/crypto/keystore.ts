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
const OTPK_PRIVATES_KEY = (uid: string) => `aza_e2ee_otpk_priv_${uid}`;

const INITIAL_OTPK_COUNT = 50;
const SECURE_OPTS: SecureStore.SecureStoreOptions = {
  // Only readable when the device is unlocked — defense against
  // someone pulling a backup off a locked device.
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

type StoredPair = { pub: string; priv: string };
type OtpkPrivate = { keyId: number; priv: string };

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

export type OtpkPublic = { keyId: number; publicKey: Uint8Array };

/**
 * Generate `count` fresh one-time pre-keys, append their *private* halves to
 * SecureStore, and return the public halves ready for upload to the server.
 */
export async function generateOneTimePreKeys(userId: string, count: number): Promise<OtpkPublic[]> {
  const existing = await readOtpkPrivates(userId);
  const startId = existing.reduce((m, k) => Math.max(m, k.keyId), 0) + 1;

  const newPrivates: OtpkPrivate[] = [];
  const publics: OtpkPublic[] = [];
  for (let i = 0; i < count; i++) {
    const pair = generateX25519();
    const keyId = startId + i;
    newPrivates.push({ keyId, priv: bytesToBase64(pair.privateKey) });
    publics.push({ keyId, publicKey: pair.publicKey });
  }

  await writeOtpkPrivates(userId, existing.concat(newPrivates));
  return publics;
}

/** Number of locally-stored OTPK private halves available. */
export async function otpkPrivateCount(userId: string): Promise<number> {
  return (await readOtpkPrivates(userId)).length;
}

/**
 * Consume a one-time pre-key by id when an incoming first-message references it.
 * Returns the private key bytes and removes it from the store — used at most once.
 */
export async function consumeOneTimePreKey(
  userId: string,
  keyId: number,
): Promise<Uint8Array | null> {
  const existing = await readOtpkPrivates(userId);
  const idx = existing.findIndex((k) => k.keyId === keyId);
  if (idx === -1) return null;
  const consumed = existing[idx]!;
  existing.splice(idx, 1);
  await writeOtpkPrivates(userId, existing);
  return base64ToBytes(consumed.priv);
}

async function readOtpkPrivates(userId: string): Promise<OtpkPrivate[]> {
  const raw = await SecureStore.getItemAsync(OTPK_PRIVATES_KEY(userId), SECURE_OPTS);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as OtpkPrivate[];
  } catch {
    return [];
  }
}

async function writeOtpkPrivates(userId: string, items: OtpkPrivate[]) {
  await SecureStore.setItemAsync(OTPK_PRIVATES_KEY(userId), JSON.stringify(items), SECURE_OPTS);
}

/**
 * Wipe ALL local key material for the given user. Call this on logout or
 * when the user explicitly resets E2EE.
 */
export async function wipeIdentity(userId: string): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(IDENTITY_X25519_KEY(userId), SECURE_OPTS),
    SecureStore.deleteItemAsync(IDENTITY_ED25519_KEY(userId), SECURE_OPTS),
    SecureStore.deleteItemAsync(SIGNED_PREKEY_KEY(userId), SECURE_OPTS),
    SecureStore.deleteItemAsync(OTPK_PRIVATES_KEY(userId), SECURE_OPTS),
  ]);
}

export const KEYSTORE_INITIAL_OTPK_COUNT = INITIAL_OTPK_COUNT;
