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

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useChatStore } from '../store/chatStore';
import { useE2EE } from '../providers/E2EEProvider';
import type { LocalMessage } from '../store/chatTypes';
import type { Message } from '../components/chat/chatTypes';
import { formatTime } from '../components/chat/chatTypes';

export type UseChatResult = {
  ready: boolean;
  error: string | null;
  chatId: string | null;
  messages: Message[];
  isOtherTyping: boolean;
  /** Send a plaintext text message. Returns when the optimistic insert is in store; ack happens async. */
  sendText: (text: string) => Promise<void>;
  /** Inform peer about typing state. Debounce in the caller. */
  setTyping: (isTyping: boolean) => void;
  /** Mark all messages in this chat as read (call when screen mounts / focuses). */
  markRead: () => Promise<void>;
  /** Set per-chat disappearing-message TTL. 0 disables. */
  setDisappearingTtl: (seconds: number) => Promise<void>;
  /** Delete a message (server tombstone + local update). */
  deleteMessage: (serverId: string) => Promise<void>;
  /** Verification helpers for the safety-number UI. */
  peerVerified: boolean;
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
  };
}

const TYPING_DEBOUNCE_MS = 1200;

export function useChat(otherUserId: string | undefined): UseChatResult {
  const { identity, ready: e2eeReady } = useE2EE();

  const [chatId, setChatId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openChatWithUser = useChatStore((s) => s.openChatWithUser);
  const loadHistory = useChatStore((s) => s.loadHistory);
  const sendTextStore = useChatStore((s) => s.sendText);
  const sendTypingStore = useChatStore((s) => s.sendTyping);
  const markReadStore = useChatStore((s) => s.markRead);
  const setDisappearingTtlStore = useChatStore((s) => s.setDisappearingTtl);
  const deleteMessageStore = useChatStore((s) => s.deleteMessage);
  const ensurePeerKeys = useChatStore((s) => s.ensurePeerKeys);
  const setSelfIdentity = useChatStore((s) => s.setSelfIdentity);

  // Push the identity into the store every time it changes, so the store
  // can decrypt incoming messages even if no screen has called sendText yet.
  useEffect(() => {
    if (identity) {
      setSelfIdentity(
        identity.userId,
        identity.identityPublicKey,
        identity.identityPrivateKey,
      );
    }
  }, [identity, setSelfIdentity]);

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
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Could not open chat');
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

  const messages = useMemo<Message[]>(
    () => (thread ?? []).filter((m) => !m.isDeleted || true).map(toMessage),
    [thread],
  );

  const sendText = useCallback(
    async (text: string) => {
      if (!chatId) return;
      await sendTextStore(chatId, text);
    },
    [chatId, sendTextStore],
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
    setTyping,
    markRead,
    setDisappearingTtl,
    deleteMessage,
    peerVerified: !!peerKeys?.verifiedOnce,
    refresh,
  };
}
