import 'react-native-get-random-values';
import { encryptMedia, decryptMedia } from '../mediaCrypto';

function randomData(n: number): Uint8Array {
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = (i * 31 + 7) & 0xff;
  return out;
}

describe('media encryption', () => {
  it('round-trips media bytes through encrypt/decrypt', () => {
    const data = randomData(4096);
    const { blob, key } = encryptMedia(data);
    expect(Array.from(decryptMedia(blob, key))).toEqual(Array.from(data));
  });

  it('round-trips an empty payload', () => {
    const { blob, key } = encryptMedia(new Uint8Array(0));
    expect(decryptMedia(blob, key).length).toBe(0);
  });

  it('uses a fresh key and nonce per call', () => {
    const data = randomData(64);
    const a = encryptMedia(data);
    const b = encryptMedia(data);
    expect(Array.from(a.key)).not.toEqual(Array.from(b.key));
    expect(Array.from(a.blob)).not.toEqual(Array.from(b.blob)); // different nonce
  });

  it('produces a blob larger than the plaintext (nonce + tag overhead)', () => {
    const data = randomData(100);
    const { blob } = encryptMedia(data);
    expect(blob.length).toBe(100 + 12 + 16);
  });

  it('fails to decrypt with the wrong key', () => {
    const { blob } = encryptMedia(randomData(256));
    const wrong = encryptMedia(randomData(1)).key;
    expect(() => decryptMedia(blob, wrong)).toThrow();
  });

  it('fails to decrypt a tampered blob', () => {
    const { blob, key } = encryptMedia(randomData(256));
    const last = blob.length - 1;
    blob[last] = (blob[last]! ^ 0xff) & 0xff; // flip a ciphertext/tag bit
    expect(() => decryptMedia(blob, key)).toThrow();
  });

  it('rejects a malformed key length', () => {
    const { blob } = encryptMedia(randomData(32));
    expect(() => decryptMedia(blob, new Uint8Array(16))).toThrow();
  });
});
