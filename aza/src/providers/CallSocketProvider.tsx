import 'fast-text-encoding';
import React, { useEffect, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import * as SecureStore from 'expo-secure-store';
import { BASE_URL, TOKEN_KEY } from '../services/api';
import { useAuth } from './AuthProvider';
import { subscribeAuthEvents } from './authEvents';
import { useCallStore } from '../store/callStore';

export function CallSocketProvider({ children }: { children: React.ReactNode }) {
  const { userToken } = useAuth();
  const clientRef = useRef<Client | null>(null);
  const overrideTokenRef = useRef<string | null>(null);

  // Keep the latest store handler on a ref so the STOMP onConnect closure
  // doesn't go stale across re-renders.
  const handleCallSignal = useCallStore((s) => s.handleCallSignal);
  const handleCallSignalRef = useRef(handleCallSignal);
  handleCallSignalRef.current = handleCallSignal;

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
      reconnectDelay: 5000,
      heartbeatIncoming: 10_000,
      heartbeatOutgoing: 10_000,
      forceBinaryWSFrames: true,
      appendMissingNULLonIncoming: true,
      onConnect: () => {
        client.subscribe('/user/queue/calls', (message) => {
          try {
            const event = JSON.parse(message.body);
            handleCallSignalRef.current(event.type, event.payload);
          } catch (err) {
            console.error('Error parsing call socket message:', err);
          }
        });
      },
      onStompError: (error) => {
        console.error('STOMP error in call socket:', error);
      },
    });

    client.activate();
    clientRef.current = client;
  }, []);

  useEffect(() => {
    if (!userToken) {
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
    };
  }, [userToken, connect]);

  // After axios refreshes the access token, tear down the old STOMP client
  // and reconnect with the new bearer. Without the reconnect, the broker
  // would eventually drop the stale-token connection and the call socket
  // would stay dead until the user logs out and back in.
  useEffect(() => {
    const unsub = subscribeAuthEvents(async (e) => {
      if (e.type !== 'tokenRotated') return;
      overrideTokenRef.current = e.accessToken;
      const old = clientRef.current;
      clientRef.current = null;
      if (old) {
        try { await old.deactivate(); } catch { /* ignore */ }
      }
      connect().catch((err) =>
        console.warn('[call-ws] reconnect after token rotation failed', err),
      );
    });
    return unsub;
  }, [connect]);

  return <>{children}</>;
}
