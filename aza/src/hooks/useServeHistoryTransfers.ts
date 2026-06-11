/**
 * Old-device side of history transfer: while the chat list is on screen, poll
 * for history requests from the user's other devices and prompt to approve.
 * On approval this device re-encrypts its local history to the requesting
 * device's identity key and uploads it.
 */
import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import {
  getPendingHistoryTransfers,
  declineHistoryTransfer,
  serveHistoryTransfer,
} from '../services/historySync';
import { useChatStore } from '../store/chatStore';

const POLL_MS = 20_000;

export function useServeHistoryTransfers() {
  const isFocused = useIsFocused();
  const selfDeviceId = useChatStore((s) => s.selfDeviceId);
  // Don't re-prompt for a transfer the user already answered or is serving.
  const handledRef = useRef(new Set<string>());
  const busyRef = useRef(false);

  useEffect(() => {
    if (!isFocused || !selfDeviceId) return;
    let cancelled = false;

    const check = async () => {
      if (busyRef.current) return;
      try {
        const { data } = await getPendingHistoryTransfers(selfDeviceId);
        const pending: any[] = data?.data ?? [];
        const next = pending.find((t) => !handledRef.current.has(t.id));
        if (!next || cancelled) return;
        handledRef.current.add(next.id);

        Alert.alert(
          'Sync messages to your new device?',
          'Another device on your account is asking for your chat history. ' +
            'It will be encrypted so only that device can read it.',
          [
            {
              text: 'Decline',
              style: 'cancel',
              onPress: () => { declineHistoryTransfer(next.id).catch(() => {}); },
            },
            {
              text: 'Send history',
              onPress: async () => {
                busyRef.current = true;
                try {
                  await serveHistoryTransfer(next.id, next.requestingDeviceId);
                  Alert.alert('Done', 'Your chat history was sent to your other device.');
                } catch (err: any) {
                  Alert.alert('Sync failed', err?.message ?? 'Could not send chat history.');
                } finally {
                  busyRef.current = false;
                }
              },
            },
          ],
        );
      } catch {
        // Network hiccup — next poll retries.
      }
    };

    check();
    const interval = setInterval(check, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isFocused, selfDeviceId]);
}
