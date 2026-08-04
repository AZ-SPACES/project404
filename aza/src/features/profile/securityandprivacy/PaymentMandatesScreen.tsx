import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Image, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { Feather } from '@react-native-vector-icons/feather';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';
import { BackButton } from '../../../components/ui/BackButton';
import { getMandates, pauseMandate, resumeMandate, cancelMandate } from '../../../services/api';
import { queryKeys } from '../../../lib/queryKeys';

interface Mandate {
  id: string;
  merchantId: string;
  merchantName: string;
  merchantLogoUrl?: string;
  perChargeLimit: number;
  periodLimit?: number;
  periodType?: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  reference: string;
  status: 'PENDING_APPROVAL' | 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'EXPIRED';
  sourceType: 'MINI_APP' | 'OAUTH';
  sourceId: string;
  lastChargedAt?: string;
  createdAt: string;
}

const STATUS_LABEL: Record<Mandate['status'], string> = {
  PENDING_APPROVAL: 'Pending',
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
};

function fmtGHS(n: number) {
  return `GH₵ ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function cadenceLabel(periodType?: string) {
  switch (periodType) {
    case 'DAILY': return 'day';
    case 'WEEKLY': return 'week';
    case 'MONTHLY': return 'month';
    default: return null;
  }
}

export function PaymentMandatesScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation();
  const qc = useQueryClient();

  const { data: mandates = [], isLoading } = useQuery<Mandate[]>({
    queryKey: queryKeys.mandates(),
    queryFn: () => getMandates().then(r => r.data?.data ?? []),
    staleTime: 15_000,
  });

  const [actingId, setActingId] = useState<string | null>(null);

  const pause = useMutation({
    mutationFn: (id: string) => pauseMandate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.mandates() }),
  });
  const resume = useMutation({
    mutationFn: (id: string) => resumeMandate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.mandates() }),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => cancelMandate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.mandates() }),
  });

  function handleCancel(m: Mandate) {
    Alert.alert(
      `Cancel this mandate?`,
      `${m.merchantName} will no longer be able to charge your wallet. This can't be undone — they'd need to ask you to approve a new one.`,
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Cancel mandate', style: 'destructive',
          onPress: () => {
            setActingId(m.id);
            cancel.mutate(m.id, { onSettled: () => setActingId(null) });
          },
        },
      ]
    );
  }

  function handleTogglePause(m: Mandate) {
    setActingId(m.id);
    const mutation = m.status === 'ACTIVE' ? pause : resume;
    mutation.mutate(m.id, { onSettled: () => setActingId(null) });
  }

  const manageable = mandates.filter(m => m.status !== 'PENDING_APPROVAL');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors.background }]}>
      <View style={styles.topBar}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={[styles.pageTitle, { color: Colors.textPrimary }]}>Payment Mandates</Text>
        <View style={{ width: 36 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : manageable.length === 0 ? (
        <View style={styles.center}>
          <Feather name="repeat" size={48} color={Colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: Colors.textPrimary }]}>No payment mandates</Text>
          <Text style={[styles.emptyDesc, { color: Colors.textSecondary }]}>
            When you approve a merchant or app to charge your wallet without asking each time,
            it will appear here.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          <Text style={[styles.listNote, { color: Colors.textSecondary }]}>
            These merchants can charge your wallet up to the limits shown, without asking you each
            time. Pause or cancel any you no longer want.
          </Text>

          {manageable.map(m => {
            const cadence = cadenceLabel(m.periodType);
            const isActing = actingId === m.id;
            return (
              <View
                key={m.id}
                style={[styles.card, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
              >
                <View style={styles.cardHeader}>
                  {m.merchantLogoUrl ? (
                    <Image source={{ uri: m.merchantLogoUrl }} style={styles.appLogo} />
                  ) : (
                    <View style={[styles.appIconFallback, { backgroundColor: Colors.primary + '20' }]}>
                      <Ionicons name="business" size={20} color={Colors.primary} />
                    </View>
                  )}
                  <View style={styles.appInfo}>
                    <Text style={[styles.appName, { color: Colors.textPrimary }]}>{m.merchantName}</Text>
                    <Text style={[styles.appDesc, { color: Colors.textSecondary }]} numberOfLines={1}>
                      {m.reference}
                    </Text>
                  </View>
                  <View style={[
                    styles.statusChip,
                    { backgroundColor: (m.status === 'ACTIVE' ? Colors.primary : Colors.textSecondary) + '15' },
                  ]}>
                    <Text style={[
                      styles.statusText,
                      { color: m.status === 'ACTIVE' ? Colors.primary : Colors.textSecondary },
                    ]}>
                      {STATUS_LABEL[m.status]}
                    </Text>
                  </View>
                </View>

                <View style={styles.termsRow}>
                  <Text style={[styles.termText, { color: Colors.textSecondary }]}>
                    Up to <Text style={styles.termEmphasis}>{fmtGHS(m.perChargeLimit)}</Text> per charge
                    {m.periodLimit != null && cadence ? (
                      <>, <Text style={styles.termEmphasis}>{fmtGHS(m.periodLimit)}</Text> per {cadence}</>
                    ) : null}
                  </Text>
                </View>

                {(m.status === 'ACTIVE' || m.status === 'PAUSED') && (
                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { borderColor: Colors.border }]}
                      onPress={() => handleTogglePause(m)}
                      disabled={isActing}
                      activeOpacity={0.7}
                    >
                      {isActing && (pause.isPending || resume.isPending) ? (
                        <ActivityIndicator size="small" color={Colors.textPrimary} />
                      ) : (
                        <Text style={[styles.actionBtnText, { color: Colors.textPrimary }]}>
                          {m.status === 'ACTIVE' ? 'Pause' : 'Resume'}
                        </Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { borderColor: Colors.error ?? '#EF4444' }]}
                      onPress={() => handleCancel(m)}
                      disabled={isActing}
                      activeOpacity={0.7}
                    >
                      {isActing && cancel.isPending ? (
                        <ActivityIndicator size="small" color={Colors.error ?? '#EF4444'} />
                      ) : (
                        <Text style={[styles.actionBtnText, { color: Colors.error ?? '#EF4444' }]}>
                          Cancel
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  return StyleSheet.create({
    container:       { flex: 1 },
    topBar:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
    pageTitle:       { fontSize: 17, fontWeight: '700' },
    center:          { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.xl },
    emptyTitle:      { fontSize: 18, fontWeight: '600', textAlign: 'center' },
    emptyDesc:       { ...Typography.caption as any, textAlign: 'center', lineHeight: 18 },
    list:            { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xl * 2 },
    listNote:        { ...Typography.caption as any, marginBottom: Spacing.xs, lineHeight: 18 },
    card:            { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md, gap: Spacing.sm },
    cardHeader:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    appLogo:         { width: 44, height: 44, borderRadius: 12 },
    appIconFallback: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    appInfo:         { flex: 1 },
    appName:         { fontSize: 15, fontWeight: '600' },
    appDesc:         { ...Typography.caption as any, marginTop: 1 },
    statusChip:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full },
    statusText:      { fontSize: 11, fontWeight: '700' },
    termsRow:        {},
    termText:        { ...Typography.caption as any, lineHeight: 18 },
    termEmphasis:    { fontWeight: '700' },
    actionsRow:      { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
    actionBtn:       { flex: 1, borderWidth: 1, borderRadius: Radius.md, paddingVertical: 10, alignItems: 'center' },
    actionBtnText:   { fontSize: 13, fontWeight: '600' },
  });
}
