/**
 * Send-path latency — what happens between hitting send and the frame leaving
 * the device.
 *
 * The delivery path used to await three HTTP round trips one after another
 * (recipient device bundles, own device bundles, peer key material) plus two
 * SecureStore round trips, all before the STOMP publish. These tests pin the
 * properties that fixed it: the fetches overlap, they share one request, and a
 * warm chat publishes without touching the network first.
 */

import 'react-native-get-random-values';

// ── Native module stubs ───────────────────────────────────────────────────────

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => { store.set(k, v); }),
    deleteItemAsync: jest.fn(async (k: string) => { store.delete(k); }),
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

// ── API mock ──────────────────────────────────────────────────────────────────
// The two key-bundle endpoints record when they start and finish so the tests
// can tell a concurrent fan-out from a serial one.

type Trace = { started: number[]; finished: number[] };
const recipientTrace: Trace = { started: [], finished: [] };
const ownTrace: Trace = { started: [], finished: [] };
let tick = 0;

const mockFetchUserKeyBundles = jest.fn(async () => {
  recipientTrace.started.push(tick++);
  await Promise.resolve();
  await Promise.resolve();
  recipientTrace.finished.push(tick++);
  return {
    data: {
      data: [{
        deviceId: 'peer-device-1',
        identityPublicKey: PEER_IK_B64,
        // The backend DTO spells it `signedPreKyPublic`; chatStore accepts
        // either spelling. Without it the X3DH first message has no key to
        // derive against. No signature, so the store marks the SPK untrusted
        // rather than running an Ed25519 verify over a fixture.
        signedPreKyPublic: PEER_SPK_B64,
      }],
    },
  };
});

const mockFetchOwnKeyBundles = jest.fn(async () => {
  ownTrace.started.push(tick++);
  await Promise.resolve();
  await Promise.resolve();
  ownTrace.finished.push(tick++);
  return { data: { data: [{ deviceId: 'device-test', identityPublicKey: SELF_IK_B64 }] } };
});

const mockMarkChatDelivered = jest.fn().mockResolvedValue({});
const mockSendChatMessage = jest.fn().mockResolvedValue({
  data: { data: { id: 'srv-1', sentAt: new Date().toISOString() } },
});

jest.mock('../../services/api', () => ({
  sendChatMessage: (...args: any[]) => mockSendChatMessage(...args),
  sendChatTypingIndicator: jest.fn().mockResolvedValue({}),
  listChats: jest.fn().mockResolvedValue({ data: { data: [] } }),
  getOrCreateChat: jest.fn().mockResolvedValue({ data: { data: { id: 'chat-1', otherUserId: 'peer-uuid' } } }),
  getChatMessages: jest.fn().mockResolvedValue({ data: { data: { content: [], totalPages: 0 } } }),
  markChatRead: jest.fn().mockResolvedValue({}),
  markChatDelivered: (...args: any[]) => mockMarkChatDelivered(...args),
  fetchUserKeyBundles: (...args: any[]) => mockFetchUserKeyBundles(...(args as [])),
  fetchOwnKeyBundles: (...args: any[]) => mockFetchOwnKeyBundles(...(args as [])),
  getDeviceId: jest.fn().mockResolvedValue('device-test'),
  deleteChatMessage: jest.fn().mockResolvedValue({}),
  setDisappearingMessages: jest.fn().mockResolvedValue({}),
  muteChat: jest.fn().mockResolvedValue({}),
  archiveChat: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../store/encryptedMessageStore', () => ({
  loadCachedThread: jest.fn().mockResolvedValue([]),
  saveCachedThread: jest.fn().mockResolvedValue(undefined),
  clearCachedThread: jest.fn().mockResolvedValue(undefined),
  wipeAllChatCaches: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../store/peerIdentityCache', () => ({
  recordPeerIdentity: jest.fn().mockResolvedValue({ kind: 'unchanged' }),
  wipePeerIdentityCache: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../store/sessionCache', () => ({
  hasSessionWithPeer: jest.fn().mockResolvedValue(true),
  markSessionEstablished: jest.fn().mockResolvedValue(undefined),
  wipeSessionFlags: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../crypto/keystore', () => ({
  getSignedPreKeyPrivate: jest.fn().mockResolvedValue(null),
  getPreviousSignedPreKeyPrivate: jest.fn().mockResolvedValue(null),
  consumeOneTimePreKey: jest.fn().mockResolvedValue(null),
  readOneTimePreKey: jest.fn().mockResolvedValue(null),
  deleteConsumedOneTimePreKey: jest.fn().mockResolvedValue(undefined),
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import { useChatStore } from '../chatStore';
import { generateX25519 } from '../../crypto/e2ee';
import { bytesToBase64 } from '../../crypto/codec';
import { flushSessionRoots } from '../sessionRootCache';

const CHAT_ID = 'chat-1';
const SELF_ID = 'self-uuid';
const PEER_ID = 'peer-uuid';

const peerPair = generateX25519();
const peerSpk = generateX25519();
const selfPair = generateX25519();
const PEER_IK_B64 = bytesToBase64(peerPair.publicKey);
const PEER_SPK_B64 = bytesToBase64(peerSpk.publicKey);
const SELF_IK_B64 = bytesToBase64(selfPair.publicKey);

/** Let every pending microtask (and the store's detached async work) settle. */
const settle = async () => {
  for (let i = 0; i < 25; i++) await Promise.resolve();
};

function fakeStompClient() {
  return { connected: true, publish: jest.fn() };
}

function seedStore() {
  useChatStore.setState({
    selfUserId: SELF_ID,
    selfDeviceId: 'device-test',
    selfIdentityPublic: selfPair.publicKey,
    selfIdentityPrivate: selfPair.privateKey,
    chats: {
      [CHAT_ID]: {
        id: CHAT_ID,
        otherUserId: PEER_ID,
        otherUserName: 'Bob',
        unreadCount: 0,
        isMuted: false,
        isArchived: false,
      },
    },
    messagesByChat: { [CHAT_ID]: [] },
    peerKeys: {},
    typingByChat: {},
    chatOrder: [CHAT_ID],
  });
}

beforeEach(async () => {
  jest.useFakeTimers();
  // resetForLogout clears the module-level bundle caches between tests, which
  // is what makes each test a genuine cold start.
  await useChatStore.getState().resetForLogout();
  jest.clearAllMocks();
  recipientTrace.started.length = 0;
  recipientTrace.finished.length = 0;
  ownTrace.started.length = 0;
  ownTrace.finished.length = 0;
  tick = 0;
  seedStore();
});

afterEach(async () => {
  jest.clearAllTimers();
  jest.useRealTimers();
  await flushSessionRoots();
});

describe('sendText — pre-publish work', () => {
  it('shows the message immediately, without waiting on encryption or network', () => {
    const client = fakeStompClient();
    useChatStore.getState().setStompClient(client as any);
    void useChatStore.getState().sendText(CHAT_ID, 'hello');

    // Synchronous: the bubble is on screen before the action yields once.
    const thread = useChatStore.getState().messagesByChat[CHAT_ID] ?? [];
    expect(thread).toHaveLength(1);
    expect(thread[0]!.text).toBe('hello');
    expect(thread[0]!.status).toBe('pending');
    // Nothing has been encrypted or published yet — the key fetches have only
    // just been kicked off.
    expect(client.publish).not.toHaveBeenCalled();
  });

  it('fetches recipient and own key bundles concurrently, not one after the other', async () => {
    useChatStore.getState().setStompClient(fakeStompClient() as any);
    await useChatStore.getState().sendText(CHAT_ID, 'hello');

    expect(recipientTrace.started).toHaveLength(1);
    expect(ownTrace).toHaveProperty('started', expect.arrayContaining([expect.any(Number)]));

    // Concurrency: both requests were in flight at the same time, i.e. each
    // one started before the other had finished.
    const recipientStart = recipientTrace.started[0]!;
    const recipientEnd = recipientTrace.finished[0]!;
    const ownStart = ownTrace.started[0]!;
    const ownEnd = ownTrace.finished[0]!;
    expect(ownStart).toBeLessThan(recipientEnd);
    expect(recipientStart).toBeLessThan(ownEnd);
  });

  it('shares one /key-bundles request between the fan-out and the X3DH session', async () => {
    useChatStore.getState().setStompClient(fakeStompClient() as any);
    await useChatStore.getState().sendText(CHAT_ID, 'hello');

    // Both the per-device fan-out and ensurePeerKeys need this endpoint, and it
    // pops a one-time prekey per call — so it must be hit once, not twice.
    expect(mockFetchUserKeyBundles).toHaveBeenCalledTimes(1);
    expect(useChatStore.getState().peerKeys[PEER_ID]).toBeDefined();
  });

  it('publishes a warm chat over the socket with no network round trip first', async () => {
    const client = fakeStompClient();
    useChatStore.getState().setStompClient(client as any);

    await useChatStore.getState().sendText(CHAT_ID, 'first');
    jest.clearAllMocks();

    await useChatStore.getState().sendText(CHAT_ID, 'second');

    expect(mockFetchUserKeyBundles).not.toHaveBeenCalled();
    expect(mockFetchOwnKeyBundles).not.toHaveBeenCalled();
    expect(client.publish).toHaveBeenCalledTimes(1);
    expect(client.publish.mock.calls[0]![0].destination).toBe('/app/chat.send');
  });

  it('encrypts one envelope per recipient device and publishes it', async () => {
    const client = fakeStompClient();
    useChatStore.getState().setStompClient(client as any);

    await useChatStore.getState().sendText(CHAT_ID, 'hello');

    const body = JSON.parse(client.publish.mock.calls[0]![0].body);
    expect(body.chatId).toBe(CHAT_ID);
    expect(body.type).toBe('TEXT');
    expect(body.clientId).toEqual(expect.any(String));
    expect(Object.keys(body.deviceCiphertexts)).toContain('peer-device-1');
  });

  it('falls back to REST when the socket is down', async () => {
    useChatStore.getState().setStompClient(null);

    await useChatStore.getState().sendText(CHAT_ID, 'hello');

    expect(mockSendChatMessage).toHaveBeenCalledTimes(1);
    const thread = useChatStore.getState().messagesByChat[CHAT_ID] ?? [];
    expect(thread[0]!.status).toBe('sent');
  });

  it('prewarmSend leaves nothing for the first send to fetch', async () => {
    useChatStore.getState().setStompClient(fakeStompClient() as any);

    useChatStore.getState().prewarmSend(PEER_ID);
    await settle();
    jest.clearAllMocks();

    await useChatStore.getState().sendText(CHAT_ID, 'hello');
    expect(mockFetchUserKeyBundles).not.toHaveBeenCalled();
    expect(mockFetchOwnKeyBundles).not.toHaveBeenCalled();
  });
});

describe('retrying a failed send', () => {
  /** Drive a send to 'failed' the way a dropped socket does. */
  async function sendAndFail(text: string) {
    useChatStore.getState().setStompClient(null);
    mockSendChatMessage.mockRejectedValueOnce(new Error('offline'));
    await useChatStore.getState().sendText(CHAT_ID, text);

    const thread = useChatStore.getState().messagesByChat[CHAT_ID] ?? [];
    expect(thread).toHaveLength(1);
    expect(thread[0]!.status).toBe('failed');
    return thread[0]!;
  }

  it('replaces the failed bubble instead of adding a second one', async () => {
    const failed = await sendAndFail('hello');

    const client = fakeStompClient();
    useChatStore.getState().setStompClient(client as any);
    await useChatStore.getState().retryFailedSends();

    const thread = useChatStore.getState().messagesByChat[CHAT_ID] ?? [];
    expect(thread).toHaveLength(1);
    expect(thread[0]!.clientId).toBe(failed.clientId);
    expect(thread[0]!.status).toBe('pending');
    expect(thread[0]!.timestamp).toBe(failed.timestamp);
    expect(client.publish).toHaveBeenCalledTimes(1);
  });

  it('does not multiply copies across repeated reconnects', async () => {
    await sendAndFail('hello');

    // Still offline: each reconnect attempt retries and fails again.
    for (let i = 0; i < 3; i++) {
      mockSendChatMessage.mockRejectedValueOnce(new Error('offline'));
      await useChatStore.getState().retryFailedSends();
    }

    const thread = useChatStore.getState().messagesByChat[CHAT_ID] ?? [];
    expect(thread).toHaveLength(1);
    expect(thread[0]!.status).toBe('failed');
  });
});

describe('delivery receipts', () => {
  const incoming = (id: string) => ({
    type: 'chat.message',
    payload: {
      id,
      chatId: CHAT_ID,
      senderId: PEER_ID,
      // Plaintext (support-chat shape) so the handler skips decryption.
      content: `message ${id}`,
      sentAt: new Date().toISOString(),
    },
  });

  it('sends one receipt for a burst instead of one per message', async () => {
    const handle = useChatStore.getState().handleSocketEvent;
    for (let i = 0; i < 6; i++) handle(incoming(`srv-${i}`));
    await settle();

    // All six landed...
    expect(useChatStore.getState().messagesByChat[CHAT_ID]).toHaveLength(6);
    // ...on a single delivery receipt.
    expect(mockMarkChatDelivered).toHaveBeenCalledTimes(1);
  });

  it('still reports the stragglers that arrived inside the window', async () => {
    const handle = useChatStore.getState().handleSocketEvent;
    handle(incoming('srv-a'));
    await settle();
    expect(mockMarkChatDelivered).toHaveBeenCalledTimes(1);

    // A second message inside the debounce window must not be silently
    // swallowed — it gets covered by a trailing receipt.
    handle(incoming('srv-b'));
    await settle();
    expect(mockMarkChatDelivered).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(700);
    await settle();
    expect(mockMarkChatDelivered).toHaveBeenCalledTimes(2);
  });

  it('does not acknowledge our own echo', async () => {
    useChatStore.getState().handleSocketEvent({
      type: 'chat.message',
      payload: {
        id: 'srv-self',
        chatId: CHAT_ID,
        senderId: SELF_ID,
        content: 'mine',
        sentAt: new Date().toISOString(),
      },
    });
    await settle();

    expect(mockMarkChatDelivered).not.toHaveBeenCalled();
  });
});
