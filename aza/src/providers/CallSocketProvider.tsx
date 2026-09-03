import 'fast-text-encoding';
import React, { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { Client } from '@stomp/stompjs';
import * as SecureStore from 'expo-secure-store';
import { BASE_URL, TOKEN_KEY } from '../services/api';
import { useAuth } from './AuthProvider';
import { subscribeAuthEvents } from './authEvents';
import { useCallStore } from '../store/callStore';

/**
 * How long a foreground heartbeat has to come back before we treat the socket
 * as dead. Generous next to a measured p99 round trip of about 1.2s, so a slow
 * network is never mistaken for a dead connection.
 */
const HEARTBEAT_ACK_TIMEOUT_MS = 4_000;

export function CallSocketProvider({ children }: { children: React.ReactNode }) {
  const { userToken } = useAuth();
  const clientRef = useRef<Client | null>(null);
  const overrideTokenRef = useRef<string | null>(null);
  // Timestamp of the last /user/queue/heartbeat ack, used to tell a live socket
  // from one that only claims to be live. See the AppState effect below.
  const heartbeatAckRef = useRef(0);

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
        // The server answers every /app/heartbeat here. Nothing needs the
        // contents — the arrival is the point, because it is proof the round
        // trip works. See the AppState effect below.
        client.subscribe('/user/queue/heartbeat', () => {
          heartbeatAckRef.current = Date.now();
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
        clientRef.current.deactivate({ force: true }).catch(() => {});
        clientRef.current = null;
      }
      return;
    }

    connect();

    return () => {
      if (clientRef.current) {
        clientRef.current.deactivate({ force: true }).catch(() => {});
        clientRef.current = null;
      }
    };
  }, [userToken, connect]);

  // Close the socket on background so presence goes offline promptly — but
  // never mid-call: signaling (hangup, renegotiation) must survive the user
  // locking the screen or switching apps during an active call.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      const client = clientRef.current;
      if (!client) return;
      if (state === 'active') {
        // Never disturb a call in progress: this socket is carrying its
        // signaling, and a reconnect mid-call drops hangup and renegotiation.
        if (useCallStore.getState().activeCall) return;
        // Not `!client.active`: a socket the OS tore down while we were
        // suspended can linger half-open with no close event, which leaves the
        // client either ACTIVE-but-dead or wedged mid-deactivation.
        if (!client.connected) {
          client
            .deactivate({ force: true })
            .catch(() => {})
            .then(() => client.activate());
          return;
        }
        // `connected` is set from the CONNECTED frame and cleared by a close
        // event, so a socket the OS killed while we were suspended keeps
        // reporting a live session until an incoming heartbeat is finally
        // missed. Chat survives that window because its events are durable and
        // replayed on reconnect; call frames are neither, so a call arriving
        // in it is lost outright rather than late.
        //
        // Probe rather than trust. /app/heartbeat is acknowledged on
        // /user/queue/heartbeat, so a reply proves the round trip and silence
        // means the socket is dead however healthy it claims to be. The probe
        // also refreshes the server's presence key, which matters on its own:
        // an incoming call reaches a callee the server believes is offline as
        // a push notification and nothing else.
        const probedAt = Date.now();
        client.publish({ destination: '/app/heartbeat' });
        setTimeout(() => {
          if (clientRef.current !== client) return;
          if (heartbeatAckRef.current >= probedAt) return;
          // A call that started while we were waiting is proof enough.
          if (useCallStore.getState().activeCall) return;
          console.warn('[call-ws] heartbeat unacknowledged — rebuilding the socket');
          client
            .deactivate({ force: true })
            .catch(() => {})
            .then(() => client.activate());
        }, HEARTBEAT_ACK_TIMEOUT_MS);
      } else if (state === 'background') {
        if (useCallStore.getState().activeCall) return;
        // force: true — a graceful deactivate waits for a DISCONNECT receipt
        // the OS suspends us before we can receive, and the client would stay
        // stuck in DEACTIVATING (never reconnecting) for the rest of the run.
        client.deactivate({ force: true }).catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

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
        try { await old.deactivate({ force: true }); } catch { /* ignore */ }
      }
      connect().catch((err) =>
        console.warn('[call-ws] reconnect after token rotation failed', err),
      );
    });
    return unsub;
  }, [connect]);

  return <>{children}</>;
}
