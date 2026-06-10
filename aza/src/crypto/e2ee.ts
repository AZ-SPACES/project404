/**
 * E2EE primitives.
 *
 * Three protocol versions live here:
 *
 *   v3 (current):
 *     - Session establishment via X3DH:
 *         DH1 = DH(IK_sender,  SPK_recipient)
 *         DH2 = DH(EK_sender,  IK_recipient)
 *         DH3 = DH(EK_sender,  SPK_recipient)
 *         DH4 = DH(EK_sender,  OPK_recipient)   // present when an OPK is available
 *       rootKey = HKDF-SHA256(DH1 || DH2 || DH3 || DH4, info="aza.chat.v3.x3dh|sender|chat")
 *     - First message encrypted with HKDF(rootKey, salt=EK_pub_first16,
 *       info="aza.chat.v3.msg0|sender|chat"), AAD binds (proto, senderId,
 *       chatId, ephemeralPub) as canonical JSON.
 *     - Subsequent messages: fresh ephemeral EK per send, mix =
 *       DH(EK_sender, IK_recipient), perMsgKey = HKDF(rootKey || mix,
 *       salt=EK_pub_first16, info="aza.chat.v3.msgN|...").
 *     - rootKey is cached per (selfUserId, peerUserId) in SecureStore so
 *       only the first send/receive pays the X3DH cost.
 *     - OPK private is consumed (deleted) at decrypt time once it has been
 *       used to derive a session; subsequent OPK_id references are rejected.
 *
 *   v2 (legacy, fallback on decrypt):
 *     - Per-message ECDH(EK, IK_recipient) only. AAD canonical JSON.
 *
 *   v1 (legacy, fallback on decrypt):
 *     - Per-message ECDH(EK, IK_recipient). AAD pipe-string.
 *
 * Forward secrecy with v3:
 *   - SENDER side: per-message ephemerals are zeroed after send.
 *   - RECIPIENT side: compromise of IK_priv alone is no longer sufficient
 *     to decrypt past messages — the attacker also needs the SPK_priv (for
 *     DH1+DH3) and, for the first message of each session, the OPK_priv
 *     (consumed at decrypt time and immediately deleted from SecureStore).
 *     SPK rotation should be performed on a regular cadence to bound the
 *     window in which any single compromise is useful.
 *
 *   Real post-compromise security still requires a Double Ratchet; v3 is
 *   designed so the ratchet can layer on top without breaking compatibility
 *   (the rootKey we cache is exactly the seed a ratchet would consume).
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
 * Build the AAD blob bound to an envelope. The current version (v2) emits
 * canonical JSON with sorted keys so future additions to the binding (e.g.
 * recipientId, protocol-level extensions) cannot collide with each other
 * by overlapping a delimiter. v1 used a pipe-separated string; we keep
 * the v1 builder around so `decryptFromSender` can transparently decrypt
 * messages from older clients still in flight at upgrade time.
 */
function buildAad(
  version: 'v1' | 'v2',
  senderId: string,
  chatId: string,
  ephemeralPublicKeyB64: string,
): Uint8Array {
  if (version === 'v1') {
    return utf8ToBytes(
      `aza.chat.v1|${senderId}|${chatId}|${ephemeralPublicKeyB64}`,
    );
  }
  // Canonical JSON: keys in lexicographic order, no whitespace. JSON.stringify
  // with a fixed key array gives us exactly that.
  const canonical = JSON.stringify({
    chatId,
    ephemeral: ephemeralPublicKeyB64,
    proto: 'aza.chat.v2',
    senderId,
  });
  return utf8ToBytes(canonical);
}

function buildInfo(senderId: string, chatId: string): string {
  // Info bound to the same identifiers; the HKDF salt is per-message random
  // so colliding info strings between protocol versions doesn't weaken
  // forward independence between messages.
  return `aza.chat.v2|${senderId}|${chatId}`;
}

/**
 * Encrypt a UTF-8 plaintext for a recipient identified by their X25519 identity pubkey.
 *
 * AAD binds the message to (senderId, chatId, ephemeralPublicKey) via a
 * canonical JSON encoding so the server cannot silently re-route it to a
 * different chat. The recipient MUST pass the same triple when decrypting;
 * mismatches produce an authentication failure.
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
    const aesKey = deriveAesKey(sharedSecret, salt, buildInfo(senderId, chatId));

    const nonce = randomBytes(12);
    const aad = buildAad('v2', senderId, chatId, bytesToBase64(ephemeral.publicKey));
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
 *
 * Decryption attempts the current AAD format (v2) first and falls back to
 * v1 on tag failure, so messages already in flight at upgrade time still
 * open cleanly. This is the only behavioral difference between versions.
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

    // Try v2 (current) first, then v1 (legacy in-flight envelopes).
    const candidates: Array<{ info: string; aad: Uint8Array }> = [
      { info: buildInfo(senderId, chatId), aad: buildAad('v2', senderId, chatId, envelope.ephemeralPublicKey) },
      {
        info: `aza.chat.v1|${senderId}|${chatId}`,
        aad: buildAad('v1', senderId, chatId, envelope.ephemeralPublicKey),
      },
    ];
    for (const { info, aad } of candidates) {
      const aesKey = deriveAesKey(sharedSecret, salt, info);
      try {
        const plaintext = gcm(aesKey, nonce, aad).decrypt(ciphertext);
        return bytesToUtf8(plaintext);
      } catch {
        // try next protocol version
      }
    }
    return null;
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

// ─── v3 / X3DH ─────────────────────────────────────────────────────────────

/** Public-key bundle for a peer, after our SPK-signature gate has passed. */
export type RecipientBundle = {
  identityPublicKey: Uint8Array;
  signedPreKeyPublic: Uint8Array;
  /** Null if the server had no OPK to hand out (drained supply). */
  oneTimePreKeyId?: string | null;
  oneTimePreKeyPublic?: Uint8Array | null;
};

/** Concatenate any number of byte slices into a single fresh buffer. */
function concatBytes(...parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

/** HKDF info string for the X3DH root-key derivation. */
function buildRootInfo(senderId: string, chatId: string): string {
  return `aza.chat.v3.x3dh|${senderId}|${chatId}`;
}

/** HKDF info string for the first-message key derivation. */
function buildMsg0Info(senderId: string, chatId: string): string {
  return `aza.chat.v3.msg0|${senderId}|${chatId}`;
}

/** HKDF info string for subsequent-message key derivation. */
function buildMsgNInfo(senderId: string, chatId: string): string {
  return `aza.chat.v3.msgN|${senderId}|${chatId}`;
}

/**
 * HKDF info string for ratcheting the root key forward after each follow-up
 * message. Both sender and recipient derive the same new root from the same
 * `ikm = rootKey || mix`, so the session state advances in lock-step.
 */
function buildChainInfo(senderId: string, chatId: string): string {
  return `aza.chat.v3.chain|${senderId}|${chatId}`;
}

/** v3 canonical-JSON AAD. Distinct from v2 so legacy fallback can't cross-decrypt. */
function buildAadV3(
  senderId: string,
  chatId: string,
  ephemeralPublicKeyB64: string,
): Uint8Array {
  return utf8ToBytes(
    JSON.stringify({
      chatId,
      ephemeral: ephemeralPublicKeyB64,
      proto: 'aza.chat.v3',
      senderId,
    }),
  );
}

/**
 * Sender side of X3DH. Returns the 32-byte root key plus the ephemeral
 * public key the recipient will need to recompute the same secret.
 *
 * The caller MUST have already verified the SPK signature against the
 * recipient's identity key (we don't re-verify here — that lives in the
 * peer-key cache layer).
 */
export function establishSessionAsSender(args: {
  senderIdentityPrivate: Uint8Array;
  bundle: RecipientBundle;
  senderId: string;
  chatId: string;
}): {
  rootKey: Uint8Array;
  ephemeralPublicKey: Uint8Array;
} {
  const { senderIdentityPrivate, bundle, senderId, chatId } = args;
  const ephemeral = generateX25519();
  try {
    const dh1 = deriveSharedSecret(senderIdentityPrivate, bundle.signedPreKeyPublic);
    const dh2 = deriveSharedSecret(ephemeral.privateKey, bundle.identityPublicKey);
    const dh3 = deriveSharedSecret(ephemeral.privateKey, bundle.signedPreKeyPublic);
    const dh4 =
      bundle.oneTimePreKeyPublic && bundle.oneTimePreKeyPublic.length > 0
        ? deriveSharedSecret(ephemeral.privateKey, bundle.oneTimePreKeyPublic)
        : new Uint8Array(0);

    // HKDF input: domain-separator prefix (FF×32) + concatenated DH outputs,
    // mirroring the Signal-style "F || DH1 || DH2 || DH3 [|| DH4]" recipe
    // so a future port to libsignal-style code can interop on the seed.
    const prefix = new Uint8Array(32).fill(0xff);
    const ikm = concatBytes(prefix, dh1, dh2, dh3, dh4);
    const rootKey = hkdf(
      sha256,
      ikm,
      new Uint8Array(32), // zero salt is the X3DH spec default
      utf8ToBytes(buildRootInfo(senderId, chatId)),
      32,
    );

    // Best-effort wipe of intermediate secrets.
    dh1.fill(0);
    dh2.fill(0);
    dh3.fill(0);
    if (dh4.length) dh4.fill(0);
    ikm.fill(0);

    return { rootKey, ephemeralPublicKey: ephemeral.publicKey };
  } finally {
    ephemeral.privateKey.fill(0);
  }
}

/**
 * Recipient side of X3DH. Reproduces the same root key the sender derived.
 * `oneTimePreKeyPrivate` must be passed when the sender's first-message
 * envelope referenced an OPK; pass null/undefined when no OPK was used.
 */
export function establishSessionAsRecipient(args: {
  recipientIdentityPrivate: Uint8Array;
  recipientSignedPreKeyPrivate: Uint8Array;
  oneTimePreKeyPrivate?: Uint8Array | null;
  senderIdentityPublic: Uint8Array;
  senderEphemeralPublic: Uint8Array;
  senderId: string;
  chatId: string;
}): Uint8Array {
  const {
    recipientIdentityPrivate,
    recipientSignedPreKeyPrivate,
    oneTimePreKeyPrivate,
    senderIdentityPublic,
    senderEphemeralPublic,
    senderId,
    chatId,
  } = args;

  // Mirror image of the sender's DHs:
  //   sender DH1 = DH(IK_s, SPK_r)  ↔  recipient DH1 = DH(SPK_r, IK_s)
  //   sender DH2 = DH(EK_s, IK_r)   ↔  recipient DH2 = DH(IK_r, EK_s)
  //   sender DH3 = DH(EK_s, SPK_r)  ↔  recipient DH3 = DH(SPK_r, EK_s)
  //   sender DH4 = DH(EK_s, OPK_r)  ↔  recipient DH4 = DH(OPK_r, EK_s)
  const dh1 = deriveSharedSecret(recipientSignedPreKeyPrivate, senderIdentityPublic);
  const dh2 = deriveSharedSecret(recipientIdentityPrivate, senderEphemeralPublic);
  const dh3 = deriveSharedSecret(recipientSignedPreKeyPrivate, senderEphemeralPublic);
  const dh4 =
    oneTimePreKeyPrivate && oneTimePreKeyPrivate.length > 0
      ? deriveSharedSecret(oneTimePreKeyPrivate, senderEphemeralPublic)
      : new Uint8Array(0);

  const prefix = new Uint8Array(32).fill(0xff);
  const ikm = concatBytes(prefix, dh1, dh2, dh3, dh4);
  const rootKey = hkdf(
    sha256,
    ikm,
    new Uint8Array(32),
    utf8ToBytes(buildRootInfo(senderId, chatId)),
    32,
  );

  dh1.fill(0);
  dh2.fill(0);
  dh3.fill(0);
  if (dh4.length) dh4.fill(0);
  ikm.fill(0);

  return rootKey;
}

export type V3Envelope = {
  /** base64 ephemeral X25519 public key */
  ephemeralPublicKey: string;
  /** base64(nonce(12) || ciphertext || gcmTag(16)) */
  ciphertext: string;
  /** Set ONLY on the first message of a session (X3DH initiator). */
  senderIdentityPublicKey?: string;
  /** Set ONLY on the first message; identifies the OPK we consumed. */
  preKeyId?: string;
};

/**
 * Encrypt the FIRST message of a session — runs X3DH and produces an
 * envelope carrying the sender's identity pub + preKeyId so the recipient
 * can recompute the root key.
 */
export function encryptFirstMessageV3(args: {
  plaintext: string;
  senderIdentityKeyPair: { publicKey: Uint8Array; privateKey: Uint8Array };
  recipientBundle: RecipientBundle;
  senderId: string;
  chatId: string;
}): { envelope: V3Envelope; rootKey: Uint8Array } {
  const { plaintext, senderIdentityKeyPair, recipientBundle, senderId, chatId } = args;

  const session = establishSessionAsSender({
    senderIdentityPrivate: senderIdentityKeyPair.privateKey,
    bundle: recipientBundle,
    senderId,
    chatId,
  });
  const ephemeralB64 = bytesToBase64(session.ephemeralPublicKey);

  const aesKey = hkdf(
    sha256,
    session.rootKey,
    session.ephemeralPublicKey.slice(0, 16),
    utf8ToBytes(buildMsg0Info(senderId, chatId)),
    32,
  );
  const nonce = randomBytes(12);
  const aad = buildAadV3(senderId, chatId, ephemeralB64);
  const ct = gcm(aesKey, nonce, aad).encrypt(utf8ToBytes(plaintext));

  const blob = new Uint8Array(nonce.length + ct.length);
  blob.set(nonce, 0);
  blob.set(ct, nonce.length);

  const envelope: V3Envelope = {
    ephemeralPublicKey: ephemeralB64,
    ciphertext: bytesToBase64(blob),
    senderIdentityPublicKey: bytesToBase64(senderIdentityKeyPair.publicKey),
    ...(recipientBundle.oneTimePreKeyId
      ? { preKeyId: recipientBundle.oneTimePreKeyId }
      : {}),
  };
  aesKey.fill(0);
  return { envelope, rootKey: session.rootKey };
}

/**
 * Encrypt a follow-up message in an established session. Uses a fresh
 * ephemeral keypair mixed with the cached rootKey, giving sender-side FS
 * while keeping the per-message latency low.
 *
 * Returns the envelope AND a `newRootKey` — the ratcheted session state the
 * caller MUST persist (replacing the old rootKey in SecureStore) before the
 * next send. Both sides independently derive the same newRootKey from:
 *   HKDF(rootKey || mix, salt=zeros, info=chain)
 * Caller is responsible for zeroing newRootKey after persisting.
 */
export function encryptFollowupMessageV3(args: {
  plaintext: string;
  rootKey: Uint8Array;
  recipientIdentityPublic: Uint8Array;
  senderId: string;
  chatId: string;
}): { envelope: V3Envelope; newRootKey: Uint8Array } {
  const { plaintext, rootKey, recipientIdentityPublic, senderId, chatId } = args;
  const ephemeral = generateX25519();
  try {
    const mix = deriveSharedSecret(ephemeral.privateKey, recipientIdentityPublic);
    const ikm = concatBytes(rootKey, mix);

    // Per-message AES key — salt is ephemeral pub prefix for uniqueness.
    const aesKey = hkdf(
      sha256,
      ikm,
      ephemeral.publicKey.slice(0, 16),
      utf8ToBytes(buildMsgNInfo(senderId, chatId)),
      32,
    );
    // Ratchet: next root key — zero salt, distinct info, same IKM.
    const newRootKey = hkdf(
      sha256,
      ikm,
      new Uint8Array(32),
      utf8ToBytes(buildChainInfo(senderId, chatId)),
      32,
    );

    const ephB64 = bytesToBase64(ephemeral.publicKey);
    const nonce = randomBytes(12);
    const aad = buildAadV3(senderId, chatId, ephB64);
    const ct = gcm(aesKey, nonce, aad).encrypt(utf8ToBytes(plaintext));

    const blob = new Uint8Array(nonce.length + ct.length);
    blob.set(nonce, 0);
    blob.set(ct, nonce.length);

    mix.fill(0);
    ikm.fill(0);
    aesKey.fill(0);
    // newRootKey is intentionally NOT zeroed here — returned to caller.

    return {
      envelope: { ephemeralPublicKey: ephB64, ciphertext: bytesToBase64(blob) },
      newRootKey,
    };
  } finally {
    ephemeral.privateKey.fill(0);
  }
}

/**
 * Decrypt a v3 envelope. Caller supplies the cached rootKey (subsequent
 * messages) OR the recipient identity/SPK/OPK needed to establish one
 * (first message). Returns the plaintext plus, when X3DH was run, the
 * freshly-derived rootKey so the caller can cache it.
 */
export function decryptV3(args: {
  envelope: V3Envelope;
  /** Required — always used in the per-msg DH or X3DH DH2. */
  recipientIdentityPrivate: Uint8Array;
  /** Required when envelope.senderIdentityPublicKey is present (first msg). */
  recipientSignedPreKeyPrivate?: Uint8Array;
  /** Required when envelope.preKeyId is present (first msg w/ OPK). */
  oneTimePreKeyPrivate?: Uint8Array | null;
  /** Cached rootKey for follow-up messages. */
  cachedRootKey?: Uint8Array | null;
  senderId: string;
  chatId: string;
}): { plaintext: string; rootKey?: Uint8Array } | null {
  try {
    const {
      envelope,
      recipientIdentityPrivate,
      recipientSignedPreKeyPrivate,
      oneTimePreKeyPrivate,
      cachedRootKey,
      senderId,
      chatId,
    } = args;

    const ephemeralPub = base64ToBytes(envelope.ephemeralPublicKey);
    const blob = base64ToBytes(envelope.ciphertext);
    if (blob.length < 12 + 16) return null;
    const nonce = blob.slice(0, 12);
    const ciphertext = blob.slice(12);
    const aad = buildAadV3(senderId, chatId, envelope.ephemeralPublicKey);

    const isFirst = !!envelope.senderIdentityPublicKey;

    if (isFirst) {
      if (!recipientSignedPreKeyPrivate) return null;
      const senderIdPub = base64ToBytes(envelope.senderIdentityPublicKey!);
      const rootKey = establishSessionAsRecipient({
        recipientIdentityPrivate,
        recipientSignedPreKeyPrivate,
        oneTimePreKeyPrivate: oneTimePreKeyPrivate ?? null,
        senderIdentityPublic: senderIdPub,
        senderEphemeralPublic: ephemeralPub,
        senderId,
        chatId,
      });
      const aesKey = hkdf(
        sha256,
        rootKey,
        ephemeralPub.slice(0, 16),
        utf8ToBytes(buildMsg0Info(senderId, chatId)),
        32,
      );
      try {
        const plaintext = bytesToUtf8(gcm(aesKey, nonce, aad).decrypt(ciphertext));
        return { plaintext, rootKey };
      } catch {
        // Wipe the freshly-derived rootKey if decryption failed.
        rootKey.fill(0);
        return null;
      } finally {
        aesKey.fill(0);
      }
    }

    // Follow-up message — we need the cached root key.
    if (!cachedRootKey) return null;
    const mix = deriveSharedSecret(recipientIdentityPrivate, ephemeralPub);
    const ikm = concatBytes(cachedRootKey, mix);
    const aesKey = hkdf(
      sha256,
      ikm,
      ephemeralPub.slice(0, 16),
      utf8ToBytes(buildMsgNInfo(senderId, chatId)),
      32,
    );
    // Ratchet: derive the same newRootKey the sender computed (mirror of encrypt path).
    const newRootKey = hkdf(
      sha256,
      ikm,
      new Uint8Array(32),
      utf8ToBytes(buildChainInfo(senderId, chatId)),
      32,
    );
    try {
      const plaintext = bytesToUtf8(gcm(aesKey, nonce, aad).decrypt(ciphertext));
      // Return newRootKey so the caller can persist it. Caller zeroes after saving.
      return { plaintext, rootKey: newRootKey };
    } catch {
      newRootKey.fill(0);
      return null;
    } finally {
      mix.fill(0);
      ikm.fill(0);
      aesKey.fill(0);
    }
  } catch {
    return null;
  }
}
