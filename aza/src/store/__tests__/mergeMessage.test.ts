/**
 * mergeMessage — chat-thread reconciliation tests.
 *
 * Covers the three dedup paths:
 *   1. serverId match (history fetch overlays optimistic entry that got an ack).
 *   2. clientId match (echo carries the sender-side correlation id).
 *   3. Time-window heuristic for the WS echo arriving before the REST response
 *      has stamped a serverId on the optimistic entry.
 *
 * Plus the "preserve local plaintext on undecryptable echo" rule that keeps
 * the sender's own messages readable on reload.
 */

// chatStore.ts transitively imports AsyncStorage + SecureStore through the
// encrypted cache + peer-identity cache layers. Stub them out so the test
// can load mergeMessage without dragging in native modules.
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
  };
});
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => {}),
    removeItem: jest.fn(async () => {}),
    multiSet: jest.fn(async () => {}),
    multiRemove: jest.fn(async () => {}),
    getAllKeys: jest.fn(async () => [] as string[]),
  },
}));

import { mergeMessage } from '../chatStore';
import type { LocalMessage } from '../chatTypes';

function msg(overrides: Partial<LocalMessage>): LocalMessage {
  return {
    clientId: 'c_default',
    chatId: 'chat',
    senderId: 'me',
    isSelf: true,
    type: 'TEXT',
    text: 'hello',
    timestamp: 1_000,
    status: 'pending',
    decryptOk: true,
    ...overrides,
  };
}

describe('mergeMessage', () => {
  it('keeps timestamp order for new inserts (binary insertion)', () => {
    let thread: LocalMessage[] = [];
    thread = mergeMessage(thread, msg({ clientId: 'c_b', timestamp: 2_000 }));
    thread = mergeMessage(thread, msg({ clientId: 'c_a', timestamp: 1_000 }));
    thread = mergeMessage(thread, msg({ clientId: 'c_c', timestamp: 3_000 }));
    expect(thread.map((m) => m.clientId)).toEqual(['c_a', 'c_b', 'c_c']);
  });

  it('dedupes by serverId', () => {
    let thread = [msg({ clientId: 'c_1', serverId: 's_1', timestamp: 1_000, status: 'sent' })];
    thread = mergeMessage(
      thread,
      msg({ clientId: 'different', serverId: 's_1', timestamp: 1_500, status: 'delivered' }),
    );
    expect(thread).toHaveLength(1);
    expect(thread[0]!.status).toBe('delivered');
    expect(thread[0]!.serverId).toBe('s_1');
  });

  it('dedupes by clientId when serverId is absent on the existing entry', () => {
    // Echoed clientId from the server lets us merge before the REST ack lands.
    let thread = [msg({ clientId: 'c_xyz', timestamp: 1_000, status: 'pending' })];
    thread = mergeMessage(
      thread,
      msg({ clientId: 'c_xyz', serverId: 's_new', timestamp: 1_400, status: 'sent', decryptOk: false, text: '' }),
    );
    expect(thread).toHaveLength(1);
    expect(thread[0]!.serverId).toBe('s_new');
    // Local plaintext is preserved across the undecryptable echo merge.
    expect(thread[0]!.text).toBe('hello');
    expect(thread[0]!.decryptOk).toBe(true);
  });

  it('attributes WS echo to optimistic entry via the time-window heuristic', () => {
    // Optimistic entry has no serverId yet, echo carries no matching clientId
    // either (older client w/out clientId echo). Time window should still match.
    let thread = [msg({ clientId: 'c_opt', timestamp: 1_000, status: 'pending' })];
    thread = mergeMessage(
      thread,
      msg({
        clientId: 's_serverId',
        serverId: 's_serverId',
        timestamp: 1_200,
        status: 'sent',
        decryptOk: false,
        text: '',
      }),
    );
    expect(thread).toHaveLength(1);
    expect(thread[0]!.serverId).toBe('s_serverId');
    expect(thread[0]!.text).toBe('hello');
  });

  it('does NOT collapse two distinct outgoing messages with similar timestamps', () => {
    // Both optimistic entries already have serverIds — the echo for one
    // shouldn't merge into the other just because they're nearby in time.
    let thread = [
      msg({ clientId: 'c_a', serverId: 's_a', timestamp: 1_000, text: 'first' }),
      msg({ clientId: 'c_b', serverId: 's_b', timestamp: 1_100, text: 'second' }),
    ];
    thread = mergeMessage(
      thread,
      msg({
        clientId: 's_b',
        serverId: 's_b',
        timestamp: 1_200,
        status: 'delivered',
        decryptOk: false,
        text: '',
      }),
    );
    expect(thread).toHaveLength(2);
    expect(thread.find((m) => m.serverId === 's_a')!.text).toBe('first');
    expect(thread.find((m) => m.serverId === 's_b')!.text).toBe('second');
    expect(thread.find((m) => m.serverId === 's_b')!.status).toBe('delivered');
  });

  it('treats incoming peer messages as new inserts (no echo match)', () => {
    let thread = [msg({ clientId: 'c_my', timestamp: 1_000 })];
    thread = mergeMessage(
      thread,
      msg({
        clientId: 's_peer',
        serverId: 's_peer',
        isSelf: false,
        senderId: 'peer',
        text: 'hi back',
        timestamp: 1_100,
        decryptOk: true,
      }),
    );
    expect(thread).toHaveLength(2);
    expect(thread.find((m) => m.serverId === 's_peer')!.text).toBe('hi back');
  });

  it('overwrites status fields when an echo is decryptable (e.g. our own with cached plaintext)', () => {
    let thread = [msg({ clientId: 'c_1', serverId: 's_1', timestamp: 1_000, status: 'sent', text: 'hi' })];
    thread = mergeMessage(
      thread,
      msg({ clientId: 'c_1', serverId: 's_1', timestamp: 1_000, status: 'read', text: 'hi', decryptOk: true }),
    );
    expect(thread).toHaveLength(1);
    expect(thread[0]!.status).toBe('read');
  });
});
