import 'react-native-get-random-values';
import {
  generateRecoveryKey,
  encodeRecoveryKey,
  parseRecoveryKey,
  encryptBackupChunk,
  decryptBackupChunk,
} from '../backupCrypto';

describe('recovery key codec', () => {
  it('round-trips a generated key through its display form', () => {
    const { key, display } = generateRecoveryKey();
    const parsed = parseRecoveryKey(display);
    expect(parsed).not.toBeNull();
    expect(Array.from(parsed!)).toEqual(Array.from(key));
  });

  it('forgives separators, whitespace, and case', () => {
    const { key, display } = generateRecoveryKey();
    const sloppy = ` ${display.toLowerCase().replace(/-/g, ' ')} `;
    expect(Array.from(parseRecoveryKey(sloppy)!)).toEqual(Array.from(key));
  });

  it('rejects malformed input', () => {
    expect(parseRecoveryKey('not a code')).toBeNull();
    expect(parseRecoveryKey('ABCD-EFGH')).toBeNull(); // too short
    expect(parseRecoveryKey('')).toBeNull();
  });

  it('uses an alphabet without ambiguous characters', () => {
    const { display } = generateRecoveryKey();
    expect(display).not.toMatch(/[OILU]/);
  });

  it('maps O/I/L lookalikes back to their digits', () => {
    const key = new Uint8Array(32).fill(0x44);
    const display = encodeRecoveryKey(key);
    const lookalikes = display.replace(/0/g, 'O').replace(/1/g, 'I');
    expect(Array.from(parseRecoveryKey(lookalikes)!)).toEqual(Array.from(key));
  });
});

describe('backup chunk encryption', () => {
  it('round-trips a chunk', () => {
    const { key } = generateRecoveryKey();
    const plaintext = JSON.stringify({ version: 1, threads: { 'chat-1': [] } });
    const sealed = encryptBackupChunk(key, 0, plaintext);
    expect(decryptBackupChunk(key, 0, sealed)).toBe(plaintext);
  });

  it('fails closed on the wrong key', () => {
    const { key } = generateRecoveryKey();
    const { key: otherKey } = generateRecoveryKey();
    const sealed = encryptBackupChunk(key, 0, 'secret');
    expect(decryptBackupChunk(otherKey, 0, sealed)).toBeNull();
  });

  it('binds chunks to their position — reordering fails', () => {
    const { key } = generateRecoveryKey();
    const sealed = encryptBackupChunk(key, 3, 'secret');
    expect(decryptBackupChunk(key, 4, sealed)).toBeNull();
    expect(decryptBackupChunk(key, 3, sealed)).toBe('secret');
  });

  it('rejects truncated blobs', () => {
    const { key } = generateRecoveryKey();
    expect(decryptBackupChunk(key, 0, 'AAAA')).toBeNull();
  });
});
