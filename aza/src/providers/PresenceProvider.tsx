import 'fast-text-encoding';
import React, { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { Client } from '@stomp/stompjs';
import * as SecureStore from 'expo-secure-store';
import { BASE_URL, TOKEN_KEY, getValidAccessToken } from '../services/api';
import { useAuth } from './AuthProvider';
import { subscribeAuthEvents } from './authEvents';
import { usePresenceStore } from '../store/presenceStore';

const HEARTBEAT_INTERVAL_MS = 30_000;

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const { userToken } = useAuth();
  const clientRef = useRef<Client | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const setOnline = usePresenceStore((s) => s.setOnline);
  const setOffline = usePresenceStore((s) => s.setOffline);

  useEffect(() => {
    if (!userToken) {
      // Disconnect when logged out
      if (clientRef.current) {
        clientRef.current.deactivate({ force: true }).catch(() => {});
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
        // Re-read the bearer before every connect attempt, refreshing it if
        // it has lapsed. connectHeaders alone pins the token captured at
        // client creation, so once it expired every retry re-sent the same
        // dead credential and presence never came back.
        beforeConnect: async () => {
          const fresh = await getValidAccessToken();
          if (fresh) client.connectHeaders = { Authorization: `Bearer ${fresh}` };
        },
        onConnect: () => {
          // Send initial heartbeat so the server marks us online immediately.
          client.publish({ destination: '/app/heartbeat' });

          // Per-user presence queue: the server fans events out only for
          // people we share a chat or contact relationship with.
          client.subscribe('/user/queue/presence', (frame) => {
            try {
              const msg = JSON.parse(frame.body);
              const type: string = msg?.type ?? '';
              const userId: string = msg?.payload?.userId ?? '';
              if (!userId) return;
              if (type === 'user.online') {
                usePresenceStore.getState().setOnline(userId);
              } else if (type === 'user.offline') {
                usePresenceStore.getState().setOffline(userId);
              }
            } catch {
              // Presence frames are best-effort; ignore parse errors.
            }
          });

          // Refresh presence every 30 seconds. onConnect fires again on every
          // reconnect, so clear any interval from the previous session first
          // rather than stacking a new one beside it.
          if (heartbeatRef.current) clearInterval(heartbeatRef.current);
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
        clientRef.current.deactivate({ force: true }).catch(() => {});
        clientRef.current = null;
      }
    };
  }, [userToken]);

  // Tie presence to the app lifecycle: going to the background closes the
  // socket so the server marks us offline right away (instead of waiting for
  // the heartbeat TTL to lapse), and returning to the foreground reconnects
  // and heartbeats immediately so we show online without the 30s wait.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      const client = clientRef.current;
      if (!client) return;
      if (state === 'active') {
        if (client.connected) {
          client.publish({ destination: '/app/heartbeat' });
        } else {
          // Not `!client.active`: a socket the OS tore down while we were
          // suspended can linger half-open with no close event, which leaves
          // the client either ACTIVE-but-dead or wedged mid-deactivation.
          // Discard whatever is left before reconnecting.
          client
            .deactivate({ force: true })
            .catch(() => {})
            .then(() => client.activate());
        }
      } else if (state === 'background') {
        // 'inactive' (iOS control centre, Face ID, etc.) is transient — only
        // a real background transition should end the presence session.
        // force: true so we don't wait on a DISCONNECT receipt the OS will
        // never let us receive — an unresolved deactivation wedges the client
        // in DEACTIVATING and it never reconnects for the rest of the run.
        client.deactivate({ force: true }).catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

  // When the access token rotates, drop the current STOMP client so the
  // next reconnect uses the fresh bearer. Without this, the heartbeat
  // would silently keep talking to the broker with the stale token until
  // it got booted.
  useEffect(() => {
    const unsub = subscribeAuthEvents((e) => {
      if (e.type !== 'tokenRotated') return;
      const c = clientRef.current;
      if (!c) return;
      // Bounce the same client: beforeConnect picks up the fresh token on
      // the way back in. The old version nulled clientRef and waited for the
      // outer effect to rebuild — but that effect only re-runs when
      // userToken changes, which a rotation doesn't touch, so presence
      // stayed dead (and the AppState handler, seeing no client, could
      // never revive it) until the app restarted.
      c.deactivate({ force: true })
        .catch(() => {})
        .then(() => c.activate());
    });
    return unsub;
  }, []);

  return <>{children}</>;
}
