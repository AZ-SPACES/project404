/**
 * ChatSocketProvider — one STOMP/WebSocket connection per session, dedicated
 * to chat events. Routes incoming frames to the chat store, which decrypts
 * them and updates local state.
 *
 * The PresenceProvider already maintains a separate STOMP client for
 * heartbeats; we keep them separate so chat reconnects don't disturb
 * presence and vice versa.
 */

import 'fast-text-encoding';
import React, { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { Client, ReconnectionTimeMode } from '@stomp/stompjs';
import * as SecureStore from 'expo-secure-store';

import { BASE_URL, TOKEN_KEY } from '../services/api';
import { useAuth } from './AuthProvider';
import { useE2EE } from './E2EEProvider';
import { useChatStore } from '../store/chatStore';
import { subscribeAuthEvents } from './authEvents';
import { flushSessionRoots } from '../store/sessionRootCache';

export function ChatSocketProvider({ children }: { children: React.ReactNode }) {
  const { userToken } = useAuth();
  const { identity, ready } = useE2EE();
  const clientRef = useRef<Client | null>(null);
  const overrideTokenRef = useRef<string | null>(null);

  // Track the most recent send function on a ref so the STOMP onConnect
  // closure always sees the up-to-date store action without re-mounting.
  const onEvent = useChatStore((s) => s.handleSocketEvent);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  // Pull the connect routine out of the effect so the token-rotation
  // handler can call it directly without waiting for a re-render.
  const connect = React.useCallback(async () => {
    const token =
      overrideTokenRef.current ?? (await SecureStore.getItemAsync(TOKEN_KEY));
    overrideTokenRef.current = null;
    if (!token) return;

    const wsUrl =
      BASE_URL.replace('https://', 'wss://').replace('http://', 'ws://').replace(/\/$/, '') +
      '/ws/websocket';

    const client = new Client({
      brokerURL: wsUrl,
      connectHeaders: { Authorization: `Bearer ${token}` },
      // Every send while the socket is down falls back to REST, which is a
      // fresh TLS handshake per message. A flat 5s retry meant a transient
      // drop (tunnel, cell handover) put the whole conversation on the slow
      // path for seconds; retry almost immediately instead, and back off
      // exponentially so a genuinely down server isn't hammered.
      reconnectDelay: 500,
      reconnectTimeMode: ReconnectionTimeMode.EXPONENTIAL,
      maxReconnectDelay: 15_000,
      heartbeatIncoming: 10_000,
      heartbeatOutgoing: 10_000,
      forceBinaryWSFrames: true,
      appendMissingNULLonIncoming: true,
      onConnect: () => {
        // Personal queue — server publishes per-recipient chat events here.
        client.subscribe('/user/queue/chat', (frame) => {
          try {
            const msg = JSON.parse(frame.body);
            onEventRef.current(msg);
          } catch (e) {
            console.error('[chat-ws] bad frame', e);
          }
        });
        // Reset retry visuals on each reconnect by replaying any pending sends.
        useChatStore.getState().retryFailedSends().catch(() => {});
      },
      onStompError: (frame) => {
        console.warn('[chat-ws] STOMP error', frame.headers['message'], frame.body);
      },
      onWebSocketError: (event) => {
        console.warn('[chat-ws] WS error', event);
      },
    });

    client.activate();
    clientRef.current = client;
    useChatStore.getState().setStompClient(client);
  }, []);

  useEffect(() => {
    if (!userToken || !ready || !identity) {
      if (clientRef.current) {
        clientRef.current.deactivate();
        clientRef.current = null;
      }
      return;
    }
    connect();
    return () => {
      if (clientRef.current) {
        clientRef.current.deactivate();
        clientRef.current = null;
      }
      useChatStore.getState().setStompClient(null);
    };
  }, [userToken, ready, identity, connect]);

  // Close the socket when the app backgrounds so the server can mark the
  // session offline promptly (instead of waiting for the broker heartbeat
  // to time out), and reconnect when the app returns to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      const client = clientRef.current;
      if (!client) return;
      if (state === 'active') {
        if (!client.active) client.activate();
      } else if (state === 'background') {
        // Sends don't wait on the session-root write, so make sure the
        // ratchet is durable before the OS is free to kill us.
        flushSessionRoots().catch(() => {});
        client.deactivate().catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

  // When axios refreshes the access token, tear down the current client
  // and reconnect immediately with the new bearer. Without this the STOMP
  // client would keep retrying with the stale token until the broker
  // dropped it.
  useEffect(() => {
    const unsub = subscribeAuthEvents(async (e) => {
      if (e.type !== 'tokenRotated') return;
      overrideTokenRef.current = e.accessToken;
      const old = clientRef.current;
      clientRef.current = null;
      if (old) {
        try { await old.deactivate(); } catch { /* ignore */ }
      }
      // Only reconnect if E2EE is still ready (i.e., we're still logged in).
      if (useChatStore.getState().selfUserId) {
        connect().catch((err) =>
          console.warn('[chat-ws] reconnect after token rotation failed', err),
        );
      }
    });
    return unsub;
  }, [connect]);

  return <>{children}</>;
}
