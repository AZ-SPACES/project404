/**
 * Self-contained TOTP (RFC 6238 / HOTP RFC 4226) implementation.
 * Uses the same algorithm as Google Authenticator: HMAC-SHA1, 30-second window, 6 digits.
 * No external dependencies — avoids ESM subpath resolution issues with @noble/hashes.
 */

// --- Base32 ---
function base32Decode(input: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = input.toUpperCase().replace(/[=\s]/g, '');
  const bytes: number[] = [];
  let buffer = 0;
  let bitsLeft = 0;
  for (const char of clean) {
    const val = alphabet.indexOf(char);
    if (val < 0) continue;
    buffer = (buffer << 5) | val;
    bitsLeft += 5;
    if (bitsLeft >= 8) {
      bitsLeft -= 8;
      bytes.push((buffer >> bitsLeft) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

// --- SHA-1 (pure JS, RFC 3174) ---
function sha1(data: Uint8Array): Uint8Array {
  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
  const msg = Array.from(data);
  const origLen = msg.length;
  msg.push(0x80);
  while (msg.length % 64 !== 56) msg.push(0);
  const bits = origLen * 8;
  for (let i = 7; i >= 0; i--) msg.push((bits / Math.pow(256, i)) & 0xff);

  for (let i = 0; i < msg.length; i += 64) {
    const w: number[] = [];
    for (let j = 0; j < 16; j++) {
      w[j] = ((msg[i + j * 4] ?? 0) << 24) | ((msg[i + j * 4 + 1] ?? 0) << 16) |
              ((msg[i + j * 4 + 2] ?? 0) << 8) | (msg[i + j * 4 + 3] ?? 0);
    }
    for (let j = 16; j < 80; j++) {
      const x = (w[j - 3] ?? 0) ^ (w[j - 8] ?? 0) ^ (w[j - 14] ?? 0) ^ (w[j - 16] ?? 0);
      w[j] = ((x << 1) | (x >>> 31)) >>> 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let j = 0; j < 80; j++) {
      let f: number, k: number;
      if (j < 20)       { f = (b & c) | (~b & d);          k = 0x5a827999; }
      else if (j < 40) { f = b ^ c ^ d;                    k = 0x6ed9eba1; }
      else if (j < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc; }
      else              { f = b ^ c ^ d;                    k = 0xca62c1d6; }
      const temp = (((a << 5) | (a >>> 27)) + f + e + k + (w[j] ?? 0)) >>> 0;
      e = d; d = c; c = ((b << 30) | (b >>> 2)) >>> 0; b = a; a = temp;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
  }
  const out = new Uint8Array(20);
  [h0, h1, h2, h3, h4].forEach((h, i) => {
    out[i * 4]     = (h >>> 24) & 0xff;
    out[i * 4 + 1] = (h >>> 16) & 0xff;
    out[i * 4 + 2] = (h >>> 8)  & 0xff;
    out[i * 4 + 3] =  h         & 0xff;
  });
  return out;
}

// --- HMAC-SHA1 (RFC 2104) ---
function hmacSha1(key: Uint8Array, msg: Uint8Array): Uint8Array {
  const blockSize = 64;
  let k = key.length > blockSize ? sha1(key) : key;
  const ipad = new Uint8Array(blockSize + msg.length);
  const opad = new Uint8Array(blockSize + 20);
  for (let i = 0; i < blockSize; i++) {
    ipad[i] = (k[i] ?? 0) ^ 0x36;
    opad[i] = (k[i] ?? 0) ^ 0x5c;
  }
  ipad.set(msg, blockSize);
  const inner = sha1(ipad);
  opad.set(inner, blockSize);
  return sha1(opad);
}

// --- TOTP ---
export function generateRecoveryCode(secret: string, period = 30): string {
  const key = base32Decode(secret);
  const counter = Math.floor(Date.now() / 1000 / period);
  const msg = new Uint8Array(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) {
    msg[i] = c & 0xff;
    c = Math.floor(c / 256);
  }
  const hash = hmacSha1(key, msg);
  const offset = (hash[19] ?? 0) & 0x0f;
  const code = (((hash[offset] ?? 0) & 0x7f) << 24)
    | (((hash[offset + 1] ?? 0)) << 16)
    | (((hash[offset + 2] ?? 0)) << 8)
    |  ((hash[offset + 3] ?? 0));
  return String(code % 1_000_000).padStart(6, '0');
}

export function secondsUntilRefresh(period = 30): number {
  return period - (Math.floor(Date.now() / 1000) % period);
}
