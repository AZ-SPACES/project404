/**
 * Chat store — the integration layer between the encrypted transport and the UI.
 *
 * Responsibilities:
 *   - Maintain in-memory state for chats, threads, typing, and peer key cache.
 *   - Encrypt outgoing messages with the user's identity key and the peer's
 *     identity public key (fetched lazily from the key bundle endpoint).
 *   - Decrypt incoming WebSocket messages and merge them into the relevant thread.
 *   - Persist decrypted threads to the encrypted-at-rest cache.
 *
 * The store does NOT own the STOMP client — ChatSocketProvider hands one in
 * via setStompClient. That lets the provider control lifecycle while the store
 * stays a plain Zustand singleton that screens can read from synchronously.
 */

import { create } from 'zustand';
import type { Client as StompClient } from '@stomp/stompjs';

import {
  archiveChat as apiArchiveChat,
  deleteChatMessage,
  fetchUserKeyBundle,
  getChatMessages,
  getOrCreateChat,
  listChats,
  markChatDelivered,
  markChatRead,
  muteChat as apiMuteChat,
  sendChatMessage,
  sendChatTypingIndicator,
  setDisappearingMessages,
  type SendMessagePayload,
} from '../services/api';
import {
  base64ToBytes,
  bytesToBase64,
} from '../crypto/codec';
import {
  decryptFromSender,
  encryptForRecipient,
  verifyEd25519,
} from '../crypto/e2ee';
import type { LocalMessage, LocalMessageStatus } from './chatTypes';
import {
  loadCachedThread,
  saveCachedThread,
  clearCachedThread,
  wipeAllChatCaches,
} from './encryptedMessageStore';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ChatSummary = {
  id: string;
  otherUserId: string;
  otherUserName: string;
  otherUserHandle?: string;
  otherUserAvatar?: string;
  otherUserStatus?: string;
  lastMessageAt?: string | null;
  unreadCount: number;
  isMuted: boolean;
  isArchived: boolean;
  /** Server-stored TTL (seconds). 0/null = off. Set via setDisappearing. */
  disappearingTtlSeconds?: number | null;
};

type PeerKeys = {
  identityPublicKey: Uint8Array;
  signedPreKeyPublic: Uint8Array;
  signedPreKeySignature: Uint8Array;
  oneTimePreKeyId?: string;
  oneTimePreKeyPublic?: Uint8Array;
  /** Once verified, the value sticks for the session. Used as TOFU. */
  verifiedOnce: boolean;
};

type ChatStoreState = {
  selfUserId: string | null;
  selfIdentityPrivate: Uint8Array | null;
  selfIdentityPublic: Uint8Array | null;

  stompClient: StompClient | null;
  chats: Record<string, ChatSummary>;
  chatOrder: string[];
  messagesByChat: Record<string, LocalMessage[]>;
  typingByChat: Record<string, boolean>;
  peerKeys: Record<string, PeerKeys>; // keyed by otherUserId

  // Lifecycle helpers
  setStompClient: (c: StompClient | null) => void;
  setSelfIdentity: (
    userId: string,
    publicKey: Uint8Array,
    privateKey: Uint8Array,
  ) => void;
  resetForLogout: () => Promise<void>;

  // Public actions
  fetchChats: () => Promise<void>;
  openChatWithUser: (otherUserId: string) => Promise<ChatSummary>;
  loadHistory: (chatId: string) => Promise<void>;
  sendText: (chatId: string, plaintext: string) => Promise<void>;
  sendTyping: (chatId: string, isTyping: boolean) => Promise<void>;
  markRead: (chatId: string) => Promise<void>;
  deleteMessage: (chatId: string, messageId: string) => Promise<void>;
  setDisappearingTtl: (chatId: string, ttlSeconds: number) => Promise<void>;
  muteChat: (chatId: string, mute: boolean) => Promise<void>;
  archiveChat: (chatId: string, archive: boolean) => Promise<void>;
  retryFailedSends: () => Promise<void>;

  // Peer-key access for verification UI
  getPeerIdentityPublicKey: (otherUserId: string) => Uint8Array | null;
  ensurePeerKeys: (otherUserId: string) => Promise<PeerKeys | null>;

  // Internal — invoked by ChatSocketProvider when a frame arrives.
  handleSocketEvent: (event: { type?: string; payload?: any }) => void;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseDateTime(value: string | null | undefined): number | null {
  if (!value) return null;
  // The backend sends LocalDateTime as "2026-05-26T12:34:56.789" (no Z).
  // Append Z so JS treats it as UTC; if it already has TZ info this is a no-op.
  const normalized = /[zZ+\-]\d{2}:?\d{2}$|Z$/.test(value) ? value : `${value}Z`;
  const ms = Date.parse(normalized);
  return isNaN(ms) ? null : ms;
}

function statusFromServer(status: string | undefined): LocalMessageStatus {
  switch (status) {
    case 'SENT':
      return 'sent';
    case 'DELIVERED':
      return 'delivered';
    case 'READ':
      return 'read';
    default:
      return 'sent';
  }
}

function ciphertextEnvelope(ciphertext?: string | null, ephemeralKey?: string | null) {
  if (!ciphertext || !ephemeralKey) return null;
  return { ciphertext, ephemeralPublicKey: ephemeralKey };
}

function mergeMessage(
  thread: LocalMessage[],
  incoming: LocalMessage,
): LocalMessage[] {
  // De-dup by serverId first, fall back to clientId.
  const matchIdx = thread.findIndex(
    (m) =>
      (incoming.serverId && m.serverId === incoming.serverId) ||
      (incoming.clientId && m.clientId === incoming.clientId),
  );
  if (matchIdx === -1) {
    return [...thread, incoming].sort((a, b) => a.timestamp - b.timestamp);
  }
  const existing = thread[matchIdx]!;
  // If we couldn't decrypt the incoming copy (typical for our own messages
  // coming back from the server — the ciphertext was encrypted for the peer,
  // not us) but we already have plaintext locally, keep the local text.
  // Status, delivery timestamps, and other metadata still flow through.
  const preservePlaintext = !incoming.decryptOk && existing.decryptOk && !!existing.text;
  const merged: LocalMessage = preservePlaintext
    ? { ...existing, ...incoming, text: existing.text, decryptOk: true }
    : { ...existing, ...incoming };
  const next = thread.slice();
  next[matchIdx] = merged;
  return next;
}

function makeClientId(): string {
  // Random + timestamp is enough — uniqueness is local to this device.
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// ─── Store ──────────────────────────────────────────────────────────────────

export const useChatStore = create<ChatStoreState>((set, get) => ({
  selfUserId: null,
  selfIdentityPrivate: null,
  selfIdentityPublic: null,

  stompClient: null,
  chats: {},
  chatOrder: [],
  messagesByChat: {},
  typingByChat: {},
  peerKeys: {},

  setStompClient: (c) => set({ stompClient: c }),
  setSelfIdentity: (userId, publicKey, privateKey) =>
    set({
      selfUserId: userId,
      selfIdentityPublic: publicKey,
      selfIdentityPrivate: privateKey,
    }),

  resetForLogout: async () => {
    const uid = get().selfUserId;
    if (uid) await wipeAllChatCaches(uid);
    set({
      selfUserId: null,
      selfIdentityPrivate: null,
      selfIdentityPublic: null,
      chats: {},
      chatOrder: [],
      messagesByChat: {},
      typingByChat: {},
      peerKeys: {},
    });
  },

  fetchChats: async () => {
    const { data } = await listChats();
    const list: any[] = data?.data ?? [];
    const chats: Record<string, ChatSummary> = {};
    const order: string[] = [];
    for (const c of list) {
      const summary: ChatSummary = {
        id: c.id,
        otherUserId: c.otherUserId,
        otherUserName: c.otherUserName ?? 'Unknown',
        otherUserHandle: c.otherUserHandle ?? undefined,
        otherUserAvatar: c.otherUserAvatar ?? undefined,
        otherUserStatus: c.otherUserStatus ?? undefined,
        lastMessageAt: c.lastMessageAt ?? null,
        unreadCount: Number(c.unreadCount ?? 0),
        isMuted: !!c.isMuted,
        isArchived: !!c.isArchived,
      };
      chats[summary.id] = summary;
      order.push(summary.id);
    }
    set({ chats, chatOrder: order });
  },

  openChatWithUser: async (otherUserId) => {
    // Reuse the cached entry if we have one with the same peer.
    const existing = Object.values(get().chats).find((c) => c.otherUserId === otherUserId);
    if (existing) return existing;

    const { data } = await getOrCreateChat(otherUserId);
    const c = data?.data ?? data;
    const summary: ChatSummary = {
      id: c.id,
      otherUserId: c.otherUserId,
      otherUserName: c.otherUserName ?? 'Unknown',
      otherUserHandle: c.otherUserHandle ?? undefined,
      otherUserAvatar: c.otherUserAvatar ?? undefined,
      otherUserStatus: c.otherUserStatus ?? undefined,
      lastMessageAt: c.lastMessageAt ?? null,
      unreadCount: Number(c.unreadCount ?? 0),
      isMuted: !!c.isMuted,
      isArchived: !!c.isArchived,
    };
    set((s) => ({
      chats: { ...s.chats, [summary.id]: summary },
      chatOrder: s.chatOrder.includes(summary.id) ? s.chatOrder : [summary.id, ...s.chatOrder],
    }));
    return summary;
  },

  loadHistory: async (chatId) => {
    const { selfUserId, selfIdentityPrivate } = get();
    if (!selfUserId || !selfIdentityPrivate) return;

    // 1) Show cached thread immediately so the UI isn't blank.
    const cached = await loadCachedThread(selfUserId, chatId);
    if (cached.length > 0) {
      set((s) => ({ messagesByChat: { ...s.messagesByChat, [chatId]: cached } }));
    }

    // 2) Pull recent server history and merge in any messages we haven't decrypted yet.
    try {
      const { data } = await getChatMessages(chatId, 0, 50);
      const page = data?.data;
      const items: any[] = (page?.content ?? []).slice().reverse(); // oldest first
      const decrypted: LocalMessage[] = [];
      for (const m of items) {
        const local = decryptServerMessage(m, chatId, selfUserId, selfIdentityPrivate);
        if (local) decrypted.push(local);
      }
      const next = decrypted.reduce<LocalMessage[]>(
        (acc, m) => mergeMessage(acc, m),
        cached,
      );
      set((s) => ({ messagesByChat: { ...s.messagesByChat, [chatId]: next } }));
      await saveCachedThread(selfUserId, chatId, next);
    } catch (e) {
      console.warn('[chat] history load failed', e);
    }
  },

  ensurePeerKeys: async (otherUserId) => {
    const cached = get().peerKeys[otherUserId];
    if (cached) return cached;

    try {
      const { data } = await fetchUserKeyBundle(otherUserId);
      const bundle = data?.data;
      if (!bundle?.identityPublicKey) return null;

      const identityPub = base64ToBytes(bundle.identityPublicKey);
      // Note: backend's KeyBundleResponse spells this field `signedPreKyPublic` (typo
      // in the DTO). We accept either spelling.
      const spkB64: string = bundle.signedPreKyPublic ?? bundle.signedPreKeyPublic;
      const spkSigB64: string = bundle.signedPreKeySignature;
      const spkPub = spkB64 ? base64ToBytes(spkB64) : new Uint8Array();
      const spkSig = spkSigB64 ? base64ToBytes(spkSigB64) : new Uint8Array();

      // Verify the SPK signature against the peer's identity. If it doesn't
      // validate, we still cache the identity (used for ECDH) but flag the
      // peer as unverified — UI should warn the user.
      const verifiedOnce = spkPub.length > 0 && spkSig.length > 0
        ? verifyEd25519(spkSig, spkPub, identityPub)
        : false;

      const peer: PeerKeys = {
        identityPublicKey: identityPub,
        signedPreKeyPublic: spkPub,
        signedPreKeySignature: spkSig,
        verifiedOnce,
        ...(bundle.oneTimePreKeyId ? { oneTimePreKeyId: bundle.oneTimePreKeyId } : {}),
        ...(bundle.oneTimePreKeyPublic
          ? { oneTimePreKeyPublic: base64ToBytes(bundle.oneTimePreKeyPublic) }
          : {}),
      };
      set((s) => ({ peerKeys: { ...s.peerKeys, [otherUserId]: peer } }));
      return peer;
    } catch (e) {
      console.warn('[chat] fetchUserKeyBundle failed', e);
      return null;
    }
  },

  getPeerIdentityPublicKey: (otherUserId) => {
    return get().peerKeys[otherUserId]?.identityPublicKey ?? null;
  },

  sendText: async (chatId, plaintext) => {
    const text = plaintext.trim();
    if (!text) return;
    const { selfUserId, chats } = get();
    if (!selfUserId) return;

    const chat = chats[chatId];
    if (!chat) {
      console.warn('[chat] sendText called for unknown chat', chatId);
      return;
    }

    // Optimistic insertion — pending status so the UI shows a sending state.
    const clientId = makeClientId();
    const optimistic: LocalMessage = {
      clientId,
      chatId,
      senderId: selfUserId,
      isSelf: true,
      type: 'TEXT',
      text,
      timestamp: Date.now(),
      status: 'pending',
      decryptOk: true,
    };
    set((s) => {
      const thread = s.messagesByChat[chatId] ?? [];
      return {
        messagesByChat: { ...s.messagesByChat, [chatId]: mergeMessage(thread, optimistic) },
      };
    });

    try {
      const peer = await get().ensurePeerKeys(chat.otherUserId);
      if (!peer) throw new Error('Peer key bundle unavailable');

      const envelope = encryptForRecipient({
        plaintext: text,
        recipientIdentityPublic: peer.identityPublicKey,
        senderId: selfUserId,
        chatId,
      });

      const payload: SendMessagePayload = {
        chatId,
        type: 'TEXT',
        ciphertext: envelope.ciphertext,
        ephemeralKey: envelope.ephemeralPublicKey,
        // preKeyId is only meaningful on first contact; we include it once if
        // the server handed one back. Subsequent messages omit it.
        ...(peer.oneTimePreKeyId && !chat.lastMessageAt
          ? { preKeyId: peer.oneTimePreKeyId }
          : {}),
      };

      const { data } = await sendChatMessage(payload);
      const m = data?.data;
      const serverId = m?.id;
      const serverTs = parseDateTime(m?.sentAt) ?? optimistic.timestamp;
      const expiresAt = parseDateTime(m?.expiresAt);

      set((s) => {
        const thread = s.messagesByChat[chatId] ?? [];
        const updated = thread.map((msg) =>
          msg.clientId === clientId
            ? {
                ...msg,
                serverId,
                timestamp: serverTs,
                status: 'sent' as LocalMessageStatus,
                expiresAt: expiresAt ?? null,
              }
            : msg,
        );
        return {
          messagesByChat: { ...s.messagesByChat, [chatId]: updated },
        };
      });
      const uid = get().selfUserId;
      if (uid) await saveCachedThread(uid, chatId, get().messagesByChat[chatId] ?? []);
    } catch (e) {
      console.warn('[chat] send failed', e);
      set((s) => {
        const thread = s.messagesByChat[chatId] ?? [];
        const updated = thread.map((msg) =>
          msg.clientId === clientId ? { ...msg, status: 'failed' as LocalMessageStatus } : msg,
        );
        return {
          messagesByChat: { ...s.messagesByChat, [chatId]: updated },
        };
      });
    }
  },

  sendTyping: async (chatId, isTyping) => {
    try {
      await sendChatTypingIndicator(chatId, isTyping);
    } catch (e) {
      // Typing is best-effort; never surface failures.
    }
  },

  markRead: async (chatId) => {
    try {
      await markChatRead(chatId);
      // Also mark delivered (in case messages arrived while app was backgrounded).
      await markChatDelivered(chatId).catch(() => {});
      set((s) => {
        const c = s.chats[chatId];
        if (!c) return s;
        return { chats: { ...s.chats, [chatId]: { ...c, unreadCount: 0 } } };
      });
    } catch (e) {
      console.warn('[chat] markRead failed', e);
    }
  },

  deleteMessage: async (chatId, messageId) => {
    try {
      await deleteChatMessage(messageId);
      set((s) => {
        const thread = s.messagesByChat[chatId] ?? [];
        return {
          messagesByChat: {
            ...s.messagesByChat,
            [chatId]: thread.map((m) =>
              m.serverId === messageId ? { ...m, isDeleted: true, text: '' } : m,
            ),
          },
        };
      });
      const uid = get().selfUserId;
      if (uid) await saveCachedThread(uid, chatId, get().messagesByChat[chatId] ?? []);
    } catch (e) {
      console.warn('[chat] deleteMessage failed', e);
    }
  },

  setDisappearingTtl: async (chatId, ttlSeconds) => {
    try {
      await setDisappearingMessages(chatId, ttlSeconds);
      set((s) => {
        const c = s.chats[chatId];
        if (!c) return s;
        return {
          chats: {
            ...s.chats,
            [chatId]: { ...c, disappearingTtlSeconds: ttlSeconds || null },
          },
        };
      });
    } catch (e) {
      console.warn('[chat] setDisappearingTtl failed', e);
    }
  },

  muteChat: async (chatId, mute) => {
    try {
      await apiMuteChat(chatId, mute);
      set((s) => {
        const c = s.chats[chatId];
        if (!c) return s;
        return { chats: { ...s.chats, [chatId]: { ...c, isMuted: mute } } };
      });
    } catch (e) {
      console.warn('[chat] muteChat failed', e);
    }
  },

  archiveChat: async (chatId, archive) => {
    try {
      await apiArchiveChat(chatId, archive);
      set((s) => {
        const c = s.chats[chatId];
        if (!c) return s;
        return { chats: { ...s.chats, [chatId]: { ...c, isArchived: archive } } };
      });
    } catch (e) {
      console.warn('[chat] archiveChat failed', e);
    }
  },

  retryFailedSends: async () => {
    const { messagesByChat } = get();
    for (const [chatId, thread] of Object.entries(messagesByChat)) {
      for (const msg of thread) {
        if (msg.isSelf && msg.status === 'failed' && msg.type === 'TEXT') {
          await get().sendText(chatId, msg.text);
        }
      }
    }
  },

  handleSocketEvent: (event) => {
    const { selfUserId, selfIdentityPrivate } = get();
    if (!selfUserId || !selfIdentityPrivate) return;
    const type = event?.type;
    const payload = event?.payload;
    if (!type || !payload) return;

    switch (type) {
      case 'chat.message':
      case 'chat.message.edited': {
        const chatId = payload.chatId as string;
        const local = decryptServerMessage(
          payload,
          chatId,
          selfUserId,
          selfIdentityPrivate,
        );
        if (!local) return;
        set((s) => {
          const thread = s.messagesByChat[chatId] ?? [];
          return {
            messagesByChat: {
              ...s.messagesByChat,
              [chatId]: mergeMessage(thread, local),
            },
            chats: bumpChat(s.chats, chatId, local),
          };
        });
        // Side-effects: persist and (if not self) tell server it arrived.
        const uid = get().selfUserId;
        if (uid) saveCachedThread(uid, chatId, get().messagesByChat[chatId] ?? []).catch(() => {});
        if (!local.isSelf) markChatDelivered(chatId).catch(() => {});
        break;
      }
      case 'chat.message.deleted': {
        const chatId = payload.chatId as string;
        const messageId = payload.messageId as string;
        set((s) => {
          const thread = s.messagesByChat[chatId] ?? [];
          return {
            messagesByChat: {
              ...s.messagesByChat,
              [chatId]: thread.map((m) =>
                m.serverId === messageId ? { ...m, isDeleted: true, text: '' } : m,
              ),
            },
          };
        });
        break;
      }
      case 'chat.typing': {
        const chatId = payload.chatId as string;
        const userId = payload.userId as string;
        const isTyping = !!payload.isTyping;
        if (userId === selfUserId) return; // ignore our own echo
        set((s) => ({ typingByChat: { ...s.typingByChat, [chatId]: isTyping } }));
        // Auto-clear the indicator after 5s if no follow-up arrives.
        if (isTyping) {
          setTimeout(() => {
            set((s) => {
              if (!s.typingByChat[chatId]) return s;
              return { typingByChat: { ...s.typingByChat, [chatId]: false } };
            });
          }, 5_000);
        }
        break;
      }
      case 'chat.read': {
        const chatId = payload.chatId as string;
        const readBy = payload.readBy as string;
        if (readBy === selfUserId) return;
        // Mark all our outgoing messages as read.
        set((s) => {
          const thread = s.messagesByChat[chatId] ?? [];
          return {
            messagesByChat: {
              ...s.messagesByChat,
              [chatId]: thread.map((m) => (m.isSelf ? { ...m, status: 'read' } : m)),
            },
          };
        });
        break;
      }
      case 'chat.delivered': {
        const chatId = payload.chatId as string;
        const deliveredTo = payload.deliveredTo as string;
        if (deliveredTo === selfUserId) return;
        set((s) => {
          const thread = s.messagesByChat[chatId] ?? [];
          return {
            messagesByChat: {
              ...s.messagesByChat,
              [chatId]: thread.map((m) =>
                m.isSelf && m.status === 'sent' ? { ...m, status: 'delivered' } : m,
              ),
            },
          };
        });
        break;
      }
      case 'chat.disappearing.updated': {
        const chatId = payload.chatId as string;
        const ttlSeconds = payload.ttlSeconds as number;
        set((s) => {
          const c = s.chats[chatId];
          if (!c) return s;
          return {
            chats: {
              ...s.chats,
              [chatId]: { ...c, disappearingTtlSeconds: ttlSeconds || null },
            },
          };
        });
        break;
      }
      default:
        // Other event types (calls, presence, payment) are handled elsewhere.
        break;
    }
  },
}));

function bumpChat(
  chats: Record<string, ChatSummary>,
  chatId: string,
  local: LocalMessage,
): Record<string, ChatSummary> {
  const c = chats[chatId];
  if (!c) return chats;
  return {
    ...chats,
    [chatId]: {
      ...c,
      lastMessageAt: new Date(local.timestamp).toISOString(),
      unreadCount: local.isSelf ? c.unreadCount : c.unreadCount + 1,
    },
  };
}

/**
 * Convert a server MessageResponse into a LocalMessage by attempting decryption.
 * Returns null for malformed payloads we should silently ignore.
 */
function decryptServerMessage(
  m: any,
  chatId: string,
  selfUserId: string,
  selfIdentityPrivate: Uint8Array,
): LocalMessage | null {
  if (!m?.id) return null;
  const isSelf = m.isSelf === true || m.senderId === selfUserId;
  const ts = parseDateTime(m.sentAt) ?? Date.now();
  const expiresAt = parseDateTime(m.expiresAt);
  const viewedAt = parseDateTime(m.viewedAt);
  const editedAt = parseDateTime(m.editedAt);

  let text = '';
  let decryptOk = true;
  if (m.isDeleted) {
    text = '';
  } else if (m.content) {
    // Support chat falls back to plaintext.
    text = m.content;
  } else {
    const env = ciphertextEnvelope(m.ciphertext, m.ephemeralKey);
    if (!env) {
      decryptOk = false;
    } else {
      const peerSenderId = m.senderId as string;
      if (isSelf) {
        // Our own message coming back from the server — we can't decrypt with
        // our private key because the ECDH was done against the recipient's
        // identity, not ours. The optimistic UI already has the plaintext;
        // surface a placeholder if we're seeing it cold (e.g. after re-install).
        text = '';
        decryptOk = false;
      } else {
        const plaintext = decryptFromSender({
          envelope: env,
          identityPrivateKey: selfIdentityPrivate,
          senderId: peerSenderId,
          chatId,
        });
        if (plaintext == null) {
          decryptOk = false;
        } else {
          text = plaintext;
        }
      }
    }
  }

  return {
    clientId: `s_${m.id}`,
    serverId: m.id,
    chatId,
    senderId: m.senderId,
    isSelf,
    type: (m.type ?? 'TEXT') as LocalMessage['type'],
    text,
    timestamp: ts,
    status: statusFromServer(m.status),
    expiresAt,
    viewedAt,
    editedAt,
    isDeleted: !!m.isDeleted,
    mediaKey: m.mediaKey ?? null,
    decryptOk,
  };
}
