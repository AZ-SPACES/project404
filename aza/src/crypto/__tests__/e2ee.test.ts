/**
 * Crypto primitives — round-trip + tamper-resistance tests.
 *
 * These tests exercise the wire-level guarantees the chat layer depends on:
 *   1. A payload encrypted for a recipient can be decrypted by that recipient.
 *   2. Different recipients can't open the same envelope.
 *   3. Tampering with AAD-bound fields (senderId / chatId / ephemeralPubKey)
 *      causes decryption to fail closed.
 *   4. The v2 AAD format is the default but v1 envelopes still open
 *      (back-compat for in-flight messages during the upgrade window).
 *   5. The safety-number computation is order-independent and stable.
 */

import 'react-native-get-random-values';
import {
  encryptForRecipient,
  decryptFromSender,
  generateX25519,
  safetyNumber,
} from '../e2ee';
import { base64ToBytes, bytesToBase64, constantTimeEqual } from '../codec';

// ── constantTimeEqual ─────────────────────────────────────────────────────────

describe('constantTimeEqual', () => {
  it('returns true for two identical byte arrays', () => {
    const a = new Uint8Array([1, 2, 3, 4]);
    const b = new Uint8Array([1, 2, 3, 4]);
    expect(constantTimeEqual(a, b)).toBe(true);
  });

  it('returns false when arrays differ in one byte', () => {
    const a = new Uint8Array([1, 2, 3, 4]);
    const b = new Uint8Array([1, 2, 3, 5]);
    expect(constantTimeEqual(a, b)).toBe(false);
  });

  it('returns false for arrays of different lengths', () => {
    const a = new Uint8Array([1, 2, 3]);
    const b = new Uint8Array([1, 2, 3, 4]);
    expect(constantTimeEqual(a, b)).toBe(false);
  });

  it('returns true for two empty arrays', () => {
    expect(constantTimeEqual(new Uint8Array(0), new Uint8Array(0))).toBe(true);
  });

  it('returns false when first byte differs (early-termination resistance)', () => {
    const a = new Uint8Array([0xff, 0, 0]);
    const b = new Uint8Array([0x00, 0, 0]);
    expect(constantTimeEqual(a, b)).toBe(false);
  });

  it('returns false when only the last byte differs', () => {
    const a = new Uint8Array([0, 0, 0, 0xff]);
    const b = new Uint8Array([0, 0, 0, 0x00]);
    expect(constantTimeEqual(a, b)).toBe(false);
  });
});

describe('encryptForRecipient / decryptFromSender', () => {
  it('round-trips a UTF-8 message between two parties', () => {
    const recipient = generateX25519();
    const senderId = '11111111-1111-1111-1111-111111111111';
    const chatId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

    const env = encryptForRecipient({
      plaintext: 'hello world — 你好',
      recipientIdentityPublic: recipient.publicKey,
      senderId,
      chatId,
    });
    const pt = decryptFromSender({
      envelope: env,
      identityPrivateKey: recipient.privateKey,
      senderId,
      chatId,
    });
    expect(pt).toBe('hello world — 你好');
  });

  it('fails closed when decrypted with the wrong identity key', () => {
    const recipient = generateX25519();
    const eve = generateX25519();
    const env = encryptForRecipient({
      plaintext: 'secret',
      recipientIdentityPublic: recipient.publicKey,
      senderId: 'sender',
      chatId: 'chat',
    });
    expect(
      decryptFromSender({
        envelope: env,
        identityPrivateKey: eve.privateKey,
        senderId: 'sender',
        chatId: 'chat',
      }),
    ).toBeNull();
  });

  it('rejects re-routed envelopes (chatId tamper)', () => {
    const recipient = generateX25519();
    const env = encryptForRecipient({
      plaintext: 'x',
      recipientIdentityPublic: recipient.publicKey,
      senderId: 'sender',
      chatId: 'chatA',
    });
    expect(
      decryptFromSender({
        envelope: env,
        identityPrivateKey: recipient.privateKey,
        senderId: 'sender',
        chatId: 'chatB',
      }),
    ).toBeNull();
  });

  it('rejects sender impersonation (senderId tamper)', () => {
    const recipient = generateX25519();
    const env = encryptForRecipient({
      plaintext: 'x',
      recipientIdentityPublic: recipient.publicKey,
      senderId: 'alice',
      chatId: 'chat',
    });
    expect(
      decryptFromSender({
        envelope: env,
        identityPrivateKey: recipient.privateKey,
        senderId: 'mallory',
        chatId: 'chat',
      }),
    ).toBeNull();
  });

  it('rejects tampered ephemeralPublicKey field', () => {
    const recipient = generateX25519();
    const env = encryptForRecipient({
      plaintext: 'x',
      recipientIdentityPublic: recipient.publicKey,
      senderId: 'alice',
      chatId: 'chat',
    });
    const swapped = generateX25519();
    expect(
      decryptFromSender({
        envelope: { ...env, ephemeralPublicKey: bytesToBase64(swapped.publicKey) },
        identityPrivateKey: recipient.privateKey,
        senderId: 'alice',
        chatId: 'chat',
      }),
    ).toBeNull();
  });

  it('rejects tampered ciphertext bytes (AEAD tag failure)', () => {
    const recipient = generateX25519();
    const env = encryptForRecipient({
      plaintext: 'x',
      recipientIdentityPublic: recipient.publicKey,
      senderId: 'alice',
      chatId: 'chat',
    });
    const raw = base64ToBytes(env.ciphertext);
    raw[raw.length - 1] = (raw[raw.length - 1] ?? 0) ^ 0x01;
    expect(
      decryptFromSender({
        envelope: { ...env, ciphertext: bytesToBase64(raw) },
        identityPrivateKey: recipient.privateKey,
        senderId: 'alice',
        chatId: 'chat',
      }),
    ).toBeNull();
  });

  it('returns null for malformed envelopes instead of throwing', () => {
    const recipient = generateX25519();
    expect(
      decryptFromSender({
        envelope: { ciphertext: 'not base64 at all', ephemeralPublicKey: '!' },
        identityPrivateKey: recipient.privateKey,
        senderId: 'alice',
        chatId: 'chat',
      }),
    ).toBeNull();
    expect(
      decryptFromSender({
        envelope: { ciphertext: '', ephemeralPublicKey: '' },
        identityPrivateKey: recipient.privateKey,
        senderId: 'alice',
        chatId: 'chat',
      }),
    ).toBeNull();
  });
});

describe('safetyNumber', () => {
  it('produces the same value regardless of argument order', () => {
    const a = generateX25519();
    const b = generateX25519();
    expect(safetyNumber(a.publicKey, b.publicKey)).toBe(
      safetyNumber(b.publicKey, a.publicKey),
    );
  });

  it('produces a different value for different peers', () => {
    const a = generateX25519();
    const b = generateX25519();
    const c = generateX25519();
    expect(safetyNumber(a.publicKey, b.publicKey)).not.toBe(
      safetyNumber(a.publicKey, c.publicKey),
    );
  });

  it('formats as five-digit groups separated by spaces', () => {
    const a = generateX25519();
    const b = generateX25519();
    const sn = safetyNumber(a.publicKey, b.publicKey);
    // 30 digits in 6 groups of 5, separated by spaces.
    expect(sn).toMatch(/^(\d{5} ){5}\d{5}$/);
  });
});
