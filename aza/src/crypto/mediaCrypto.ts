/**
 * Chat media encryption.
 *
 * User-uploaded media (voice notes, images, video, documents) is sealed with a
 * random 256-bit per-file key before it ever leaves the device. The opaque blob
 * is uploaded to Cloudinary; the file key travels inside the message's E2EE
 * envelope (see chatStore.sendMedia), so only the recipient's devices can open
 * it. The server and Cloudinary only ever hold ciphertext.
 *
 * Format: blob = nonce(12) ‖ AES-256-GCM(ciphertext ‖ tag).
 */
import './random';
import { gcm } from '@noble/ciphers/aes.js';
import { randomBytes } from '@noble/ciphers/utils.js';

import { utf8ToBytes } from './codec';

const NONCE_LEN = 12;
const KEY_LEN = 32;
// Binds the ciphertext to this app/purpose so a blob can't be replayed as some
// other AES-GCM payload.
const AAD = utf8ToBytes('aza.chat.media.v1');

/**
 * Encrypt raw media bytes with a fresh random key.
 * Returns the uploadable blob and the per-file key (keep the key in the E2EE
 * envelope, never alongside the blob).
 */
export function encryptMedia(bytes: Uint8Array): { blob: Uint8Array; key: Uint8Array } {
  const key = randomBytes(KEY_LEN);
  const nonce = randomBytes(NONCE_LEN);
  const ct = gcm(key, nonce, AAD).encrypt(bytes);
  const blob = new Uint8Array(NONCE_LEN + ct.length);
  blob.set(nonce, 0);
  blob.set(ct, NONCE_LEN);
  return { blob, key };
}

/**
 * Decrypt a media blob with its per-file key.
 * Throws on a wrong key or tampered blob (GCM tag mismatch).
 */
export function decryptMedia(blob: Uint8Array, key: Uint8Array): Uint8Array {
  if (key.length !== KEY_LEN) throw new Error('media key must be 32 bytes');
  if (blob.length < NONCE_LEN + 16) throw new Error('media blob too short');
  const nonce = blob.slice(0, NONCE_LEN);
  const ct = blob.slice(NONCE_LEN);
  return gcm(key, nonce, AAD).decrypt(ct);
}
