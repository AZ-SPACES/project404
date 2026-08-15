import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Feather } from '@react-native-vector-icons/feather';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppTheme, Typography, Spacing, ThemeColors } from '../../../theme';
import type { RootStackParamList } from '../../../navigation/types';
import { BackButton } from '../../../components/ui/BackButton';
import Button from '../../../components/ui/Button';
import { getSplit, waiveSplitShare, remindSplit, cancelSplit, Split, SplitParticipant } from '../../../services/api';
import { extractErrorMessage } from '../../../utils/errorUtils';
import { useToast } from '../../../providers/ToastProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'SplitDetail'>;

const STATUS_COPY: Record<SplitParticipant['status'], string> = {
  PENDING: 'Waiting',
  PAID: 'Paid',
  DECLINED: 'Declined',
  WAIVED: 'Forgiven',
  CANCELLED: 'Withdrawn',
  // Rolled into a settle-up with the organiser: still owed, just consolidated.
  NETTED: 'In a settle-up',
};

export default function SplitDetailScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const { colors: Colors } = useAppTheme();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const { showToast } = useToast();

  const [split, setSplit] = useState<Split | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getSplit(id);
      setSplit(res.data?.data ?? res.data);
    } catch (e) {
      showToast(extractErrorMessage(e, 'Could not load this split.'), 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, showToast]);

  useEffect(() => { load(); }, [load]);

  const act = async (fn: () => Promise<any>, failure: string) => {
    if (busy) return;
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      const res = await fn();
      setSplit(res.data?.data ?? res.data);
    } catch (e) {
      showToast(extractErrorMessage(e, failure), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator color={Colors.primary} />
      </SafeAreaView>
    );
  }

  if (!split) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <BackButton onPress={() => navigation.goBack()} />
        </View>
        <View style={styles.center}>
          <Text style={styles.muted}>This split isn&apos;t available.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const open = split.status === 'OPEN';
  const iOwe = !split.organisedByMe && split.myShare != null && split.myStatus === 'PENDING';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle} numberOfLines={1}>{split.description}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} />
        }
      >
        <View style={styles.summaryCard}>
          <Text style={styles.total}>GH₵ {Number(split.totalAmount).toFixed(2)}</Text>
          <Text style={styles.muted}>
            {split.organisedByMe ? 'You paid this' : `${split.creatorName} paid this`}
            {' · '}
            {split.paidCount}/{split.participantCount} settled
          </Text>
          {split.status === 'SETTLED' && (
            <View style={styles.settledPill}>
              <Feather name="check" size={12} color={Colors.success} />
              <Text style={styles.settledText}>Everyone has settled up</Text>
            </View>
          )}
          {split.status === 'CANCELLED' && <Text style={styles.cancelled}>Called off</Text>}
        </View>

        {/* What you owe, if anything. Paying happens through the request itself. */}
        {iOwe && (
          <View style={styles.oweCard}>
            <Text style={styles.oweTitle}>You owe GH₵ {Number(split.myShare).toFixed(2)}</Text>
            <Text style={styles.muted}>
              {split.creatorName.split(' ')[0]} sent you a request for your share. Accept it from
              your home screen or the chat to pay.
            </Text>
          </View>
        )}

        {/* Everyone on the bill */}
        <Text style={styles.sectionLabel}>Who&apos;s on it</Text>
        {split.participants.map((p) => (
          <View key={p.userId} style={styles.row}>
            {p.avatarUrl ? (
              <Image source={{ uri: p.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitial}>{(p.name || '?').charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.flex}>
              <Text style={styles.name}>
                {p.name}
                {p.organiser && <Text style={styles.muted}>  · paid the bill</Text>}
              </Text>
              <Text
                style={[
                  styles.status,
                  p.status === 'PAID' && { color: Colors.success },
                  p.status === 'DECLINED' && { color: Colors.error },
                ]}
              >
                {p.organiser ? 'Their share' : STATUS_COPY[p.status]}
              </Text>
            </View>
            <Text style={styles.amount}>GH₵ {Number(p.amountOwed).toFixed(2)}</Text>
            {/* A netted share is being collected by a settle-up; forgiving it here would
                leave that settlement asking for money nobody owes. */}
            {split.organisedByMe && open && !p.organiser
              && p.status !== 'PAID' && p.status !== 'WAIVED' && p.status !== 'NETTED' && (
              <TouchableOpacity
                onPress={() => act(() => waiveSplitShare(split.id, p.userId), 'Could not forgive that share.')}
                accessibilityLabel={`Forgive ${p.name}'s share`}
                style={styles.waive}
              >
                <Text style={styles.waiveText}>Forgive</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        {/* Organiser controls */}
        {split.organisedByMe && open && (
          <View style={styles.actions}>
            <Button
              title="Send a reminder"
              onPress={() => act(async () => {
                const r = await remindSplit(split.id);
                showToast('Reminder sent', 'success');
                return r;
              }, 'Could not send reminders.')}
              disabled={busy || split.outstandingAmount <= 0}
              backgroundColor={Colors.primary}
              textColor={Colors.secondary}
            />
            <TouchableOpacity
              style={styles.secondaryAction}
              onPress={() => act(() => cancelSplit(split.id), 'Could not cancel this split.')}
              disabled={busy}
            >
              <Feather name="x-circle" size={16} color={Colors.error} />
              <Text style={[styles.secondaryActionText, { color: Colors.error }]}>Call it off</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    flex: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    headerTitle: { ...Typography.h2, color: Colors.textPrimary, flex: 1 },
    content: { padding: Spacing.md, paddingBottom: Spacing.xl },
    summaryCard: {
      alignItems: 'center',
      gap: 4,
      padding: Spacing.lg,
      borderRadius: 18,
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.border,
      marginBottom: Spacing.md,
    },
    total: { ...Typography.h1, color: Colors.textPrimary },
    muted: { ...Typography.caption, color: Colors.textSecondary },
    settledPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: Spacing.xs,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: Colors.success + '1A',
    },
    settledText: { ...Typography.caption, fontWeight: '700', color: Colors.success },
    cancelled: { ...Typography.caption, fontWeight: '700', color: Colors.warning, marginTop: Spacing.xs },
    oweCard: {
      gap: 4,
      padding: Spacing.md,
      borderRadius: 16,
      backgroundColor: Colors.primary + '14',
      borderWidth: 1,
      borderColor: Colors.primary,
      marginBottom: Spacing.md,
    },
    oweTitle: { ...Typography.bodyLg, fontWeight: '700', color: Colors.textPrimary },
    sectionLabel: {
      ...Typography.caption,
      color: Colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      fontWeight: '700',
      marginBottom: Spacing.xs,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.sm,
    },
    avatar: { width: 38, height: 38, borderRadius: 19 },
    avatarFallback: { backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
    avatarInitial: { ...Typography.body, fontWeight: '700', color: Colors.secondary },
    name: { ...Typography.body, fontWeight: '600', color: Colors.textPrimary },
    status: { ...Typography.caption, color: Colors.textSecondary },
    amount: { ...Typography.body, fontWeight: '700', color: Colors.textPrimary },
    waive: { paddingHorizontal: Spacing.sm, paddingVertical: 4 },
    waiveText: { ...Typography.caption, fontWeight: '700', color: Colors.primary },
    actions: { gap: Spacing.sm, marginTop: Spacing.lg },
    secondaryAction: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    secondaryActionText: { ...Typography.button, fontSize: 15 },
  });
