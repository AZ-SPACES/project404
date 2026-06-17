import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';
import { BackButton } from '../../../components/ui/BackButton';
import { verifyPayment } from '../../../services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'PaymentVerifyResult'>;

interface VerifyData {
  verified: boolean;
  senderName?: string;
  recipientName?: string;
  amount?: number;
  currency?: string;
  status?: string;
  completedAt?: string;
  reference?: string;
  issuedBy?: string;
}

function fmtAmount(n?: number, currency = 'GHS') {
  if (n == null) return '—';
  return `${currency} ${n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const PaymentVerifyResultScreen = ({ route, navigation }: Props) => {
  const { ref, sig } = route.params;
  const { colors: Colors } = useAppTheme();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [data, setData] = useState<VerifyData | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await verifyPayment(ref, sig);
      const payload: VerifyData = res?.data?.data ?? { verified: false };
      setData(payload);
      await Haptics.notificationAsync(
        payload.verified
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning,
      );
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [ref, sig]);

  useEffect(() => {
    load();
  }, [load]);

  const verified = !!data?.verified;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={[Typography.h2, { color: Colors.textPrimary, marginLeft: Spacing.md }]}>
          Payment Verification
        </Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={[Typography.body, { color: Colors.textSecondary, marginTop: Spacing.md }]}>
            Verifying payment…
          </Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={48} color={Colors.textSecondary} />
          <Text style={[Typography.bodyLg, { color: Colors.textPrimary, marginTop: Spacing.md, fontWeight: '600' }]}>
            Couldn’t verify
          </Text>
          <Text style={[Typography.body, { color: Colors.textSecondary, marginTop: Spacing.xs, textAlign: 'center', paddingHorizontal: Spacing.xl }]}>
            We couldn’t reach the verification service. Check your connection and try again.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Result banner */}
          <View style={[styles.banner, { backgroundColor: verified ? Colors.success + '22' : Colors.error + '22', borderColor: verified ? Colors.success : Colors.error }]}>
            <View style={[styles.bannerIcon, { backgroundColor: verified ? Colors.success : Colors.error }]}>
              <Ionicons name={verified ? 'checkmark' : 'close'} size={22} color={Colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.bannerTitle, { color: verified ? Colors.success : Colors.error }]}>
                {verified ? 'Payment verified' : 'Verification failed'}
              </Text>
              <Text style={[styles.bannerSubtitle, { color: Colors.textSecondary }]}>
                {verified
                  ? 'This payment was completed on AZA and the proof has not been altered.'
                  : 'This code does not match any completed AZA payment. The proof may have been altered or the payment is not complete.'}
              </Text>
            </View>
          </View>

          {verified && data && (
            <>
              <Text style={styles.amount}>{fmtAmount(data.amount, data.currency)}</Text>

              <Text style={styles.sectionLabel}>PAYMENT DETAILS</Text>
              <View style={styles.card}>
                <Row label="From" value={data.senderName} Colors={Colors} />
                <Row label="To" value={data.recipientName} Colors={Colors} />
                <Row label="Status" value={data.status} valueColor={Colors.success} Colors={Colors} />
                <Row label="Completed" value={data.completedAt} Colors={Colors} last />
              </View>

              <Text style={styles.sectionLabel}>DOCUMENT DETAILS</Text>
              <View style={styles.card}>
                <Row label="Reference" value={data.reference} Colors={Colors} />
                <Row label="Issued By" value={data.issuedBy ?? 'AZA Financial Technology Ltd'} Colors={Colors} last />
              </View>
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

function Row({
  label,
  value,
  valueColor,
  last,
  Colors,
}: {
  label: string;
  value?: string | undefined;
  valueColor?: string | undefined;
  last?: boolean | undefined;
  Colors: ThemeColors;
}) {
  return (
    <View style={[rowStyles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border }]}>
      <Text style={[rowStyles.label, { color: Colors.textSecondary }]}>{label}</Text>
      <Text style={[rowStyles.value, { color: valueColor ?? Colors.textPrimary }]} numberOfLines={2}>
        {value ?? '—'}
      </Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  label: { fontSize: 14, flexShrink: 1 },
  value: { fontSize: 14, fontWeight: '600', textAlign: 'right', flexShrink: 1 },
});

function createStyles(Colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.md,
    },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
    content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl * 2 },
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: Spacing.lg,
      borderRadius: Radius.md,
      borderWidth: 1,
      marginBottom: Spacing.xl,
    },
    bannerIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    bannerTitle: { fontSize: 16, fontWeight: '700' },
    bannerSubtitle: { fontSize: 13, marginTop: 4, lineHeight: 18 },
    amount: {
      fontSize: 34,
      fontWeight: '800',
      color: Colors.textPrimary,
      textAlign: 'center',
      marginBottom: Spacing.md,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1,
      color: Colors.textSecondary,
      marginBottom: Spacing.sm,
      marginTop: Spacing.md,
    },
    card: {
      backgroundColor: Colors.surface,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: Colors.border,
      paddingHorizontal: Spacing.lg,
    },
  });
}

export default PaymentVerifyResultScreen;
