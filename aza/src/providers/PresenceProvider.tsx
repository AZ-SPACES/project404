import 'fast-text-encoding';
import React, { useEffect, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import * as SecureStore from 'expo-secure-store';
import { BASE_URL, TOKEN_KEY } from '../services/api';
import { useAuth } from './AuthProvider';
import { subscribeAuthEvents } from './authEvents';

const HEARTBEAT_INTERVAL_MS = 30_000;

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const { userToken } = useAuth();
  const clientRef = useRef<Client | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!userToken) {
      // Disconnect when logged out
      if (clientRef.current) {
        clientRef.current.deactivate();
        clientRef.current = null;
      }
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
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
        reconnectDelay: 15_000,
        heartbeatIncoming: 10_000,
        heartbeatOutgoing: 10_000,
        forceBinaryWSFrames: true,
        appendMissingNULLonIncoming: true,
        onConnect: () => {
          // Send initial heartbeat
          client.publish({ destination: '/app/heartbeat' });

          // Refresh presence every 30 seconds
          heartbeatRef.current = setInterval(() => {
            if (client.connected) {
              client.publish({ destination: '/app/heartbeat' });
            }
          }, HEARTBEAT_INTERVAL_MS);
        },
        onDisconnect: () => {
          if (heartbeatRef.current) {
            clearInterval(heartbeatRef.current);
            heartbeatRef.current = null;
          }
        },
        onStompError: () => {
          // Reconnect is handled automatically by the client
        },
      });

      client.activate();
      clientRef.current = client;
    };

    connect();

    return () => {
      cancelled = true;
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      if (clientRef.current) {
        clientRef.current.deactivate();
        clientRef.current = null;
      }
    };
  }, [userToken]);

  // When the access token rotates, drop the current STOMP client so the
  // next reconnect uses the fresh bearer. Without this, the heartbeat
  // would silently keep talking to the broker with the stale token until
  // it got booted.
  useEffect(() => {
    const unsub = subscribeAuthEvents((e) => {
      if (e.type !== 'tokenRotated') return;
      const c = clientRef.current;
      if (!c) return;
      clientRef.current = null;
      c.deactivate().catch(() => {});
      // The outer effect will re-run on the next state change and rebuild
      // a client; presence's heartbeat cadence is generous enough to absorb
      // the brief gap.
    });
    return unsub;
  }, []);

  return <>{children}</>;
}
