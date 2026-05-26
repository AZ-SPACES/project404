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
import { Client } from '@stomp/stompjs';
import * as SecureStore from 'expo-secure-store';

import { BASE_URL, TOKEN_KEY } from '../services/api';
import { useAuth } from './AuthProvider';
import { useE2EE } from './E2EEProvider';
import { useChatStore } from '../store/chatStore';

export function ChatSocketProvider({ children }: { children: React.ReactNode }) {
  const { userToken } = useAuth();
  const { identity, ready } = useE2EE();
  const clientRef = useRef<Client | null>(null);

  // Track the most recent send function on a ref so the STOMP onConnect
  // closure always sees the up-to-date store action without re-mounting.
  const onEvent = useChatStore((s) => s.handleSocketEvent);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!userToken || !ready || !identity) {
      if (clientRef.current) {
        clientRef.current.deactivate();
        clientRef.current = null;
      }
      return;
    }

    let cancelled = false;
    const connect = async () => {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!token || cancelled) return;

      const wsUrl =
        BASE_URL.replace('https://', 'wss://').replace('http://', 'ws://').replace(/\/$/, '') +
        '/ws/websocket';

      const client = new Client({
        brokerURL: wsUrl,
        connectHeaders: { Authorization: `Bearer ${token}` },
        reconnectDelay: 5_000,
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
    };

    connect();
    return () => {
      cancelled = true;
      if (clientRef.current) {
        clientRef.current.deactivate();
        clientRef.current = null;
      }
      useChatStore.getState().setStompClient(null);
    };
  }, [userToken, ready, identity]);

  return <>{children}</>;
}
