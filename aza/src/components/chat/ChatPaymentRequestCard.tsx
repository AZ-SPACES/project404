import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@react-native-vector-icons/feather';
import * as Haptics from 'expo-haptics';
import { useAppTheme, Typography, Spacing, ThemeColors } from '../../theme';
import {
  getChatPaymentRequest,
  approveChatPaymentRequest,
  declineChatPaymentRequest,
  cancelChatPaymentRequest,
  ChatPaymentRequest,
} from '../../services/api';
import { extractErrorMessage } from '../../utils/errorUtils';

type Props = {
  requestId: string;
  /** True when the viewer sent the request rather than being asked. */
  isRequester: boolean;
  /** Fallback amount from the sealed card, shown until the server answers. */
  fallbackAmount?: number;
  fallbackNote?: string | null;
};

const STATUS_COPY: Record<ChatPaymentRequest['status'], string> = {
  PENDING: 'Pending',
  PAID: 'Paid',
  DECLINED: 'Declined',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
};

/**
 * A request for money inside a thread.
 *
 * The card in the conversation is just a sealed pointer — the amount and the status live
 * on the server, so both sides read the same answer instead of inferring it from receipt
 * messages that may never arrive. Messages are immutable once sealed, which is why the
 * status is fetched rather than written into the card.
 */
export function ChatPaymentRequestCard({ requestId, isRequester, fallbackAmount, fallbackNote }: Props) {
  const { colors: Colors } = useAppTheme();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const [request, setRequest] = useState<ChatPaymentRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [askingPasscode, setAskingPasscode] = useState(false);
  const [passcode, setPasscode] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await getChatPaymentRequest(requestId);
      setRequest(res.data?.data ?? res.data);
      setError(null);
    } catch (e) {
      setError(extractErrorMessage(e, 'Could not load this request.'));
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => { load(); }, [load]);

  const run = async (fn: () => Promise<any>, failure: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fn();
      setRequest(res.data?.data ?? res.data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      setError(extractErrorMessage(e, failure));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      // Reload so the card shows what actually happened rather than a stale ask.
      load();
    } finally {
      setBusy(false);
    }
  };

  const pay = async () => {
    if (passcode.length !== 4) return;
    const entered = passcode;
    setPasscode('');
    setAskingPasscode(false);
    await run(() => approveChatPaymentRequest(requestId, entered), 'Could not pay this request.');
  };

  const amount = request?.amount ?? fallbackAmount ?? 0;
  const note = request?.note ?? fallbackNote ?? null;
  const status = request?.status ?? 'PENDING';
  const actionable = status === 'PENDING' && !busy;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.icon}>
          <Feather name="arrow-down-left" size={16} color={Colors.secondary} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.label}>
            {isRequester ? 'You requested' : 'Requested from you'}
          </Text>
          <Text style={styles.amount}>GH₵ {Number(amount).toFixed(2)}</Text>
        </View>
        {loading ? (
          <ActivityIndicator size="small" color={Colors.textSecondary} />
        ) : (
          <Text
            style={[
              styles.status,
              status === 'PAID' && { color: Colors.success },
              (status === 'DECLINED' || status === 'EXPIRED') && { color: Colors.error },
            ]}
          >
            {STATUS_COPY[status]}
          </Text>
        )}
      </View>

      {!!note && <Text style={styles.note} numberOfLines={2}>{note}</Text>}

      {/* The payer's side */}
      {!isRequester && actionable && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.action, styles.payAction]}
            onPress={() => { Haptics.selectionAsync().catch(() => {}); setAskingPasscode(true); }}
          >
            <Text style={styles.payText}>Pay</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.action}
            onPress={() => run(() => declineChatPaymentRequest(requestId), 'Could not decline.')}
          >
            <Text style={styles.declineText}>Decline</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* The requester's side */}
      {isRequester && actionable && (
        <TouchableOpacity
          style={styles.cancelRow}
          onPress={() => run(() => cancelChatPaymentRequest(requestId), 'Could not cancel.')}
        >
          <Text style={styles.declineText}>Cancel request</Text>
        </TouchableOpacity>
      )}

      {!!error && <Text style={styles.error}>{error}</Text>}

      {/* Paying is a debit, so it takes the passcode like every other one. */}
      <Modal visible={askingPasscode} transparent animationType="fade" onRequestClose={() => setAskingPasscode(false)}>
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Pay GH₵ {Number(amount).toFixed(2)}</Text>
            <Text style={styles.modalHint}>Enter your passcode to confirm.</Text>
            <TextInput
              style={styles.passcodeInput}
              value={passcode}
              onChangeText={(t) => setPasscode(t.replace(/[^0-9]/g, '').slice(0, 4))}
              placeholder="••••"
              placeholderTextColor={Colors.textSecondary}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.action}
                onPress={() => { setPasscode(''); setAskingPasscode(false); }}
              >
                <Text style={styles.declineText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.action, styles.payAction, passcode.length !== 4 && styles.actionDisabled]}
                onPress={pay}
                disabled={passcode.length !== 4}
              >
                <Text style={styles.payText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const createStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    card: {
      minWidth: 220,
      gap: Spacing.xs,
      paddingVertical: 4,
    },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    icon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: Colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: { ...Typography.caption, color: Colors.textSecondary },
    amount: { ...Typography.bodyLg, fontWeight: '700', color: Colors.textPrimary },
    status: { ...Typography.caption, fontWeight: '700', color: Colors.textSecondary },
    note: { ...Typography.caption, color: Colors.textSecondary },
    actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
    cancelRow: { marginTop: Spacing.xs, alignItems: 'flex-start' },
    action: {
      paddingVertical: 8,
      paddingHorizontal: Spacing.md,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    actionDisabled: { opacity: 0.5 },
    payAction: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    payText: { ...Typography.button, fontSize: 14, color: Colors.secondary },
    declineText: { ...Typography.button, fontSize: 14, color: Colors.textSecondary },
    error: { ...Typography.caption, color: Colors.error },
    modalBackdrop: {
      flex: 1,
      backgroundColor: '#00000088',
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.lg,
    },
    modalCard: {
      width: '100%',
      maxWidth: 340,
      gap: Spacing.sm,
      padding: Spacing.lg,
      borderRadius: 18,
      backgroundColor: Colors.background,
    },
    modalTitle: { ...Typography.h3, color: Colors.textPrimary },
    modalHint: { ...Typography.caption, color: Colors.textSecondary },
    passcodeInput: {
      backgroundColor: Colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Colors.border,
      paddingVertical: Spacing.sm + 4,
      ...Typography.h3,
      letterSpacing: 10,
      textAlign: 'center',
      color: Colors.textPrimary,
    },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm },
  });
