/**
 * X3DH session establishment + v3 envelope round-trip.
 *
 * What's covered:
 *   - Alice runs X3DH against Bob's bundle, Bob recomputes the same rootKey.
 *   - First-message encryption/decryption end-to-end (with and without OPK).
 *   - Follow-up messages key off the cached rootKey + a fresh ephemeral.
 *   - Tampering with the AAD-bound fields fails closed.
 *   - The rootKey is symmetric: same value regardless of who derived it.
 */

import 'react-native-get-random-values';
import {
  decryptV3,
  encryptFirstMessageV3,
  encryptFollowupMessageV3,
  establishSessionAsRecipient,
  establishSessionAsSender,
  generateX25519,
  type RecipientBundle,
} from '../e2ee';
import { bytesToBase64 } from '../codec';

function buildBundle(): {
  bundleForSender: RecipientBundle;
  privates: {
    identityPriv: Uint8Array;
    spkPriv: Uint8Array;
    opkPriv: Uint8Array;
    opkKeyId: string;
  };
  publics: {
    identityPub: Uint8Array;
    spkPub: Uint8Array;
    opkPub: Uint8Array;
  };
} {
  const id = generateX25519();
  const spk = generateX25519();
  const opk = generateX25519();
  const opkKeyId = '42';
  return {
    bundleForSender: {
      identityPublicKey: id.publicKey,
      signedPreKeyPublic: spk.publicKey,
      oneTimePreKeyId: opkKeyId,
      oneTimePreKeyPublic: opk.publicKey,
    },
    privates: {
      identityPriv: id.privateKey,
      spkPriv: spk.privateKey,
      opkPriv: opk.privateKey,
      opkKeyId,
    },
    publics: {
      identityPub: id.publicKey,
      spkPub: spk.publicKey,
      opkPub: opk.publicKey,
    },
  };
}

describe('X3DH session establishment', () => {
  it('derives the same root key on both sides (with OPK)', () => {
    const senderIK = generateX25519();
    const bob = buildBundle();

    const senderResult = establishSessionAsSender({
      senderIdentityPrivate: senderIK.privateKey,
      bundle: bob.bundleForSender,
      senderId: 'alice',
      chatId: 'chat',
    });
    const recipientRoot = establishSessionAsRecipient({
      recipientIdentityPrivate: bob.privates.identityPriv,
      recipientSignedPreKeyPrivate: bob.privates.spkPriv,
      oneTimePreKeyPrivate: bob.privates.opkPriv,
      senderIdentityPublic: senderIK.publicKey,
      senderEphemeralPublic: senderResult.ephemeralPublicKey,
      senderId: 'alice',
      chatId: 'chat',
    });
    expect(Buffer.from(senderResult.rootKey).toString('hex')).toBe(
      Buffer.from(recipientRoot).toString('hex'),
    );
  });

  it('derives the same root key without an OPK', () => {
    const senderIK = generateX25519();
    const bob = buildBundle();
    const bundleNoOpk: RecipientBundle = {
      identityPublicKey: bob.bundleForSender.identityPublicKey,
      signedPreKeyPublic: bob.bundleForSender.signedPreKeyPublic,
    };

    const senderResult = establishSessionAsSender({
      senderIdentityPrivate: senderIK.privateKey,
      bundle: bundleNoOpk,
      senderId: 'alice',
      chatId: 'chat',
    });
    const recipientRoot = establishSessionAsRecipient({
      recipientIdentityPrivate: bob.privates.identityPriv,
      recipientSignedPreKeyPrivate: bob.privates.spkPriv,
      senderIdentityPublic: senderIK.publicKey,
      senderEphemeralPublic: senderResult.ephemeralPublicKey,
      senderId: 'alice',
      chatId: 'chat',
    });
    expect(Buffer.from(senderResult.rootKey).toString('hex')).toBe(
      Buffer.from(recipientRoot).toString('hex'),
    );
  });

  it('produces different root keys for different chat ids', () => {
    const senderIK = generateX25519();
    const bob = buildBundle();
    const a = establishSessionAsSender({
      senderIdentityPrivate: senderIK.privateKey,
      bundle: bob.bundleForSender,
      senderId: 'alice',
      chatId: 'chatA',
    });
    const b = establishSessionAsSender({
      senderIdentityPrivate: senderIK.privateKey,
      bundle: bob.bundleForSender,
      senderId: 'alice',
      chatId: 'chatB',
    });
    expect(Buffer.from(a.rootKey).toString('hex')).not.toBe(
      Buffer.from(b.rootKey).toString('hex'),
    );
  });
});

describe('v3 envelope round-trip', () => {
  it('encrypts the first message with X3DH and decrypts on the other side', () => {
    const senderIK = generateX25519();
    const bob = buildBundle();

    const { envelope, rootKey } = encryptFirstMessageV3({
      plaintext: 'first hi 🌍',
      senderIdentityKeyPair: senderIK,
      recipientBundle: bob.bundleForSender,
      senderId: 'alice',
      chatId: 'chat',
    });

    expect(envelope.senderIdentityPublicKey).toBe(bytesToBase64(senderIK.publicKey));
    expect(envelope.preKeyId).toBe(bob.privates.opkKeyId);

    const result = decryptV3({
      envelope,
      recipientIdentityPrivate: bob.privates.identityPriv,
      recipientSignedPreKeyPrivate: bob.privates.spkPriv,
      oneTimePreKeyPrivate: bob.privates.opkPriv,
      senderId: 'alice',
      chatId: 'chat',
    });
    expect(result).not.toBeNull();
    expect(result!.plaintext).toBe('first hi 🌍');
    expect(Buffer.from(result!.rootKey!).toString('hex')).toBe(
      Buffer.from(rootKey).toString('hex'),
    );
  });

  it('rejects first-message decryption when the wrong SPK private is supplied', () => {
    const senderIK = generateX25519();
    const bob = buildBundle();
    const wrongSpk = generateX25519();

    const { envelope } = encryptFirstMessageV3({
      plaintext: 'x',
      senderIdentityKeyPair: senderIK,
      recipientBundle: bob.bundleForSender,
      senderId: 'alice',
      chatId: 'chat',
    });
    expect(
      decryptV3({
        envelope,
        recipientIdentityPrivate: bob.privates.identityPriv,
        recipientSignedPreKeyPrivate: wrongSpk.privateKey,
        oneTimePreKeyPrivate: bob.privates.opkPriv,
        senderId: 'alice',
        chatId: 'chat',
      }),
    ).toBeNull();
  });

  it('rejects first-message decryption when the wrong OPK private is supplied', () => {
    const senderIK = generateX25519();
    const bob = buildBundle();
    const wrongOpk = generateX25519();

    const { envelope } = encryptFirstMessageV3({
      plaintext: 'x',
      senderIdentityKeyPair: senderIK,
      recipientBundle: bob.bundleForSender,
      senderId: 'alice',
      chatId: 'chat',
    });
    expect(
      decryptV3({
        envelope,
        recipientIdentityPrivate: bob.privates.identityPriv,
        recipientSignedPreKeyPrivate: bob.privates.spkPriv,
        oneTimePreKeyPrivate: wrongOpk.privateKey,
        senderId: 'alice',
        chatId: 'chat',
      }),
    ).toBeNull();
  });

  it('encrypts follow-up messages with a fresh ephemeral and keys off the cached root', () => {
    const senderIK = generateX25519();
    const bob = buildBundle();

    const first = encryptFirstMessageV3({
      plaintext: 'init',
      senderIdentityKeyPair: senderIK,
      recipientBundle: bob.bundleForSender,
      senderId: 'alice',
      chatId: 'chat',
    });
    // Bob derives the same root key from the first message.
    const bobRoot = decryptV3({
      envelope: first.envelope,
      recipientIdentityPrivate: bob.privates.identityPriv,
      recipientSignedPreKeyPrivate: bob.privates.spkPriv,
      oneTimePreKeyPrivate: bob.privates.opkPriv,
      senderId: 'alice',
      chatId: 'chat',
    })!.rootKey!;

    // Alice now sends a follow-up message using her cached root.
    const followup = encryptFollowupMessageV3({
      plaintext: 'second hi',
      rootKey: first.rootKey,
      recipientIdentityPublic: bob.publics.identityPub,
      senderId: 'alice',
      chatId: 'chat',
    });
    expect(followup.envelope.senderIdentityPublicKey).toBeUndefined();
    expect(followup.envelope.preKeyId).toBeUndefined();
    expect(followup.newRootKey).toHaveLength(32);

    const decoded = decryptV3({
      envelope: followup.envelope,
      recipientIdentityPrivate: bob.privates.identityPriv,
      cachedRootKey: bobRoot,
      senderId: 'alice',
      chatId: 'chat',
    });
    expect(decoded).not.toBeNull();
    expect(decoded!.plaintext).toBe('second hi');
    // Both sides should derive the same ratcheted root key.
    expect(Buffer.from(decoded!.rootKey!).toString('hex')).toBe(
      Buffer.from(followup.newRootKey).toString('hex'),
    );
  });

  it('follow-up decryption fails without a cached root', () => {
    const senderIK = generateX25519();
    const bob = buildBundle();
    const first = encryptFirstMessageV3({
      plaintext: 'init',
      senderIdentityKeyPair: senderIK,
      recipientBundle: bob.bundleForSender,
      senderId: 'alice',
      chatId: 'chat',
    });
    const { envelope: followupEnvelope } = encryptFollowupMessageV3({
      plaintext: 'second hi',
      rootKey: first.rootKey,
      recipientIdentityPublic: bob.publics.identityPub,
      senderId: 'alice',
      chatId: 'chat',
    });
    expect(
      decryptV3({
        envelope: followupEnvelope,
        recipientIdentityPrivate: bob.privates.identityPriv,
        senderId: 'alice',
        chatId: 'chat',
      }),
    ).toBeNull();
  });

  it('ratchets the root key forward: both sides derive the same newRootKey', () => {
    const senderIK = generateX25519();
    const bob = buildBundle();

    // Establish session
    const first = encryptFirstMessageV3({
      plaintext: 'msg0',
      senderIdentityKeyPair: senderIK,
      recipientBundle: bob.bundleForSender,
      senderId: 'alice',
      chatId: 'chat',
    });
    const bobDecrypt0 = decryptV3({
      envelope: first.envelope,
      recipientIdentityPrivate: bob.privates.identityPriv,
      recipientSignedPreKeyPrivate: bob.privates.spkPriv,
      oneTimePreKeyPrivate: bob.privates.opkPriv,
      senderId: 'alice',
      chatId: 'chat',
    })!;
    let aliceRoot = first.rootKey;
    let bobRoot   = bobDecrypt0.rootKey!;

    // Alice sends follow-up #1
    const fu1 = encryptFollowupMessageV3({
      plaintext: 'msg1',
      rootKey: aliceRoot,
      recipientIdentityPublic: bob.publics.identityPub,
      senderId: 'alice',
      chatId: 'chat',
    });
    const bobDecrypt1 = decryptV3({
      envelope: fu1.envelope,
      recipientIdentityPrivate: bob.privates.identityPriv,
      cachedRootKey: bobRoot,
      senderId: 'alice',
      chatId: 'chat',
    })!;
    expect(bobDecrypt1.plaintext).toBe('msg1');
    // Both sides derive the same ratcheted root
    expect(Buffer.from(fu1.newRootKey).toString('hex')).toBe(
      Buffer.from(bobDecrypt1.rootKey!).toString('hex'),
    );

    // Advance both ratchets
    aliceRoot = fu1.newRootKey;
    bobRoot   = bobDecrypt1.rootKey!;

    // Alice sends follow-up #2 using the ratcheted root
    const fu2 = encryptFollowupMessageV3({
      plaintext: 'msg2',
      rootKey: aliceRoot,
      recipientIdentityPublic: bob.publics.identityPub,
      senderId: 'alice',
      chatId: 'chat',
    });
    const bobDecrypt2 = decryptV3({
      envelope: fu2.envelope,
      recipientIdentityPrivate: bob.privates.identityPriv,
      cachedRootKey: bobRoot,
      senderId: 'alice',
      chatId: 'chat',
    })!;
    expect(bobDecrypt2.plaintext).toBe('msg2');
    expect(Buffer.from(fu2.newRootKey).toString('hex')).toBe(
      Buffer.from(bobDecrypt2.rootKey!).toString('hex'),
    );
  });

  it('old root key cannot decrypt a message encrypted under the ratcheted root', () => {
    const senderIK = generateX25519();
    const bob = buildBundle();
    const first = encryptFirstMessageV3({
      plaintext: 'init',
      senderIdentityKeyPair: senderIK,
      recipientBundle: bob.bundleForSender,
      senderId: 'alice',
      chatId: 'chat',
    });
    const bobRoot0 = decryptV3({
      envelope: first.envelope,
      recipientIdentityPrivate: bob.privates.identityPriv,
      recipientSignedPreKeyPrivate: bob.privates.spkPriv,
      oneTimePreKeyPrivate: bob.privates.opkPriv,
      senderId: 'alice',
      chatId: 'chat',
    })!.rootKey!;

    // Alice sends a follow-up and advances the ratchet
    const fu1 = encryptFollowupMessageV3({
      plaintext: 'next',
      rootKey: first.rootKey,
      recipientIdentityPublic: bob.publics.identityPub,
      senderId: 'alice',
      chatId: 'chat',
    });

    // Alice sends a second follow-up using the ratcheted key
    const fu2 = encryptFollowupMessageV3({
      plaintext: 'after ratchet',
      rootKey: fu1.newRootKey,
      recipientIdentityPublic: bob.publics.identityPub,
      senderId: 'alice',
      chatId: 'chat',
    });

    // Bob tries to decrypt fu2 using the original root (before any ratchet)
    const attempt = decryptV3({
      envelope: fu2.envelope,
      recipientIdentityPrivate: bob.privates.identityPriv,
      cachedRootKey: bobRoot0,
      senderId: 'alice',
      chatId: 'chat',
    });
    expect(attempt).toBeNull();
  });

  it('rejects AAD tampering — chat id swap on follow-up', () => {
    const senderIK = generateX25519();
    const bob = buildBundle();
    const first = encryptFirstMessageV3({
      plaintext: 'init',
      senderIdentityKeyPair: senderIK,
      recipientBundle: bob.bundleForSender,
      senderId: 'alice',
      chatId: 'chatA',
    });
    const bobRoot = decryptV3({
      envelope: first.envelope,
      recipientIdentityPrivate: bob.privates.identityPriv,
      recipientSignedPreKeyPrivate: bob.privates.spkPriv,
      oneTimePreKeyPrivate: bob.privates.opkPriv,
      senderId: 'alice',
      chatId: 'chatA',
    })!.rootKey!;
    const { envelope: followupEnvelope } = encryptFollowupMessageV3({
      plaintext: 'second hi',
      rootKey: first.rootKey,
      recipientIdentityPublic: bob.publics.identityPub,
      senderId: 'alice',
      chatId: 'chatA',
    });
    expect(
      decryptV3({
        envelope: followupEnvelope,
        recipientIdentityPrivate: bob.privates.identityPriv,
        cachedRootKey: bobRoot,
        senderId: 'alice',
        chatId: 'chatB',
      }),
    ).toBeNull();
  });
});
