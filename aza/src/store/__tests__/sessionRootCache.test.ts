/**
 * Session-root cache — the in-memory layer in front of SecureStore.
 *
 * The send path no longer awaits the SecureStore write before publishing a
 * message, so the invariant that matters is: the ratchet a later send reads
 * back must be the one the previous send wrote, even though that write may
 * still be draining to disk. These tests pin that, plus the identity-rotation
 * guard and the fact that the send path stopped paying for Keychain round
 * trips at all.
 */

import 'react-native-get-random-values';

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => { store.set(k, v); }),
    deleteItemAsync: jest.fn(async (k: string) => { store.delete(k); }),
    __store: store,
    __reset: () => store.clear(),
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SecureStoreMock = require('expo-secure-store') as {
  getItemAsync: jest.Mock;
  setItemAsync: jest.Mock;
  __store: Map<string, string>;
  __reset: () => void;
};

import { bytesToBase64 } from '../../crypto/codec';
import {
  deleteSessionRoot,
  flushSessionRoots,
  loadSessionRoot,
  saveSessionRoot,
  wipeAllSessionRoots,
} from '../sessionRootCache';

const SELF = 'self-user';
const PEER = 'peer-user';
const OTHER_PEER = 'other-peer';

const bytes = (fill: number) => new Uint8Array(32).fill(fill);
const hex = (b: Uint8Array) => Array.from(b, (n) => n.toString(16).padStart(2, '0')).join('');

const IK = bytes(0xaa);
const ROTATED_IK = bytes(0xbb);

beforeEach(async () => {
  // wipeAllSessionRoots clears the module-level memory between tests; the
  // module keeps state across a file, exactly as it does in the app.
  await wipeAllSessionRoots(SELF);
  await wipeAllSessionRoots('unrelated');
  SecureStoreMock.__reset();
  SecureStoreMock.getItemAsync.mockClear();
  SecureStoreMock.setItemAsync.mockClear();
});

describe('read-back', () => {
  it('returns the root a save just recorded, before the disk write drains', async () => {
    const root = bytes(0x11);
    await saveSessionRoot(SELF, PEER, root, IK);

    // Deliberately not flushed — this is the state the very next send sees.
    const loaded = await loadSessionRoot(SELF, PEER, IK);
    expect(loaded).not.toBeNull();
    expect(hex(loaded!)).toBe(hex(bytes(0x11)));
  });

  it('keeps consecutive ratchet steps in order across un-drained writes', async () => {
    for (let step = 1; step <= 5; step++) {
      const previous = await loadSessionRoot(SELF, PEER, IK);
      if (step > 1) expect(hex(previous!)).toBe(hex(bytes(step - 1)));
      await saveSessionRoot(SELF, PEER, bytes(step), IK);
    }

    await flushSessionRoots();
    const finalRoot = await loadSessionRoot(SELF, PEER, IK);
    expect(hex(finalRoot!)).toBe(hex(bytes(5)));
  });

  it('hands back a copy, so a caller zeroing its buffer cannot poison the cache', async () => {
    await saveSessionRoot(SELF, PEER, bytes(0x22), IK);

    const first = await loadSessionRoot(SELF, PEER, IK);
    first!.fill(0);

    const second = await loadSessionRoot(SELF, PEER, IK);
    expect(hex(second!)).toBe(hex(bytes(0x22)));
  });

  it('encodes the root up front, so the caller may zero it right after saving', async () => {
    const root = bytes(0x33);
    await saveSessionRoot(SELF, PEER, root, IK);
    root.fill(0); // what encryptFollowupMessageV3's caller does

    const loaded = await loadSessionRoot(SELF, PEER, IK);
    expect(hex(loaded!)).toBe(hex(bytes(0x33)));
  });
});

describe('durability', () => {
  it('drains the write to SecureStore without being awaited by the caller', async () => {
    await saveSessionRoot(SELF, PEER, bytes(0x44), IK);
    await flushSessionRoots();

    expect(SecureStoreMock.setItemAsync).toHaveBeenCalled();
    const persisted = [...SecureStoreMock.__store.keys()].some((k) => k.includes(PEER));
    expect(persisted).toBe(true);
  });

  it('coalesces a burst of writes for one peer into fewer disk round trips', async () => {
    // A burst of sends, issued without yielding — which is what a rapid
    // back-and-forth looks like next to a Keychain write. The drain loop takes
    // the latest payload per key rather than writing every intermediate step.
    const saves = [];
    for (let i = 1; i <= 10; i++) saves.push(saveSessionRoot(SELF, PEER, bytes(i), IK));
    await Promise.all(saves);
    await flushSessionRoots();

    expect(SecureStoreMock.setItemAsync.mock.calls.length).toBeLessThan(10);
    const loaded = await loadSessionRoot(SELF, PEER, IK);
    expect(hex(loaded!)).toBe(hex(bytes(10)));
  });

  it('loads a root written by the pre-cache code, unchanged on disk', async () => {
    // The on-disk layout is a compatibility surface: existing installs hold
    // roots written before the in-memory layer existed, and they must still
    // decrypt. Seed the store the way the old implementation did.
    SecureStoreMock.__store.set(
      `aza_e2ee_session_${SELF}_legacy-peer`,
      JSON.stringify({
        rootKey: bytesToBase64(bytes(0x55)),
        peerIdentityPub: bytesToBase64(IK),
      }),
    );

    const loaded = await loadSessionRoot(SELF, 'legacy-peer', IK);
    expect(hex(loaded!)).toBe(hex(bytes(0x55)));
  });

  it('writes a layout the pre-cache reader can still parse', async () => {
    await saveSessionRoot(SELF, PEER, bytes(0x88), IK);
    await flushSessionRoots();

    const raw = SecureStoreMock.__store.get(`aza_e2ee_session_${SELF}_${PEER}`);
    expect(raw).toBeDefined();
    expect(JSON.parse(raw!)).toEqual({
      rootKey: bytesToBase64(bytes(0x88)),
      peerIdentityPub: bytesToBase64(IK),
    });
  });
});

describe('cache avoidance', () => {
  it('reads SecureStore once per key, not once per send', async () => {
    await loadSessionRoot(SELF, PEER, IK); // cold miss
    const afterFirst = SecureStoreMock.getItemAsync.mock.calls.length;
    expect(afterFirst).toBeGreaterThan(0);

    await loadSessionRoot(SELF, PEER, IK);
    await loadSessionRoot(SELF, PEER, IK);
    await loadSessionRoot(SELF, PEER, IK);

    // The negative result is cached too — a peer with no session yet must not
    // re-hit the Keychain on every message.
    expect(SecureStoreMock.getItemAsync.mock.calls.length).toBe(afterFirst);
  });

  it('collapses concurrent cold reads onto a single SecureStore call', async () => {
    await Promise.all([
      loadSessionRoot(SELF, OTHER_PEER, IK),
      loadSessionRoot(SELF, OTHER_PEER, IK),
      loadSessionRoot(SELF, OTHER_PEER, IK),
    ]);

    const reads = SecureStoreMock.getItemAsync.mock.calls
      .filter(([k]: [string]) => k.includes(OTHER_PEER));
    expect(reads.length).toBe(1);
  });
});

describe('identity rotation', () => {
  it('refuses a root stored against a different peer identity key', async () => {
    await saveSessionRoot(SELF, PEER, bytes(0x66), IK);

    expect(await loadSessionRoot(SELF, PEER, ROTATED_IK)).toBeNull();
    expect(hex((await loadSessionRoot(SELF, PEER, IK))!)).toBe(hex(bytes(0x66)));
  });

  it('drops the root on delete, and does not resurrect it from a queued write', async () => {
    await saveSessionRoot(SELF, PEER, bytes(0x77), IK);
    await deleteSessionRoot(SELF, PEER);
    await flushSessionRoots();

    expect(await loadSessionRoot(SELF, PEER, IK)).toBeNull();
    expect([...SecureStoreMock.__store.keys()].some((k) => k.includes(PEER))).toBe(false);
  });
});
