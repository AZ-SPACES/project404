/**
 * useChat — view-model glue between a chat screen and the chat store.
 *
 * Caller passes:
 *   - `otherUserId`: the peer's user UUID (route param `id` on ChatScreen).
 *
 * The hook resolves (or creates) the backend chat resource and exposes a flat
 * API for the UI: thread, send/typing/read actions, typing indicator, etc.
 *
 * It also wires the existing `Message` shape used by the chat UI components to
 * the LocalMessage shape the store keeps internally — that lets ChatScreen
 * keep its components untouched.
 */

import { useEffect, useMemo, useRef, useState, useCallback, useReducer } from 'react';
import { useChatStore } from '../store/chatStore';
import { useE2EE } from '../providers/E2EEProvider';
import type { LocalMessage } from '../store/chatTypes';
import type { Message } from '../components/chat/chatTypes';
import { formatTime } from '../components/chat/chatTypes';
import { extractErrorMessage } from '../utils/errorUtils';

export type UseChatResult = {
  ready: boolean;
  error: string | null;
  chatId: string | null;
  messages: Message[];
  isOtherTyping: boolean;
  /** Send a plaintext text message. Returns when the optimistic insert is in store; ack happens async. */
  sendText: (text: string) => Promise<void>;
  /** Upload media to the server and send an encrypted message containing the media URL.
   *  `fileKeyB64` is the per-file E2EE key for encrypted media; omit for legacy/plaintext. */
  sendMedia: (mediaKey: string, mediaType: 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'VOICE_NOTE', caption?: string, fileKeyB64?: string) => Promise<void>;
  /** Inform peer about typing state. Debounce in the caller. */
  setTyping: (isTyping: boolean) => void;
  /** Mark all messages in this chat as read (call when screen mounts / focuses). */
  markRead: () => Promise<void>;
  /** Set per-chat disappearing-message TTL. 0 disables. */
  setDisappearingTtl: (seconds: number) => Promise<void>;
  /** Delete a message (server tombstone + local update). */
  deleteMessage: (serverId: string) => Promise<void>;
  /** Did the peer's SPK signature validate against their identity key? */
  spkSignatureValid: boolean;
  /** TOFU state for the peer's identity key — UI uses 'changed' to warn. */
  peerIdentityChange: 'first-seen' | 'unchanged' | 'changed' | null;
  /** True if there are messages that could not be decrypted (e.g. from before this device linked) */
  hasUndecryptableMessages: boolean;
  refresh: () => Promise<void>;
};

function toMessage(m: LocalMessage): Message {
  const time = new Date(m.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  const status: Message['status'] = m.status === 'failed' ? 'failed' : m.status === 'pending' ? 'sent' : m.status;
  const type: Message['type'] =
    m.type === 'TEXT'
      ? 'text'
      : m.type === 'IMAGE'
        ? 'image'
        : m.type === 'VIDEO'
          ? 'video'
          : m.type === 'VOICE_NOTE'
            ? 'audio'
            : 'document';
  const displayText = m.isDeleted
    ? 'This message was deleted'
    : m.decryptOk
      ? m.text
      : m.isSelf
        ? 'Message sent from another device'
        : '\u{1F512} Encrypted message';
  return {
    id: m.serverId ?? m.clientId,
    text: displayText,
    sender: m.isSelf ? 'me' : 'other',
    time,
    timestamp: m.timestamp,
    status,
    type,
    ...(m.mediaKey ? { uri: m.mediaKey } : {}),
    ...(m.mediaKeySecret ? { mediaSecret: m.mediaKeySecret } : {}),
    ...(m.expiresAt ? { expiresAt: m.expiresAt } : {}),
  };
}

// Cache the LocalMessage→Message conversion keyed by the *source object ref*.
// mergeMessage (and the store's update paths) preserve the reference of any
// unchanged message — only the inserted/merged one becomes a new object — so a
// cache hit here means the message is genuinely unchanged and we can hand back
// the exact same Message instance. That stable identity is what lets the
// memo'd ChatMessageBubble bail out instead of re-rendering the whole list on
// every incoming frame. A WeakMap evicts entries automatically as the store
// drops old LocalMessage objects.
const messageCache = new WeakMap<LocalMessage, Message>();
function toMessageCached(m: LocalMessage): Message {
  const hit = messageCache.get(m);
  if (hit) return hit;
  const out = toMessage(m);
  messageCache.set(m, out);
  return out;
}

const TYPING_DEBOUNCE_MS = 400;

export function useChat(otherUserId: string | undefined): UseChatResult {
  const { identity, ready: e2eeReady } = useE2EE();

  const [chatId, setChatId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openChatWithUser = useChatStore((s) => s.openChatWithUser);
  const loadHistory = useChatStore((s) => s.loadHistory);
  const sendTextStore = useChatStore((s) => s.sendText);
  const sendMediaStore = useChatStore((s) => s.sendMedia);
  const sendTypingStore = useChatStore((s) => s.sendTyping);
  const markReadStore = useChatStore((s) => s.markRead);
  const setDisappearingTtlStore = useChatStore((s) => s.setDisappearingTtl);
  const deleteMessageStore = useChatStore((s) => s.deleteMessage);
  const ensurePeerKeys = useChatStore((s) => s.ensurePeerKeys);
  // Note: setSelfIdentity is invoked by E2EEProvider as part of bootstrap,
  // so the store already has the keypair before any screen mounts.

  // Resolve/create the chat resource once otherUserId + identity are known.
  useEffect(() => {
    if (!otherUserId || !e2eeReady) return;
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const summary = await openChatWithUser(otherUserId);
        if (cancelled) return;
        setChatId(summary.id);
        await loadHistory(summary.id);
        // Pre-fetch peer key bundle so the first send is instant and
        // verification UI works on first open.
        await ensurePeerKeys(otherUserId);
      } catch (e: unknown) {
        if (!cancelled) setError(extractErrorMessage(e, 'Could not open chat'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [otherUserId, e2eeReady, openChatWithUser, loadHistory, ensurePeerKeys]);

  // Pull store state for THIS chat only (selectors keep re-renders tight).
  const thread = useChatStore((s) => (chatId ? s.messagesByChat[chatId] : undefined));
  const isOtherTyping = useChatStore((s) => (chatId ? !!s.typingByChat[chatId] : false));
  const peerKeys = useChatStore((s) => (otherUserId ? s.peerKeys[otherUserId] : undefined));

  const hasUndecryptableMessages = useMemo(() => {
    return thread?.some((m) => !m.decryptOk) ?? false;
  }, [thread]);

  // Tick every 5 s when the thread has messages with a live TTL so the expiry
  // filter and the timer badge in the bubble stay current without waiting for
  // an unrelated re-render to fire first.
  const [expiryTick, bumpExpiryTick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!thread) return;
    const hasLive = thread.some(
      (m) => typeof m.expiresAt === 'number' && m.expiresAt > Date.now(),
    );
    if (!hasLive) return;
    const id = setInterval(bumpExpiryTick, 5_000);
    return () => clearInterval(id);
  }, [thread]);

  const messages = useMemo<Message[]>(() => {
    if (!thread) return [];
    const now = Date.now();
    void expiryTick; // forces recompute each tick without referencing the value
    return thread
      .filter(
        (m) =>
          m.decryptOk &&
          !(typeof m.expiresAt === 'number' && m.expiresAt > 0 && m.expiresAt <= now),
      )
      .map(toMessageCached);
  // expiryTick is intentional — it drives the periodic re-filter
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread, expiryTick]);

  const sendText = useCallback(
    async (text: string) => {
      if (!chatId) return;
      await sendTextStore(chatId, text);
    },
    [chatId, sendTextStore],
  );

  const sendMedia = useCallback(
    async (mediaKey: string, mediaType: 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'VOICE_NOTE', caption?: string, fileKeyB64?: string) => {
      if (!chatId) return;
      await sendMediaStore(chatId, mediaKey, mediaType, caption, fileKeyB64);
    },
    [chatId, sendMediaStore],
  );

  // Typing indicator with leading + trailing debounce.
  const typingStateRef = useRef<{ active: boolean; timer: ReturnType<typeof setTimeout> | null }>({
    active: false,
    timer: null,
  });
  const setTyping = useCallback(
    (isTyping: boolean) => {
      if (!chatId) return;
      const state = typingStateRef.current;
      if (isTyping) {
        if (!state.active) {
          state.active = true;
          sendTypingStore(chatId, true).catch(() => {});
        }
        if (state.timer) clearTimeout(state.timer);
        state.timer = setTimeout(() => {
          state.active = false;
          sendTypingStore(chatId, false).catch(() => {});
        }, TYPING_DEBOUNCE_MS);
      } else {
        if (state.timer) clearTimeout(state.timer);
        state.timer = null;
        if (state.active) {
          state.active = false;
          sendTypingStore(chatId, false).catch(() => {});
        }
      }
    },
    [chatId, sendTypingStore],
  );

  useEffect(() => () => {
    if (typingStateRef.current.timer) {
      clearTimeout(typingStateRef.current.timer);
      if (chatId && typingStateRef.current.active) {
        sendTypingStore(chatId, false).catch(() => {});
      }
    }
  }, [chatId, sendTypingStore]);

  const markRead = useCallback(async () => {
    if (!chatId) return;
    await markReadStore(chatId);
  }, [chatId, markReadStore]);

  const setDisappearingTtl = useCallback(
    async (seconds: number) => {
      if (!chatId) return;
      await setDisappearingTtlStore(chatId, seconds);
    },
    [chatId, setDisappearingTtlStore],
  );

  const deleteMessage = useCallback(
    async (serverId: string) => {
      if (!chatId) return;
      await deleteMessageStore(chatId, serverId);
    },
    [chatId, deleteMessageStore],
  );

  const refresh = useCallback(async () => {
    if (!chatId) return;
    await loadHistory(chatId);
  }, [chatId, loadHistory]);

  // Suppress unused warning for formatTime — we keep the import to expose it
  // to consumers that want consistent timestamps.
  void formatTime;

  return {
    ready: e2eeReady && !!chatId,
    error,
    chatId,
    messages,
    isOtherTyping,
    sendText,
    sendMedia,
    setTyping,
    markRead,
    setDisappearingTtl,
    deleteMessage,
    /** Cryptographic signature on the peer's SPK validated against their identity. */
    spkSignatureValid: !!peerKeys?.spkSignatureValid,
    /** TOFU result from the peer-identity cache; 'changed' means the user should be warned. */
    peerIdentityChange: peerKeys?.identityChange ?? null,
    hasUndecryptableMessages,
    refresh,
  };
}
