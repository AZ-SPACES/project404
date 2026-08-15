import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Feather } from '@react-native-vector-icons/feather';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppTheme, Typography, Spacing, ThemeColors } from '../../../theme';
import type { RootStackParamList } from '../../../navigation/types';
import { BackButton } from '../../../components/ui/BackButton';
import Button from '../../../components/ui/Button';
import { getBillPayment, BillPayment } from '../../../services/api';
import { extractErrorMessage } from '../../../utils/errorUtils';
import { useToast } from '../../../providers/ToastProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'BillReceipt'>;

/** How long to keep re-asking while the biller hasn't confirmed. */
const POLL_MS = 5000;

export default function BillReceiptScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const { colors: Colors } = useAppTheme();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const { showToast } = useToast();

  const [payment, setPayment] = useState<BillPayment | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await getBillPayment(id);
      setPayment(res.data?.data ?? res.data);
    } catch (e) {
      setError(extractErrorMessage(e, 'Could not load this payment.'));
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // A pending payment is waiting on the biller, and the reconciliation sweep settles it
  // server-side. Poll while it's in that state so the token appears without a pull.
  useEffect(() => {
    if (payment?.status !== 'PENDING') return;
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [payment?.status, load]);

  if (!payment) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={Colors.primary} />}
      </SafeAreaView>
    );
  }

  const tone =
    payment.status === 'COMPLETED' ? Colors.success
      : payment.status === 'PENDING' ? Colors.warning
        : Colors.error;

  const headline =
    payment.status === 'COMPLETED' ? 'Paid'
      : payment.status === 'PENDING' ? 'Confirming with the biller'
        : payment.status === 'REFUNDED' ? 'Refunded'
          : 'Needs attention';

  const body =
    payment.status === 'COMPLETED' ? `${payment.billerName} has been paid.`
      : payment.status === 'PENDING'
        ? 'The money has left your wallet and we’re waiting on confirmation. This usually takes a moment.'
        : payment.status === 'REFUNDED'
          ? `${payment.billerName} couldn’t be paid, so the money is back in your wallet.`
          : 'We couldn’t confirm this one. Support has it and will sort it out.';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Receipt</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.badge, { backgroundColor: tone + '22' }]}>
          <Feather
            name={payment.status === 'COMPLETED' ? 'check' : payment.status === 'PENDING' ? 'clock' : 'alert-circle'}
            size={30}
            color={tone}
          />
        </View>

        <Text style={styles.amount}>GH₵ {Number(payment.amount).toFixed(2)}</Text>
        <Text style={[styles.headline, { color: tone }]}>{headline}</Text>
        <Text style={styles.body}>{body}</Text>

        {/* The token is the whole point of the payment for a prepaid customer. */}
        {!!payment.token && (
          <TouchableOpacity
            style={styles.tokenCard}
            onPress={async () => {
              await Clipboard.setStringAsync(payment.token!).catch(() => {});
              showToast('Token copied', 'success');
            }}
          >
            <Text style={styles.tokenLabel}>Token — tap to copy</Text>
            <Text style={styles.token} selectable>{payment.token}</Text>
          </TouchableOpacity>
        )}

        <View style={styles.detailCard}>
          <Row label="Biller" value={payment.billerName} styles={styles} />
          <Row label="Account" value={payment.accountNumber} styles={styles} />
          {!!payment.accountName && <Row label="Name" value={payment.accountName} styles={styles} />}
          {!!payment.providerReference && (
            <Row label="Reference" value={payment.providerReference} styles={styles} />
          )}
          {!!payment.failureReason && (
            <Row label="Reason" value={payment.failureReason} styles={styles} />
          )}
        </View>

        <Button
          title="Done"
          onPress={() => navigation.navigate('Bills')}
          backgroundColor={Colors.primary}
          textColor={Colors.secondary}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const createStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    headerTitle: { ...Typography.h2, color: Colors.textPrimary },
    content: { padding: Spacing.md, alignItems: 'stretch', gap: Spacing.sm },
    badge: {
      alignSelf: 'center',
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.sm,
    },
    amount: { ...Typography.h1, color: Colors.textPrimary, textAlign: 'center' },
    headline: { ...Typography.bodyLg, fontWeight: '700', textAlign: 'center' },
    body: {
      ...Typography.body,
      color: Colors.textSecondary,
      textAlign: 'center',
      marginBottom: Spacing.md,
    },
    tokenCard: {
      padding: Spacing.md,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: Colors.primary,
      backgroundColor: Colors.primary + '12',
      gap: 4,
      marginBottom: Spacing.sm,
    },
    tokenLabel: { ...Typography.caption, color: Colors.textSecondary },
    token: { ...Typography.h3, letterSpacing: 2, color: Colors.textPrimary },
    detailCard: {
      padding: Spacing.md,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.surface,
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    row: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.md },
    rowLabel: { ...Typography.caption, color: Colors.textSecondary },
    rowValue: { ...Typography.body, color: Colors.textPrimary, flexShrink: 1, textAlign: 'right' },
    error: { ...Typography.body, color: Colors.error, textAlign: 'center' },
  });
