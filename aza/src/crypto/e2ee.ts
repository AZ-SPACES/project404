/**
 * E2EE primitives.
 *
 * Scheme:
 *   - Long-term identity key:  X25519 (used as recipient pubkey for ECDH).
 *   - Identity signing key:    Ed25519 (used to sign signed-prekeys).
 *   - Per-message session key: ephemeral X25519 keypair, fresh for every message.
 *
 * Send pipeline (sender → recipient):
 *   1) Generate ephemeral X25519 keypair (ePub, ePriv).
 *   2) Compute sharedSecret = X25519(ePriv, recipient.identityPub).
 *   3) Derive a 32-byte AES key with HKDF-SHA256:
 *        salt = first 16 bytes of ePub
 *        info = "aza.chat.v1|<senderId>|<chatId>"
 *   4) Generate random 12-byte nonce; ciphertext = AES-256-GCM(key, nonce, plaintext, AAD).
 *      AAD binds the ephemeral pubkey, sender id, and chat id so the recipient cannot be
 *      tricked into accepting a re-routed envelope.
 *   5) Wire envelope = base64(nonce || ciphertext_with_tag).  ephemeralKey = base64(ePub).
 *
 * Receive pipeline:
 *   1) Read ePub from envelope.ephemeralKey.
 *   2) sharedSecret = X25519(identityPriv, ePub).
 *   3) Derive same AES key (same salt/info).
 *   4) Decrypt; reject on AEAD failure or AAD mismatch.
 *
 * Forward secrecy — what this scheme actually provides:
 *   - SENDER side: ePriv is zeroed before the envelope leaves memory, so an
 *     attacker who later compromises the sender's device cannot replay the
 *     sender's stored material to decrypt past outgoing messages. There is
 *     no sender ratchet state to recover.
 *   - RECIPIENT side: decryption uses the long-term identity private key
 *     against the sender's ephemeral public key (which IS stored on the
 *     server inside each envelope). If the recipient's identity private key
 *     is ever compromised, every past message they received remains
 *     decryptable from server-stored ciphertext. There is NO recipient-side
 *     forward secrecy.
 *
 * NOTE on the bundle: the backend stores signedPreKey + one-time pre-keys
 * for X3DH-style session init, but this implementation does not currently
 * mix the SPK or OPK into the HKDF input. The `preKeyId` field is sent
 * once per new session purely as an opaque pop signal so the server can
 * retire the OPK from the peer's supply. Upgrading to true X3DH (mix
 * IK·SPK + EK·SPK + EK·OPK + EK·IK into the root key) would close the
 * recipient-side FS gap; that's tracked as a follow-up.
 */

import './random';
import { x25519, ed25519 } from '@noble/curves/ed25519.js';
import { gcm } from '@noble/ciphers/aes.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { randomBytes } from '@noble/ciphers/utils.js';

import { base64ToBytes, bytesToBase64, bytesToUtf8, utf8ToBytes } from './codec';

export type X25519Pair = { publicKey: Uint8Array; privateKey: Uint8Array };
export type Ed25519Pair = { publicKey: Uint8Array; privateKey: Uint8Array };

/** Generate a new X25519 keypair (long-term identity or ephemeral). */
export function generateX25519(): X25519Pair {
  const { secretKey, publicKey } = x25519.keygen();
  return { publicKey, privateKey: secretKey };
}

/** Generate a new Ed25519 keypair (identity signing key). */
export function generateEd25519(): Ed25519Pair {
  const { secretKey, publicKey } = ed25519.keygen();
  return { publicKey, privateKey: secretKey };
}

/** Sign an arbitrary byte string with an Ed25519 private key. */
export function signEd25519(message: Uint8Array, privateKey: Uint8Array): Uint8Array {
  return ed25519.sign(message, privateKey);
}

/** Verify an Ed25519 signature. */
export function verifyEd25519(
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array,
): boolean {
  try {
    return ed25519.verify(signature, message, publicKey);
  } catch {
    return false;
  }
}

/** Static X25519 ECDH. The result is a raw 32-byte shared secret. */
export function deriveSharedSecret(privateKey: Uint8Array, peerPublic: Uint8Array): Uint8Array {
  return x25519.getSharedSecret(privateKey, peerPublic);
}

/** Derive a 32-byte AES-256 key from a shared secret via HKDF-SHA256. */
export function deriveAesKey(
  sharedSecret: Uint8Array,
  salt: Uint8Array,
  info: string,
): Uint8Array {
  return hkdf(sha256, sharedSecret, salt, utf8ToBytes(info), 32);
}

export type EncryptedEnvelope = {
  /** base64(ephemeral X25519 public key) */
  ephemeralPublicKey: string;
  /** base64(nonce(12) || ciphertext || gcmTag(16)) */
  ciphertext: string;
};

/**
 * Encrypt a UTF-8 plaintext for a recipient identified by their X25519 identity pubkey.
 *
 * AAD binds the message to (senderId, chatId, ephemeralPublicKey) so the server cannot
 * silently re-route it to a different chat. The recipient MUST pass the same triple
 * when decrypting; mismatches produce an authentication failure.
 */
export function encryptForRecipient(args: {
  plaintext: string;
  recipientIdentityPublic: Uint8Array;
  senderId: string;
  chatId: string;
}): EncryptedEnvelope {
  const { plaintext, recipientIdentityPublic, senderId, chatId } = args;

  const ephemeral = generateX25519();
  try {
    const sharedSecret = deriveSharedSecret(ephemeral.privateKey, recipientIdentityPublic);
    const salt = ephemeral.publicKey.slice(0, 16);
    const info = `aza.chat.v1|${senderId}|${chatId}`;
    const aesKey = deriveAesKey(sharedSecret, salt, info);

    const nonce = randomBytes(12);
    const aad = utf8ToBytes(
      `aza.chat.v1|${senderId}|${chatId}|${bytesToBase64(ephemeral.publicKey)}`,
    );
    const cipher = gcm(aesKey, nonce, aad);
    const sealed = cipher.encrypt(utf8ToBytes(plaintext));

    const out = new Uint8Array(nonce.length + sealed.length);
    out.set(nonce, 0);
    out.set(sealed, nonce.length);

    return {
      ephemeralPublicKey: bytesToBase64(ephemeral.publicKey),
      ciphertext: bytesToBase64(out),
    };
  } finally {
    // Best-effort wipe of the ephemeral private key.
    ephemeral.privateKey.fill(0);
  }
}

/**
 * Decrypt an envelope. `senderId`/`chatId` must match what the sender bound at encryption.
 *
 * Returns null if the envelope is malformed, the AEAD tag fails, or any AAD mismatches —
 * never throws on bad ciphertext. Callers should treat null as "drop this message".
 */
export function decryptFromSender(args: {
  envelope: EncryptedEnvelope;
  identityPrivateKey: Uint8Array;
  senderId: string;
  chatId: string;
}): string | null {
  try {
    const { envelope, identityPrivateKey, senderId, chatId } = args;
    const ephemeralPub = base64ToBytes(envelope.ephemeralPublicKey);
    const blob = base64ToBytes(envelope.ciphertext);
    if (blob.length < 12 + 16) return null;

    const nonce = blob.slice(0, 12);
    const ciphertext = blob.slice(12);

    const sharedSecret = deriveSharedSecret(identityPrivateKey, ephemeralPub);
    const salt = ephemeralPub.slice(0, 16);
    const info = `aza.chat.v1|${senderId}|${chatId}`;
    const aesKey = deriveAesKey(sharedSecret, salt, info);

    const aad = utf8ToBytes(
      `aza.chat.v1|${senderId}|${chatId}|${envelope.ephemeralPublicKey}`,
    );
    const cipher = gcm(aesKey, nonce, aad);
    const plaintext = cipher.decrypt(ciphertext);
    return bytesToUtf8(plaintext);
  } catch {
    return null;
  }
}

/**
 * Render an identity public key as a human-readable safety number for
 * out-of-band verification (compare with the peer over a different channel).
 *
 * Format: SHA-256(low || high) truncated to 30 decimal digits, grouped 5x6.
 */
export function safetyNumber(myIdentityPub: Uint8Array, theirIdentityPub: Uint8Array): string {
  // Order-independent: sort by lex so both sides compute the same value.
  const [a, b] =
    compareBytes(myIdentityPub, theirIdentityPub) < 0
      ? [myIdentityPub, theirIdentityPub]
      : [theirIdentityPub, myIdentityPub];
  const joined = new Uint8Array(a.length + b.length);
  joined.set(a, 0);
  joined.set(b, a.length);
  const digest = sha256(joined);

  // Read 30 decimal digits out of the hash (5 bytes → ~12 decimal digits each chunk).
  let digits = '';
  for (let i = 0; digits.length < 30 && i < digest.length - 4; i += 5) {
    let chunk = 0n;
    for (let j = 0; j < 5; j++) chunk = (chunk << 8n) | BigInt(digest[i + j]!);
    digits += chunk.toString().padStart(12, '0').slice(-6);
  }
  digits = digits.slice(0, 30);
  return digits.match(/.{1,5}/g)!.join(' ');
}

function compareBytes(a: Uint8Array, b: Uint8Array): number {
  const min = Math.min(a.length, b.length);
  for (let i = 0; i < min; i++) {
    if (a[i]! !== b[i]!) return a[i]! - b[i]!;
  }
  return a.length - b.length;
}
