/**
 * sendMedia — chatStore action tests.
 *
 * Verifies that sending media:
 *   1. Inserts an optimistic message with the correct type and mediaKey immediately.
 *   2. Calls sendChatMessage with type IMAGE/VIDEO/DOCUMENT and the mediaKey.
 *   3. Transitions the message to 'sent' on a successful API response.
 *   4. Transitions the message to 'failed' when the API throws.
 *   5. Returns early (no-op) when the chat doesn't exist in the store.
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

const mockSendChatMessage = jest.fn();

jest.mock('../../services/api', () => ({
  sendChatMessage: (...args: any[]) => mockSendChatMessage(...args),
  sendChatTypingIndicator: jest.fn().mockResolvedValue({}),
  listChats: jest.fn().mockResolvedValue({ data: { data: [] } }),
  getOrCreateChat: jest.fn().mockResolvedValue({ data: { data: { id: 'chat-1', otherUserId: 'peer-1' } } }),
  getChatMessages: jest.fn().mockResolvedValue({ data: { data: { content: [], totalPages: 0 } } }),
  markChatRead: jest.fn().mockResolvedValue({}),
  markChatDelivered: jest.fn().mockResolvedValue({}),
  fetchUserKeyBundle: jest.fn().mockResolvedValue({ data: { data: {} } }),
  deleteChatMessage: jest.fn().mockResolvedValue({}),
  setDisappearingMessages: jest.fn().mockResolvedValue({}),
  muteChat: jest.fn().mockResolvedValue({}),
  archiveChat: jest.fn().mockResolvedValue({}),
}));

// ── Session-root & encrypted-cache stubs ─────────────────────────────────────

jest.mock('../../store/sessionRootCache', () => ({
  loadSessionRoot: jest.fn().mockResolvedValue(null), // forces X3DH each test
  saveSessionRoot: jest.fn().mockResolvedValue(undefined),
  indexSessionRoot: jest.fn().mockResolvedValue(undefined),
  deleteSessionRoot: jest.fn().mockResolvedValue(undefined),
  wipeAllSessionRoots: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../store/encryptedMessageStore', () => ({
  loadCachedThread: jest.fn().mockResolvedValue([]),
  saveCachedThread: jest.fn().mockResolvedValue(undefined),
  clearCachedThread: jest.fn().mockResolvedValue(undefined),
  wipeAllChatCaches: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../store/peerIdentityCache', () => ({
  recordPeerIdentity: jest.fn().mockResolvedValue('first-seen'),
  wipePeerIdentityCache: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../store/sessionCache', () => ({
  hasSessionWithPeer: jest.fn().mockResolvedValue(false),
  markSessionEstablished: jest.fn().mockResolvedValue(undefined),
  wipeSessionFlags: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../crypto/keystore', () => ({
  getSignedPreKeyPrivate: jest.fn().mockResolvedValue(null),
  consumeOneTimePreKey: jest.fn().mockResolvedValue(null),
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import { useChatStore } from '../chatStore';
import { generateX25519 } from '../../crypto/e2ee';

// ── Helpers ───────────────────────────────────────────────────────────────────

const CHAT_ID  = 'chat-1';
const SELF_ID  = 'self-uuid';
const PEER_ID  = 'peer-uuid';

function buildPeerKeys() {
  const pair = generateX25519();
  const spk  = generateX25519();
  return {
    identityPublicKey: pair.publicKey,
    signedPreKeyPublic: spk.publicKey,
    signedPreKeySignature: new Uint8Array(64),
    spkSignatureValid: true,
    identityChange: 'first-seen' as const,
  };
}

function seedStore() {
  const selfPair = generateX25519();
  const peerKeys = buildPeerKeys();

  useChatStore.setState({
    selfUserId: SELF_ID,
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
    peerKeys: { [PEER_ID]: peerKeys },
    chatOrder: [CHAT_ID],
  });
}

// ─────────────────────────────────────────────────────────────────────────────

describe('chatStore.sendMedia', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    seedStore();
  });

  it('inserts an optimistic media message immediately', async () => {
    mockSendChatMessage.mockResolvedValue({
      data: { data: { id: 'srv-1', sentAt: new Date().toISOString() } },
    });

    const sendMedia = useChatStore.getState().sendMedia;
    const promise = sendMedia(CHAT_ID, 'https://cdn.example.com/photo.jpg', 'IMAGE', '');

    // Optimistic insert should be synchronous within the action
    const thread = useChatStore.getState().messagesByChat[CHAT_ID] ?? [];
    const optimistic = thread.find(m => m.mediaKey === 'https://cdn.example.com/photo.jpg');
    expect(optimistic).toBeDefined();
    expect(optimistic?.type).toBe('IMAGE');
    expect(optimistic?.status).toBe('pending');

    await promise;
  });

  it('calls sendChatMessage with type IMAGE and the mediaKey', async () => {
    mockSendChatMessage.mockResolvedValue({
      data: { data: { id: 'srv-1', sentAt: new Date().toISOString() } },
    });

    await useChatStore.getState().sendMedia(
      CHAT_ID,
      'https://cdn.example.com/photo.jpg',
      'IMAGE',
      '',
    );

    expect(mockSendChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: CHAT_ID,
        type: 'IMAGE',
        mediaKey: 'https://cdn.example.com/photo.jpg',
      }),
    );
  });

  it('calls sendChatMessage with type VIDEO for video media', async () => {
    mockSendChatMessage.mockResolvedValue({
      data: { data: { id: 'srv-2', sentAt: new Date().toISOString() } },
    });

    await useChatStore.getState().sendMedia(
      CHAT_ID,
      'https://cdn.example.com/clip.mp4',
      'VIDEO',
    );

    expect(mockSendChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'VIDEO' }),
    );
  });

  it('transitions message to "sent" on successful API response', async () => {
    mockSendChatMessage.mockResolvedValue({
      data: { data: { id: 'srv-1', sentAt: new Date().toISOString() } },
    });

    await useChatStore.getState().sendMedia(
      CHAT_ID,
      'https://cdn.example.com/photo.jpg',
      'IMAGE',
    );

    const thread = useChatStore.getState().messagesByChat[CHAT_ID] ?? [];
    const sent = thread.find(m => m.mediaKey === 'https://cdn.example.com/photo.jpg');
    expect(sent?.status).toBe('sent');
  });

  it('transitions message to "failed" when API throws', async () => {
    mockSendChatMessage.mockRejectedValue(new Error('network error'));

    await useChatStore.getState().sendMedia(
      CHAT_ID,
      'https://cdn.example.com/photo.jpg',
      'IMAGE',
    );

    const thread = useChatStore.getState().messagesByChat[CHAT_ID] ?? [];
    const failed = thread.find(m => m.mediaKey === 'https://cdn.example.com/photo.jpg');
    expect(failed?.status).toBe('failed');
  });

  it('is a no-op when chatId is not in the store', async () => {
    await useChatStore.getState().sendMedia(
      'nonexistent-chat',
      'https://cdn.example.com/photo.jpg',
      'IMAGE',
    );

    expect(mockSendChatMessage).not.toHaveBeenCalled();
  });

  it('includes encrypted ciphertext and ephemeralKey in the payload', async () => {
    mockSendChatMessage.mockResolvedValue({
      data: { data: { id: 'srv-1', sentAt: new Date().toISOString() } },
    });

    await useChatStore.getState().sendMedia(
      CHAT_ID,
      'https://cdn.example.com/photo.jpg',
      'IMAGE',
      'Nice photo',
    );

    expect(mockSendChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        ciphertext: expect.any(String),
        ephemeralKey: expect.any(String),
      }),
    );
  });
});
