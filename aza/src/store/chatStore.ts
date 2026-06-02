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
  decryptV3,
  encryptFirstMessageV3,
  encryptFollowupMessageV3,
  verifyEd25519,
  type RecipientBundle,
  type V3Envelope,
} from '../crypto/e2ee';
import {
  deleteConsumedOneTimePreKey,
  getPreviousSignedPreKeyPrivate,
  getSignedPreKeyPrivate,
  readOneTimePreKey,
} from '../crypto/keystore';
import type { LocalMessage, LocalMessageStatus } from './chatTypes';
import {
  loadCachedThread,
  saveCachedThread,
  clearCachedThread,
  wipeAllChatCaches,
} from './encryptedMessageStore';
import {
  recordPeerIdentity,
  wipePeerIdentityCache,
} from './peerIdentityCache';
import {
  hasSessionWithPeer,
  markSessionEstablished,
  wipeSessionFlags,
} from './sessionCache';
import {
  deleteSessionRoot,
  indexSessionRoot,
  loadSessionRoot,
  saveSessionRoot,
  wipeAllSessionRoots,
} from './sessionRootCache';

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
  /**
   * True iff the signed-pre-key signature validated against the peer's
   * identity key. Does NOT mean the user has out-of-band verified the
   * safety number — for that, layer additional state on top.
   */
  spkSignatureValid: boolean;
  /**
   * TOFU state. `null` until we've checked the peer-identity cache.
   *  - 'first-seen': peer not seen before; cache now seeded.
   *  - 'unchanged': identity matches our last record.
   *  - 'changed':   identity differs from what we saw last time. UI
   *                 should warn loudly until the user acknowledges.
   */
  identityChange: 'first-seen' | 'unchanged' | 'changed' | null;
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
  sendMedia: (chatId: string, mediaKey: string, mediaType: 'IMAGE' | 'VIDEO' | 'DOCUMENT', caption?: string) => Promise<void>;
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

/**
 * Window inside which an unmatched server echo can be attributed to a
 * pending optimistic entry. Tight enough to avoid false positives even
 * under bad clock skew, wide enough to absorb the typical request-round-trip.
 */
const ECHO_RECONCILE_WINDOW_MS = 30_000;

/**
 * Binary-search the leftmost index i such that thread[i].timestamp >= ts.
 * Assumes the thread is already sorted ascending by timestamp.
 */
function lowerBoundByTimestamp(thread: LocalMessage[], ts: number): number {
  let lo = 0;
  let hi = thread.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (thread[mid]!.timestamp < ts) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// Exported for tests.
export function mergeMessage(
  thread: LocalMessage[],
  incoming: LocalMessage,
): LocalMessage[] {
  // De-dup by serverId first, fall back to clientId.
  let matchIdx = thread.findIndex(
    (m) =>
      (incoming.serverId && m.serverId === incoming.serverId) ||
      (incoming.clientId && m.clientId === incoming.clientId),
  );
  // Second pass: a WS echo can arrive before the REST response has stamped
  // the optimistic entry with its serverId. In that case neither id matches
  // but we can still attribute the echo by (isSelf, senderId, type, time).
  // This prevents double-insertion of our own message.
  if (
    matchIdx === -1 &&
    incoming.serverId &&
    incoming.isSelf &&
    incoming.senderId
  ) {
    matchIdx = thread.findIndex(
      (m) =>
        m.isSelf &&
        !m.serverId &&
        m.senderId === incoming.senderId &&
        m.type === incoming.type &&
        Math.abs(m.timestamp - incoming.timestamp) <= ECHO_RECONCILE_WINDOW_MS,
    );
  }
  if (matchIdx === -1) {
    // Insert at the right timestamp position. The thread is kept sorted on
    // every write, so a binary search finds the insertion index in O(log n)
    // and the resulting array copy is O(n). The old full-sort path was
    // O(n log n) per message which becomes noticeable past a few thousand.
    const idx = lowerBoundByTimestamp(thread, incoming.timestamp);
    const next = thread.slice();
    next.splice(idx, 0, incoming);
    return next;
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
    if (uid) {
      await Promise.all([
        wipeAllChatCaches(uid),
        wipePeerIdentityCache(uid).catch(() => {}),
        wipeSessionFlags(uid).catch(() => {}),
        wipeAllSessionRoots(uid).catch(() => {}),
      ]);
    }
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
        const local = await decryptServerMessage(m, chatId, selfUserId, selfIdentityPrivate);
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

    const { selfUserId } = get();
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
      // validate, we still cache the identity (used for ECDH) but mark the
      // signature as untrusted — UI should warn the user.
      const spkSignatureValid = spkPub.length > 0 && spkSig.length > 0
        ? verifyEd25519(spkSig, spkPub, identityPub)
        : false;

      // TOFU check: compare against the persisted identity public key for
      // this peer. A `changed` result means either legitimate rotation or
      // server-side impersonation — either way, alert the UI.
      let identityChange: PeerKeys['identityChange'] = null;
      if (selfUserId) {
        try {
          const state = await recordPeerIdentity(selfUserId, otherUserId, identityPub);
          identityChange = state.kind;
          if (state.kind === 'changed') {
            console.warn(
              `[E2EE] peer ${otherUserId} identity key changed since last contact — re-verify safety number`,
            );
            // Drop any cached session root we held against the old IK —
            // it's keyed on the old public key and the loadSessionRoot
            // fingerprint check would refuse to return it anyway, but
            // proactive deletion stops the entry from leaking when the
            // user later resets.
            deleteSessionRoot(selfUserId, otherUserId).catch(() => {});
          }
        } catch (e) {
          console.warn('[E2EE] TOFU check failed', e);
        }
      }

      const peer: PeerKeys = {
        identityPublicKey: identityPub,
        signedPreKeyPublic: spkPub,
        signedPreKeySignature: spkSig,
        spkSignatureValid,
        identityChange,
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
      const selfIdentityPub = get().selfIdentityPublic;
      const selfIdentityPriv = get().selfIdentityPrivate;
      if (!selfIdentityPub || !selfIdentityPriv) {
        throw new Error('Identity not ready');
      }

      // v3 path: try to load a cached session root. If absent (or if the peer
      // identity changed underneath us) we run X3DH and persist a fresh root.
      let rootKey = await loadSessionRoot(
        selfUserId,
        chat.otherUserId,
        peer.identityPublicKey,
      );
      let envelope: V3Envelope;
      let usedPreKeyId: string | undefined;
      if (!rootKey) {
        const bundle: RecipientBundle = {
          identityPublicKey: peer.identityPublicKey,
          signedPreKeyPublic: peer.signedPreKeyPublic,
          ...(peer.oneTimePreKeyId ? { oneTimePreKeyId: peer.oneTimePreKeyId } : {}),
          ...(peer.oneTimePreKeyPublic
            ? { oneTimePreKeyPublic: peer.oneTimePreKeyPublic }
            : {}),
        };
        const first = encryptFirstMessageV3({
          plaintext: text,
          senderIdentityKeyPair: {
            publicKey: selfIdentityPub,
            privateKey: selfIdentityPriv,
          },
          recipientBundle: bundle,
          senderId: selfUserId,
          chatId,
        });
        envelope = first.envelope;
        rootKey = first.rootKey;
        usedPreKeyId = peer.oneTimePreKeyId ?? undefined;
        // Persist before the network call so a crash mid-send doesn't lose the
        // root — worst case we re-send and the peer will see a duplicate first
        // message, which the OPK uniqueness check already protects against.
        await saveSessionRoot(
          selfUserId,
          chat.otherUserId,
          rootKey,
          peer.identityPublicKey,
        );
        await indexSessionRoot(selfUserId, chat.otherUserId);
      } else {
        const followup = encryptFollowupMessageV3({
          plaintext: text,
          rootKey,
          recipientIdentityPublic: peer.identityPublicKey,
          senderId: selfUserId,
          chatId,
        });
        envelope = followup.envelope;
        // Ratchet: persist the new root BEFORE publishing so a mid-send crash
        // leaves both sides on the same ratchet step.
        await saveSessionRoot(selfUserId, chat.otherUserId, followup.newRootKey, peer.identityPublicKey);
        followup.newRootKey.fill(0);
      }

      const payload: SendMessagePayload = {
        chatId,
        type: 'TEXT',
        ciphertext: envelope.ciphertext,
        ephemeralKey: envelope.ephemeralPublicKey,
        // The server persists clientId and echoes it back on the eventual WS
        // frame, letting mergeMessage attribute the echo to this optimistic
        // entry deterministically instead of falling back to a timing heuristic.
        clientId,
        ...(envelope.senderIdentityPublicKey
          ? { senderIdentityPublicKey: envelope.senderIdentityPublicKey }
          : {}),
        ...(usedPreKeyId ? { preKeyId: usedPreKeyId } : {}),
      };

      // Prefer WebSocket — the connection is already live so there is no HTTP
      // handshake overhead. The server persists the message and broadcasts the
      // echo to both participants; handleSocketEvent picks it up and promotes
      // the optimistic entry from 'pending' to 'sent' via mergeMessage+clientId.
      // Fall back to REST when the STOMP client is offline (e.g., reconnecting).
      const stompClient = get().stompClient;
      if (stompClient?.connected) {
        stompClient.publish({
          destination: '/app/chat.send',
          body: JSON.stringify(payload),
        });
        hasSessionWithPeer(selfUserId, chat.otherUserId).then((established) => {
          if (!established) markSessionEstablished(selfUserId, chat.otherUserId).catch(() => {});
        });
        const uid = get().selfUserId;
        if (uid) saveCachedThread(uid, chatId, get().messagesByChat[chatId] ?? []).catch(() => {});
        // Safety net: if the WS echo never arrives (e.g. the connection drops
        // immediately after publish), mark the message failed so retryFailedSends
        // can pick it up on reconnect.
        setTimeout(() => {
          set((s) => {
            const thread = s.messagesByChat[chatId] ?? [];
            const msg = thread.find((m) => m.clientId === clientId);
            if (!msg || msg.status !== 'pending') return s;
            return {
              messagesByChat: {
                ...s.messagesByChat,
                [chatId]: thread.map((m) =>
                  m.clientId === clientId ? { ...m, status: 'failed' as LocalMessageStatus } : m,
                ),
              },
            };
          });
        }, 8_000);
        return;
      }

      // REST fallback — used when WebSocket is not connected.
      const { data } = await sendChatMessage(payload);
      const m = data?.data;
      const serverId = m?.id;
      const serverTs = parseDateTime(m?.sentAt) ?? optimistic.timestamp;
      const expiresAt = parseDateTime(m?.expiresAt);

      // Keep the legacy session-established flag in sync.
      const sessionEstablished = await hasSessionWithPeer(selfUserId, chat.otherUserId);
      if (!sessionEstablished) {
        markSessionEstablished(selfUserId, chat.otherUserId).catch(() => {});
      }

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

  sendMedia: async (chatId, mediaKey, mediaType, caption = '') => {
    const { selfUserId, chats } = get();
    if (!selfUserId) return;

    const chat = chats[chatId];
    if (!chat) {
      console.warn('[chat] sendMedia called for unknown chat', chatId);
      return;
    }

    const clientId = makeClientId();
    const optimistic: LocalMessage = {
      clientId,
      chatId,
      senderId: selfUserId,
      isSelf: true,
      type: mediaType,
      text: caption,
      timestamp: Date.now(),
      status: 'pending',
      decryptOk: true,
      mediaKey,
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
      const selfIdentityPub = get().selfIdentityPublic;
      const selfIdentityPriv = get().selfIdentityPrivate;
      if (!selfIdentityPub || !selfIdentityPriv) throw new Error('Identity not ready');

      const plaintextForEncryption = caption.trim() || ' ';

      let rootKey = await loadSessionRoot(selfUserId, chat.otherUserId, peer.identityPublicKey);
      let envelope: V3Envelope;
      let usedPreKeyId: string | undefined;

      if (!rootKey) {
        const bundle: RecipientBundle = {
          identityPublicKey: peer.identityPublicKey,
          signedPreKeyPublic: peer.signedPreKeyPublic,
          ...(peer.oneTimePreKeyId ? { oneTimePreKeyId: peer.oneTimePreKeyId } : {}),
          ...(peer.oneTimePreKeyPublic ? { oneTimePreKeyPublic: peer.oneTimePreKeyPublic } : {}),
        };
        const first = encryptFirstMessageV3({
          plaintext: plaintextForEncryption,
          senderIdentityKeyPair: { publicKey: selfIdentityPub, privateKey: selfIdentityPriv },
          recipientBundle: bundle,
          senderId: selfUserId,
          chatId,
        });
        envelope = first.envelope;
        rootKey = first.rootKey;
        usedPreKeyId = peer.oneTimePreKeyId ?? undefined;
        await saveSessionRoot(selfUserId, chat.otherUserId, rootKey, peer.identityPublicKey);
        await indexSessionRoot(selfUserId, chat.otherUserId);
      } else {
        const followup = encryptFollowupMessageV3({
          plaintext: plaintextForEncryption,
          rootKey,
          recipientIdentityPublic: peer.identityPublicKey,
          senderId: selfUserId,
          chatId,
        });
        envelope = followup.envelope;
        await saveSessionRoot(selfUserId, chat.otherUserId, followup.newRootKey, peer.identityPublicKey);
        followup.newRootKey.fill(0);
      }

      const payload: SendMessagePayload = {
        chatId,
        type: mediaType,
        ciphertext: envelope.ciphertext,
        ephemeralKey: envelope.ephemeralPublicKey,
        mediaKey,
        clientId,
        ...(envelope.senderIdentityPublicKey
          ? { senderIdentityPublicKey: envelope.senderIdentityPublicKey }
          : {}),
        ...(usedPreKeyId ? { preKeyId: usedPreKeyId } : {}),
      };

      const stompClient = get().stompClient;
      if (stompClient?.connected) {
        stompClient.publish({
          destination: '/app/chat.send',
          body: JSON.stringify(payload),
        });
        const uid = get().selfUserId;
        if (uid) saveCachedThread(uid, chatId, get().messagesByChat[chatId] ?? []).catch(() => {});
        setTimeout(() => {
          set((s) => {
            const thread = s.messagesByChat[chatId] ?? [];
            const msg = thread.find((m) => m.clientId === clientId);
            if (!msg || msg.status !== 'pending') return s;
            return {
              messagesByChat: {
                ...s.messagesByChat,
                [chatId]: thread.map((m) =>
                  m.clientId === clientId ? { ...m, status: 'failed' as LocalMessageStatus } : m,
                ),
              },
            };
          });
        }, 8_000);
        return;
      }

      const { data } = await sendChatMessage(payload);
      const m = data?.data;
      const serverId = m?.id;
      const serverTs = parseDateTime(m?.sentAt) ?? optimistic.timestamp;
      const expiresAt = parseDateTime(m?.expiresAt);

      set((s) => {
        const thread = s.messagesByChat[chatId] ?? [];
        const updated = thread.map((msg) =>
          msg.clientId === clientId
            ? { ...msg, serverId, timestamp: serverTs, status: 'sent' as LocalMessageStatus, expiresAt: expiresAt ?? null }
            : msg,
        );
        return { messagesByChat: { ...s.messagesByChat, [chatId]: updated } };
      });

      const uid = get().selfUserId;
      if (uid) await saveCachedThread(uid, chatId, get().messagesByChat[chatId] ?? []);
    } catch (e) {
      console.warn('[chat] sendMedia failed', e);
      set((s) => {
        const thread = s.messagesByChat[chatId] ?? [];
        const updated = thread.map((msg) =>
          msg.clientId === clientId ? { ...msg, status: 'failed' as LocalMessageStatus } : msg,
        );
        return { messagesByChat: { ...s.messagesByChat, [chatId]: updated } };
      });
    }
  },

  sendTyping: (chatId, isTyping) => {
    // Prefer the already-open WebSocket connection — no HTTP round-trip, near-instant
    // delivery to the peer. Falls back to REST only if the STOMP client is offline.
    const client = get().stompClient;
    if (client?.connected) {
      client.publish({
        destination: '/app/chat.typing',
        body: JSON.stringify({ chatId, isTyping }),
      });
      return Promise.resolve();
    }
    // REST fallback — best-effort, never throw.
    sendChatTypingIndicator(chatId, isTyping).catch(() => {});
    return Promise.resolve();
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
        // Decryption is async (X3DH may touch SecureStore). Detach so the
        // WS frame loop isn't blocked; ordering within a chat is preserved
        // because we process one frame at a time and queue subsequent
        // mutations behind the same promise chain.
        (async () => {
          const local = await decryptServerMessage(
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
        })().catch((e) => console.warn('[chat] decrypt failed', e));
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
 *
 * Async because v3 decryption may need to read the SPK private + consume an
 * OPK from SecureStore on first-contact messages, and may need to load the
 * cached session root key for follow-ups.
 */
async function decryptServerMessage(
  m: any,
  chatId: string,
  selfUserId: string,
  selfIdentityPrivate: Uint8Array,
): Promise<LocalMessage | null> {
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
  } else if (!m.ciphertext || !m.ephemeralKey) {
    decryptOk = false;
  } else if (isSelf) {
    // Our own message coming back from the server — we don't try to decrypt;
    // the optimistic entry already holds the plaintext and mergeMessage
    // preserves it across the undecryptable echo.
    text = '';
    decryptOk = false;
  } else {
    const peerSenderId = m.senderId as string;
    const v3Envelope: V3Envelope = {
      ephemeralPublicKey: m.ephemeralKey,
      ciphertext: m.ciphertext,
      ...(m.senderIdentityPublicKey
        ? { senderIdentityPublicKey: m.senderIdentityPublicKey }
        : {}),
      ...(m.preKeyId ? { preKeyId: m.preKeyId } : {}),
    };

    let plaintext: string | null = null;
    if (v3Envelope.senderIdentityPublicKey) {
      // v3 first-message path. We need our SPK private and (if referenced)
      // the OPK private.
      //
      // OPK is read WITHOUT consuming so we can retry with a fallback SPK if
      // the current SPK fails. The OPK is deleted only after a successful
      // decrypt to prevent it being replayed.
      const spkPriv = await getSignedPreKeyPrivate(selfUserId);
      let opkPriv: Uint8Array | null = null;
      let opkId: number | null = null;
      if (m.preKeyId != null) {
        opkId = Number(m.preKeyId);
        if (!Number.isNaN(opkId)) {
          opkPriv = await readOneTimePreKey(selfUserId, opkId);
        }
      }

      const tryDecryptFirst = async (spkPrivKey: Uint8Array) => {
        const result = decryptV3({
          envelope: v3Envelope,
          recipientIdentityPrivate: selfIdentityPrivate,
          recipientSignedPreKeyPrivate: spkPrivKey,
          oneTimePreKeyPrivate: opkPriv,
          senderId: peerSenderId,
          chatId,
        });
        if (!result) return null;
        const senderIK = base64ToBytes(v3Envelope.senderIdentityPublicKey!);
        try {
          await saveSessionRoot(selfUserId, peerSenderId, result.rootKey!, senderIK);
          await indexSessionRoot(selfUserId, peerSenderId);
          result.rootKey!.fill(0);
        } catch (e) {
          console.warn('[chat] failed to persist session root', e);
        }
        return result.plaintext;
      };

      if (spkPriv) plaintext = await tryDecryptFirst(spkPriv);

      // Fallback: try the previous SPK (within the 30-day grace period after rotation).
      if (plaintext == null) {
        const prevSpkPriv = await getPreviousSignedPreKeyPrivate(selfUserId);
        if (prevSpkPriv) plaintext = await tryDecryptFirst(prevSpkPriv);
      }

      // Consume OPK only after at least one successful decrypt.
      if (plaintext != null && opkId != null) {
        deleteConsumedOneTimePreKey(selfUserId, opkId).catch(() => {});
      }
    } else {
      // v3 follow-up: needs a cached root key keyed by the sender's IK.
      // We don't have a direct peerKeys map by senderId; pull from the
      // store's peerKeys cache if it's there, else fall back to v2.
      const peer = useChatStore.getState().peerKeys[peerSenderId];
      if (peer) {
        const cachedRoot = await loadSessionRoot(
          selfUserId,
          peerSenderId,
          peer.identityPublicKey,
        );
        if (cachedRoot) {
          const result = decryptV3({
            envelope: v3Envelope,
            recipientIdentityPrivate: selfIdentityPrivate,
            cachedRootKey: cachedRoot,
            senderId: peerSenderId,
            chatId,
          });
          if (result) {
            plaintext = result.plaintext;
            // Ratchet: persist the new root so the next follow-up has the
            // correct starting state.
            if (result.rootKey) {
              try {
                await saveSessionRoot(selfUserId, peerSenderId, result.rootKey, peer.identityPublicKey);
                result.rootKey.fill(0);
              } catch (e) {
                console.warn('[chat] failed to update session root', e);
              }
            }
          }
        }
      }
    }

    // Legacy fallback: v2/v1 envelopes from older clients still in flight.
    if (plaintext == null) {
      plaintext = decryptFromSender({
        envelope: {
          ephemeralPublicKey: v3Envelope.ephemeralPublicKey,
          ciphertext: v3Envelope.ciphertext,
        },
        identityPrivateKey: selfIdentityPrivate,
        senderId: peerSenderId,
        chatId,
      });
    }

    if (plaintext == null) {
      decryptOk = false;
    } else {
      text = plaintext;
    }
  }

  // Prefer the server-echoed clientId for self messages — that's our
  // optimistic entry's local id, so mergeMessage will match it directly
  // without falling back to the time-window heuristic. For peer messages
  // the echoed clientId is the peer's, which we don't care about; we mint
  // a stable surrogate keyed on the serverId instead.
  const echoedClientId: string | undefined = typeof m.clientId === 'string' ? m.clientId : undefined;
  const localClientId = isSelf && echoedClientId ? echoedClientId : `s_${m.id}`;

  return {
    clientId: localClientId,
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
