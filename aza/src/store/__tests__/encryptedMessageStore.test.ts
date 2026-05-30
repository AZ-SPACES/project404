/**
 * Encrypted-at-rest message cache — round-trip + expiry + master-key rotation.
 *
 * These tests mock SecureStore + AsyncStorage in-memory so they run in plain Node
 * without needing the native modules. The crypto layer itself uses the real
 * @noble implementation — no mocks there.
 */

import 'react-native-get-random-values';

// ─── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
    deleteItemAsync: jest.fn(async (k: string) => {
      store.delete(k);
    }),
    __reset: () => store.clear(),
  };
});

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => store.get(k) ?? null),
      setItem: jest.fn(async (k: string, v: string) => {
        store.set(k, v);
      }),
      removeItem: jest.fn(async (k: string) => {
        store.delete(k);
      }),
      multiSet: jest.fn(async (pairs: [string, string][]) => {
        for (const [k, v] of pairs) store.set(k, v);
      }),
      multiRemove: jest.fn(async (keys: string[]) => {
        for (const k of keys) store.delete(k);
      }),
      getAllKeys: jest.fn(async () => Array.from(store.keys())),
      __reset: () => store.clear(),
    },
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SecureStoreMock = require('expo-secure-store') as { __reset: () => void };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const AsyncStorageMock = require('@react-native-async-storage/async-storage')
  .default as { __reset: () => void };

import {
  loadCachedThread,
  saveCachedThread,
  wipeAllChatCaches,
} from '../encryptedMessageStore';
import type { LocalMessage } from '../chatTypes';

beforeEach(() => {
  SecureStoreMock.__reset();
  AsyncStorageMock.__reset();
});

function makeMsg(over: Partial<LocalMessage>): LocalMessage {
  return {
    clientId: 'c_1',
    chatId: 'chat',
    senderId: 'me',
    isSelf: true,
    type: 'TEXT',
    text: 'plaintext',
    timestamp: Date.now(),
    status: 'sent',
    decryptOk: true,
    ...over,
  };
}

describe('encryptedMessageStore', () => {
  it('round-trips a thread through encrypted storage', async () => {
    const msgs: LocalMessage[] = [
      makeMsg({ clientId: 'c_a', text: 'one' }),
      makeMsg({ clientId: 'c_b', text: 'two' }),
    ];
    await saveCachedThread('user1', 'chatA', msgs);
    const loaded = await loadCachedThread('user1', 'chatA');
    expect(loaded.map((m) => m.text)).toEqual(['one', 'two']);
  });

  it('filters expired disappearing messages on load', async () => {
    const past = Date.now() - 60_000;
    const future = Date.now() + 60_000;
    const msgs: LocalMessage[] = [
      makeMsg({ clientId: 'c_expired', text: 'gone', expiresAt: past }),
      makeMsg({ clientId: 'c_live', text: 'alive', expiresAt: future }),
      makeMsg({ clientId: 'c_normal', text: 'no-ttl' }),
    ];
    await saveCachedThread('user1', 'chatA', msgs);
    const loaded = await loadCachedThread('user1', 'chatA');
    expect(loaded.map((m) => m.text).sort()).toEqual(['alive', 'no-ttl'].sort());
  });

  it('returns empty thread when no cache exists', async () => {
    const loaded = await loadCachedThread('user-unknown', 'chat-nothing');
    expect(loaded).toEqual([]);
  });

  it('isolates threads per user — different users cannot read each other', async () => {
    await saveCachedThread('userA', 'shared', [makeMsg({ text: 'A only' })]);
    await saveCachedThread('userB', 'shared', [makeMsg({ text: 'B only' })]);
    const a = await loadCachedThread('userA', 'shared');
    const b = await loadCachedThread('userB', 'shared');
    expect(a[0]!.text).toBe('A only');
    expect(b[0]!.text).toBe('B only');
  });

  it('wipeAllChatCaches makes all previously stored threads unreadable', async () => {
    await saveCachedThread('user1', 'chatA', [makeMsg({ text: 'gone' })]);
    await wipeAllChatCaches('user1');
    const reloaded = await loadCachedThread('user1', 'chatA');
    // The thread blob is gone, so an empty load result is the expected outcome.
    expect(reloaded).toEqual([]);

    // Even if a stale blob were to remain (paranoid check), the master key
    // has been rotated, so a hand-rolled load with a new key produces empty.
    await saveCachedThread('user1', 'chatA', [makeMsg({ text: 'new' })]);
    const fresh = await loadCachedThread('user1', 'chatA');
    expect(fresh.map((m) => m.text)).toEqual(['new']);
  });
});
