/**
 * Keystore — signed pre-key rotation and OPK lifecycle.
 *
 * All functions now require both a userId AND a deviceId.
 */

import 'react-native-get-random-values';

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
    getItemAsync:    jest.fn(async (k: string)            => store.get(k) ?? null),
    setItemAsync:    jest.fn(async (k: string, v: string) => { store.set(k, v); }),
    deleteItemAsync: jest.fn(async (k: string)            => { store.delete(k); }),
    __reset:         () => store.clear(),
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SecureStoreMock = require('expo-secure-store') as { __reset: () => void };

import {
  ensureSignedPreKey,
  getSignedPreKeyPrivate,
  isSignedPreKeyStale,
  rotateSignedPreKey,
  getPreviousSignedPreKeyPrivate,
  generateOneTimePreKeys,
  otpkPrivateCount,
  consumeOneTimePreKey,
  readOneTimePreKey,
  deleteConsumedOneTimePreKey,
  purgeAllOneTimePreKeys,
  wipeIdentity,
} from '../keystore';

const UID = 'user-keystore-test';
const DID = 'device-test-001';
const SPK_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const SPK_GRACE_MS   = 30 * 24 * 60 * 60 * 1000;

beforeEach(() => {
  SecureStoreMock.__reset();
  jest.useRealTimers();
});

// ── ensureSignedPreKey ────────────────────────────────────────────────────────

describe('ensureSignedPreKey', () => {
  it('returns a 32-byte X25519 public key', async () => {
    const { publicKey } = await ensureSignedPreKey(UID, DID);
    expect(publicKey).toHaveLength(32);
  });

  it('returns a 64-byte Ed25519 signature', async () => {
    const { signature } = await ensureSignedPreKey(UID, DID);
    expect(signature).toHaveLength(64);
  });

  it('is idempotent: second call returns the same public key', async () => {
    const first  = await ensureSignedPreKey(UID, DID);
    const second = await ensureSignedPreKey(UID, DID);
    expect(Buffer.from(first.publicKey).toString('hex')).toBe(
      Buffer.from(second.publicKey).toString('hex'),
    );
  });

  it('marks the new key as fresh (not stale) immediately after creation', async () => {
    await ensureSignedPreKey(UID, DID);
    expect(await isSignedPreKeyStale(UID, DID)).toBe(false);
  });
});

// ── isSignedPreKeyStale ───────────────────────────────────────────────────────

describe('isSignedPreKeyStale', () => {
  it('returns true when no SPK exists at all', async () => {
    expect(await isSignedPreKeyStale(UID, DID)).toBe(true);
  });

  it('returns false for a freshly-created key', async () => {
    await ensureSignedPreKey(UID, DID);
    expect(await isSignedPreKeyStale(UID, DID)).toBe(false);
  });

  it('returns true after the max-age window has elapsed', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    await ensureSignedPreKey(UID, DID);

    jest.setSystemTime(new Date('2026-01-08T00:00:01.000Z'));
    expect(await isSignedPreKeyStale(UID, DID)).toBe(true);
  });

  it('returns false one millisecond before the max-age window closes', async () => {
    jest.useFakeTimers();
    const start = new Date('2026-01-01T00:00:00.000Z');
    jest.setSystemTime(start);
    await ensureSignedPreKey(UID, DID);

    jest.setSystemTime(new Date(start.getTime() + SPK_MAX_AGE_MS - 1));
    expect(await isSignedPreKeyStale(UID, DID)).toBe(false);
  });
});

// ── rotateSignedPreKey ────────────────────────────────────────────────────────

describe('rotateSignedPreKey', () => {
  it('generates a new key with a different public key than the old one', async () => {
    const { publicKey: oldPub } = await ensureSignedPreKey(UID, DID);
    const { publicKey: newPub } = await rotateSignedPreKey(UID, DID);
    expect(Buffer.from(oldPub).toString('hex')).not.toBe(
      Buffer.from(newPub).toString('hex'),
    );
  });

  it('produces a valid 64-byte signature on the new key', async () => {
    await ensureSignedPreKey(UID, DID);
    const { signature } = await rotateSignedPreKey(UID, DID);
    expect(signature).toHaveLength(64);
  });

  it('resets staleness: isSignedPreKeyStale returns false after rotation', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    await ensureSignedPreKey(UID, DID);
    jest.setSystemTime(new Date('2026-01-09T00:00:00.000Z'));
    expect(await isSignedPreKeyStale(UID, DID)).toBe(true);

    await rotateSignedPreKey(UID, DID);
    expect(await isSignedPreKeyStale(UID, DID)).toBe(false);
  });
});

// ── getPreviousSignedPreKeyPrivate ────────────────────────────────────────────

describe('getPreviousSignedPreKeyPrivate', () => {
  it('returns null when no rotation has ever occurred', async () => {
    expect(await getPreviousSignedPreKeyPrivate(UID, DID)).toBeNull();
  });

  it('returns the pre-rotation private key immediately after rotation', async () => {
    await ensureSignedPreKey(UID, DID);
    const oldPriv = await getSignedPreKeyPrivate(UID, DID);

    await rotateSignedPreKey(UID, DID);
    const prevPriv = await getPreviousSignedPreKeyPrivate(UID, DID);

    expect(prevPriv).not.toBeNull();
    expect(Buffer.from(prevPriv!).toString('hex')).toBe(
      Buffer.from(oldPriv!).toString('hex'),
    );
  });

  it('returns null and purges the previous key after the 30-day grace period', async () => {
    jest.useFakeTimers();
    const rotationTime = new Date('2026-01-01T00:00:00.000Z');
    jest.setSystemTime(rotationTime);

    await ensureSignedPreKey(UID, DID);
    await rotateSignedPreKey(UID, DID);

    jest.setSystemTime(new Date(rotationTime.getTime() + SPK_GRACE_MS + 1_000));

    const result = await getPreviousSignedPreKeyPrivate(UID, DID);
    expect(result).toBeNull();
  });

  it('still returns the previous key one millisecond before grace period expires', async () => {
    jest.useFakeTimers();
    const rotationTime = new Date('2026-01-01T00:00:00.000Z');
    jest.setSystemTime(rotationTime);

    await ensureSignedPreKey(UID, DID);
    await rotateSignedPreKey(UID, DID);

    jest.setSystemTime(new Date(rotationTime.getTime() + SPK_GRACE_MS - 1));
    const result = await getPreviousSignedPreKeyPrivate(UID, DID);
    expect(result).not.toBeNull();
  });
});

// ── OPK lifecycle ─────────────────────────────────────────────────────────────

describe('generateOneTimePreKeys', () => {
  it('returns the requested number of key pairs', async () => {
    const keys = await generateOneTimePreKeys(UID, DID, 5);
    expect(keys).toHaveLength(5);
  });

  it('each key has a unique keyId and a 32-byte public key', async () => {
    const keys = await generateOneTimePreKeys(UID, DID, 3);
    const ids = new Set(keys.map((k) => k.keyId));
    expect(ids.size).toBe(3);
    for (const k of keys) {
      expect(k.publicKey).toHaveLength(32);
    }
  });

  it('assigns monotonically increasing keyIds starting from 1', async () => {
    const keys = await generateOneTimePreKeys(UID, DID, 3);
    expect(keys.map((k) => k.keyId)).toEqual([1, 2, 3]);
  });

  it('continues numbering from the last keyId on subsequent batches', async () => {
    await generateOneTimePreKeys(UID, DID, 3);
    const second = await generateOneTimePreKeys(UID, DID, 2);
    expect(second.map((k) => k.keyId)).toEqual([4, 5]);
  });
});

describe('otpkPrivateCount', () => {
  it('returns 0 when no OPKs have been generated', async () => {
    expect(await otpkPrivateCount(UID, DID)).toBe(0);
  });

  it('returns the correct count after generation', async () => {
    await generateOneTimePreKeys(UID, DID, 4);
    expect(await otpkPrivateCount(UID, DID)).toBe(4);
  });

  it('decrements after consuming a key', async () => {
    const keys = await generateOneTimePreKeys(UID, DID, 3);
    await consumeOneTimePreKey(UID, DID, keys[0]!.keyId);
    expect(await otpkPrivateCount(UID, DID)).toBe(2);
  });
});

describe('consumeOneTimePreKey', () => {
  it('returns the private key bytes for a valid keyId', async () => {
    const [key] = await generateOneTimePreKeys(UID, DID, 1);
    const priv = await consumeOneTimePreKey(UID, DID, key!.keyId);
    expect(priv).not.toBeNull();
    expect(priv!).toHaveLength(32);
  });

  it('returns null for an unknown keyId', async () => {
    expect(await consumeOneTimePreKey(UID, DID, 9999)).toBeNull();
  });

  it('makes the key unavailable after consumption (one-time use)', async () => {
    const [key] = await generateOneTimePreKeys(UID, DID, 1);
    await consumeOneTimePreKey(UID, DID, key!.keyId);
    expect(await consumeOneTimePreKey(UID, DID, key!.keyId)).toBeNull();
  });

  it('removes the key from the count after consumption', async () => {
    const [key] = await generateOneTimePreKeys(UID, DID, 1);
    await consumeOneTimePreKey(UID, DID, key!.keyId);
    expect(await otpkPrivateCount(UID, DID)).toBe(0);
  });
});

describe('readOneTimePreKey', () => {
  it('returns the private key bytes WITHOUT removing it from storage', async () => {
    const [key] = await generateOneTimePreKeys(UID, DID, 1);
    const priv = await readOneTimePreKey(UID, DID, key!.keyId);
    expect(priv).not.toBeNull();
    expect(priv!).toHaveLength(32);
  });

  it('leaves the key available for a second read (non-destructive)', async () => {
    const [key] = await generateOneTimePreKeys(UID, DID, 1);
    await readOneTimePreKey(UID, DID, key!.keyId);
    const second = await readOneTimePreKey(UID, DID, key!.keyId);
    expect(second).not.toBeNull();
  });

  it('does not decrement the OPK count', async () => {
    const [key] = await generateOneTimePreKeys(UID, DID, 2);
    await readOneTimePreKey(UID, DID, key!.keyId);
    expect(await otpkPrivateCount(UID, DID)).toBe(2);
  });

  it('returns null for an unknown keyId', async () => {
    expect(await readOneTimePreKey(UID, DID, 9999)).toBeNull();
  });
});

describe('deleteConsumedOneTimePreKey', () => {
  it('removes the key so subsequent reads return null', async () => {
    const [key] = await generateOneTimePreKeys(UID, DID, 1);
    const priv = await readOneTimePreKey(UID, DID, key!.keyId);
    expect(priv).not.toBeNull();

    await deleteConsumedOneTimePreKey(UID, DID, key!.keyId);
    expect(await readOneTimePreKey(UID, DID, key!.keyId)).toBeNull();
  });

  it('decrements the OPK count', async () => {
    const [key] = await generateOneTimePreKeys(UID, DID, 2);
    await deleteConsumedOneTimePreKey(UID, DID, key!.keyId);
    expect(await otpkPrivateCount(UID, DID)).toBe(1);
  });
});

describe('purgeAllOneTimePreKeys', () => {
  it('removes all OPKs and resets count to zero', async () => {
    await generateOneTimePreKeys(UID, DID, 5);
    await purgeAllOneTimePreKeys(UID, DID);
    expect(await otpkPrivateCount(UID, DID)).toBe(0);
  });
});

// ── wipeIdentity ──────────────────────────────────────────────────────────────

describe('wipeIdentity', () => {
  it('makes getSignedPreKeyPrivate return null', async () => {
    await ensureSignedPreKey(UID, DID);
    await wipeIdentity(UID, DID);
    expect(await getSignedPreKeyPrivate(UID, DID)).toBeNull();
  });

  it('makes isSignedPreKeyStale return true (no key left)', async () => {
    await ensureSignedPreKey(UID, DID);
    await wipeIdentity(UID, DID);
    expect(await isSignedPreKeyStale(UID, DID)).toBe(true);
  });

  it('wipes the previous SPK so getPreviousSignedPreKeyPrivate returns null', async () => {
    await ensureSignedPreKey(UID, DID);
    await rotateSignedPreKey(UID, DID);
    await wipeIdentity(UID, DID);
    expect(await getPreviousSignedPreKeyPrivate(UID, DID)).toBeNull();
  });

  it('makes all OPKs unavailable after wipe', async () => {
    const keys = await generateOneTimePreKeys(UID, DID, 3);
    await wipeIdentity(UID, DID);
    for (const k of keys) {
      expect(await readOneTimePreKey(UID, DID, k.keyId)).toBeNull();
    }
  });

  it('resets OPK count to zero', async () => {
    await generateOneTimePreKeys(UID, DID, 3);
    await wipeIdentity(UID, DID);
    expect(await otpkPrivateCount(UID, DID)).toBe(0);
  });
});
