/**
 * Chat backup encryption.
 *
 * Backups are sealed with a random 256-bit recovery key that only the user
 * holds — shown once as a 13-group code and never sent to the server. Because
 * the key is random (not derived from a PIN), there is nothing to brute-force
 * server-side: the blobs are opaque without the code.
 */
import './random';
import { gcm } from '@noble/ciphers/aes.js';
import { randomBytes } from '@noble/ciphers/utils.js';

import { base64ToBytes, bytesToBase64, bytesToUtf8, utf8ToBytes } from './codec';

/** Crockford base32: exactly 32 symbols, excluding I/L/O/U. The lookalikes
 *  are mapped back at parse time (O→0, I/L→1), so transcription survives. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const GROUP_LEN = 4;

/** 32 random bytes → 52 chars (5 bits each, 260 bits ≥ 256) in groups of 4. */
export function generateRecoveryKey(): { key: Uint8Array; display: string } {
  const key = randomBytes(32);
  return { key, display: encodeRecoveryKey(key) };
}

export function encodeRecoveryKey(key: Uint8Array): string {
  let bits = 0;
  let acc = 0;
  let out = '';
  for (const byte of key) {
    acc = (acc << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += ALPHABET[(acc >> bits) & 31];
      // Keep only the unconsumed low bits — JS bitwise math is 32-bit.
      acc &= (1 << bits) - 1;
    }
  }
  if (bits > 0) out += ALPHABET[(acc << (5 - bits)) & 31];
  return out.match(new RegExp(`.{1,${GROUP_LEN}}`, 'g'))!.join('-');
}

/** Parse a user-typed recovery code back to key bytes. Returns null if malformed.
 *  Separators, case, and the classic O/I/L lookalikes are forgiven. */
export function parseRecoveryKey(input: string): Uint8Array | null {
  const cleaned = input.toUpperCase().replace(/[\s-]/g, '')
    .replace(/O/g, '0').replace(/[IL]/g, '1');
  let bits = 0;
  let acc = 0;
  const out: number[] = [];
  for (const ch of cleaned) {
    const v = ALPHABET.indexOf(ch);
    if (v < 0) return null;
    acc = (acc << 5) | v;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((acc >> bits) & 0xff);
      acc &= (1 << bits) - 1;
    }
  }
  if (out.length < 32) return null;
  return new Uint8Array(out.slice(0, 32));
}

/** Seal one backup chunk. AAD binds the chunk to its position so the server
 *  can't reorder or substitute chunks undetected. */
export function encryptBackupChunk(key: Uint8Array, seq: number, plaintext: string): string {
  const nonce = randomBytes(12);
  const aad = utf8ToBytes(`aza.chat.backup.v1|${seq}`);
  const ct = gcm(key, nonce, aad).encrypt(utf8ToBytes(plaintext));
  const out = new Uint8Array(nonce.length + ct.length);
  out.set(nonce, 0);
  out.set(ct, nonce.length);
  return bytesToBase64(out);
}

/** Open one backup chunk. Returns null on a wrong key or tampered blob. */
export function decryptBackupChunk(key: Uint8Array, seq: number, blob: string): string | null {
  try {
    const bytes = base64ToBytes(blob);
    if (bytes.length < 12 + 16) return null;
    const nonce = bytes.slice(0, 12);
    const ct = bytes.slice(12);
    const aad = utf8ToBytes(`aza.chat.backup.v1|${seq}`);
    return bytesToUtf8(gcm(key, nonce, aad).decrypt(ct));
  } catch {
    return null;
  }
}
