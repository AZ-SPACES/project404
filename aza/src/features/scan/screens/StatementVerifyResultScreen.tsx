import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';
import { BackButton } from '../../../components/ui/BackButton';
import { verifyStatement } from '../../../services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'StatementVerifyResult'>;

interface VerifyData {
  verified: boolean;
  accountHolderName?: string;
  accountNumber?: string;
  periodStart?: string;
  periodEnd?: string;
  transactionCount?: number;
  openingBalance?: number;
  totalCredits?: number;
  totalDebits?: number;
  closingBalance?: number;
  generatedAt?: string;
  currency?: string;
  issuedBy?: string;
}

function fmtAmount(n?: number, currency = 'GHS') {
  if (n == null) return '—';
  return `${currency} ${n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCode(raw: string) {
  const clean = raw.replace(/-/g, '').toUpperCase();
  if (clean.length < 16) return clean;
  return `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}`;
}

const StatementVerifyResultScreen = ({ route, navigation }: Props) => {
  const { code } = route.params;
  const { colors: Colors } = useAppTheme();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [data, setData] = useState<VerifyData | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await verifyStatement(code);
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
  }, [code]);

  useEffect(() => {
    load();
  }, [load]);

  const verified = !!data?.verified;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={[Typography.h2, { color: Colors.textPrimary, marginLeft: Spacing.md }]}>
          Statement Verification
        </Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={[Typography.body, { color: Colors.textSecondary, marginTop: Spacing.md }]}>
            Verifying statement…
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
                {verified ? 'Statement verified' : 'Verification failed'}
              </Text>
              <Text style={[styles.bannerSubtitle, { color: Colors.textSecondary }]}>
                {verified
                  ? 'This document was issued by AZA Financial Technology Ltd and has not been altered.'
                  : 'This code does not match any statement issued by AZA. The document may have been altered or the code may be incorrect.'}
              </Text>
            </View>
          </View>

          {verified && data && (
            <>
              <Text style={styles.sectionLabel}>ACCOUNT INFORMATION</Text>
              <View style={styles.card}>
                <Row label="Account Holder" value={data.accountHolderName} Colors={Colors} />
                <Row label="Account Number" value={data.accountNumber} Colors={Colors} />
                <Row label="Statement Period" value={`${data.periodStart ?? '—'} – ${data.periodEnd ?? '—'}`} Colors={Colors} />
                <Row label="Transactions" value={String(data.transactionCount ?? '—')} Colors={Colors} last />
              </View>

              <Text style={styles.sectionLabel}>BALANCE SUMMARY ({data.currency ?? 'GHS'})</Text>
              <View style={styles.card}>
                <Row label="Opening Balance" value={fmtAmount(data.openingBalance, data.currency)} Colors={Colors} />
                <Row label="Total Credits" value={`+ ${fmtAmount(data.totalCredits, data.currency)}`} valueColor={Colors.success} Colors={Colors} />
                <Row label="Total Debits" value={`− ${fmtAmount(data.totalDebits, data.currency)}`} valueColor={Colors.error} Colors={Colors} />
                <Row label="Closing Balance" value={fmtAmount(data.closingBalance, data.currency)} valueColor={Colors.primary} Colors={Colors} last />
              </View>

              <Text style={styles.sectionLabel}>DOCUMENT DETAILS</Text>
              <View style={styles.card}>
                <Row label="Generated On" value={data.generatedAt} Colors={Colors} />
                <Row label="Issued By" value={data.issuedBy ?? 'AZA Financial Technology Ltd'} Colors={Colors} last />
              </View>
            </>
          )}

          {/* Verification code */}
          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>VERIFICATION CODE</Text>
            <Text style={[styles.codeValue, { color: Colors.primary }]}>{formatCode(code)}</Text>
          </View>
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
    codeBox: {
      marginTop: Spacing.xl,
      backgroundColor: Colors.surface,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: Colors.border,
      padding: Spacing.lg,
      alignItems: 'center',
    },
    codeLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: Colors.textSecondary },
    codeValue: { fontSize: 18, fontWeight: '700', letterSpacing: 2, marginTop: 6, fontVariant: ['tabular-nums'] },
  });
}

export default StatementVerifyResultScreen;
