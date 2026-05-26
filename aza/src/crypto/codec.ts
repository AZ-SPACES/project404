/**
 * Base64 + UTF-8 codecs. The backend stores key material and ciphertexts as
 * base64 strings; we use base64 consistently on the wire.
 */

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i]!;
    const b2 = i + 1 < bytes.length ? bytes[i + 1]! : 0;
    const b3 = i + 2 < bytes.length ? bytes[i + 2]! : 0;
    out += BASE64_ALPHABET[b1 >> 2];
    out += BASE64_ALPHABET[((b1 & 0x03) << 4) | (b2 >> 4)];
    out += i + 1 < bytes.length ? BASE64_ALPHABET[((b2 & 0x0f) << 2) | (b3 >> 6)] : '=';
    out += i + 2 < bytes.length ? BASE64_ALPHABET[b3 & 0x3f] : '=';
  }
  return out;
}

export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/=]/g, '');
  const pad = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const len = (clean.length / 4) * 3 - pad;
  const out = new Uint8Array(len);
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const c1 = BASE64_ALPHABET.indexOf(clean[i]!);
    const c2 = BASE64_ALPHABET.indexOf(clean[i + 1]!);
    const c3 = BASE64_ALPHABET.indexOf(clean[i + 2]!);
    const c4 = BASE64_ALPHABET.indexOf(clean[i + 3]!);
    const t = (c1 << 18) | (c2 << 12) | ((c3 & 63) << 6) | (c4 & 63);
    if (p < len) out[p++] = (t >> 16) & 0xff;
    if (p < len) out[p++] = (t >> 8) & 0xff;
    if (p < len) out[p++] = t & 0xff;
  }
  return out;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8');

export const utf8ToBytes = (s: string): Uint8Array => textEncoder.encode(s);
export const bytesToUtf8 = (b: Uint8Array): string => textDecoder.decode(b);

/** Constant-time byte comparison. Returns true iff the inputs are equal. */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}
