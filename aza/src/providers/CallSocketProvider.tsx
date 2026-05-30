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
  const handleCallSignal = useCallStore(state => state.handleCallSignal);

  useEffect(() => {
    if (!userToken) {
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
        reconnectDelay: 5000,
        heartbeatIncoming: 10_000,
        heartbeatOutgoing: 10_000,
        forceBinaryWSFrames: true,
        appendMissingNULLonIncoming: true,
        onConnect: () => {
          client.subscribe('/user/queue/calls', (message) => {
            try {
              const event = JSON.parse(message.body);
              handleCallSignal(event.type, event.payload);
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
    };

    connect();

    return () => {
      cancelled = true;
      if (clientRef.current) {
        clientRef.current.deactivate();
        clientRef.current = null;
      }
    };
  }, [userToken, handleCallSignal]);

  useEffect(() => {
    const unsub = subscribeAuthEvents((e) => {
      if (e.type !== 'tokenRotated') return;
      const c = clientRef.current;
      if (!c) return;
      clientRef.current = null;
      c.deactivate().catch(() => {});
    });
    return unsub;
  }, []);

  return <>{children}</>;
}
