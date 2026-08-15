import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { Feather } from '@react-native-vector-icons/feather';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppTheme, Typography, Spacing, ThemeColors } from '../../../theme';
import type { RootStackParamList } from '../../../navigation/types';
import { BackButton } from '../../../components/ui/BackButton';
import { getSplits, getSplitBalances, settleUpWith, Split, SplitBalance } from '../../../services/api';
import { extractErrorMessage } from '../../../utils/errorUtils';
import { useToast } from '../../../providers/ToastProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'Splits'>;

export default function SplitsScreen({ navigation }: Props) {
  const { colors: Colors } = useAppTheme();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const { showToast } = useToast();

  const [balances, setBalances] = useState<SplitBalance[]>([]);
  const [splits, setSplits] = useState<Split[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settling, setSettling] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [balanceRes, splitRes] = await Promise.all([getSplitBalances(), getSplits()]);
      setBalances(balanceRes.data?.data ?? balanceRes.data ?? []);
      const page = splitRes.data?.data ?? splitRes.data;
      setSplits(page?.content ?? []);
    } catch {
      // Leave whatever is on screen rather than blanking it.
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const settle = async (b: SplitBalance) => {
    if (settling) return;
    setSettling(b.userId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      await settleUpWith(b.userId);
      showToast(
        b.net < 0 ? 'Settle-up request sent to you' : `${b.name.split(' ')[0]} has been asked`,
        'success',
      );
      await load();
    } catch (e) {
      showToast(extractErrorMessage(e, 'Could not settle up.'), 'error');
    } finally {
      setSettling(null);
    }
  };

  // Balances lead, because an unpaid share that only ever appeared in a notification is
  // an unpaid share nobody chases.
  const sections = useMemo(() => {
    const out: { title: string; kind: 'balance' | 'split'; data: any[] }[] = [];
    if (balances.length > 0) out.push({ title: 'Where you stand', kind: 'balance', data: balances });
    out.push({ title: 'Bills', kind: 'split', data: splits });
    return out;
  }, [balances, splits]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator color={Colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Split bills</Text>
        <TouchableOpacity onPress={() => navigation.navigate('RecurringSplits')} accessibilityLabel="Recurring splits">
          <Feather name="repeat" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('CreateSplit')} accessibilityLabel="Split a bill">
          <Feather name="plus" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item: any) => item.userId ?? item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={
          balances.length === 0 && splits.length === 0 ? styles.emptyWrap : styles.list
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={Colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Feather name="users" size={40} color={Colors.textSecondary} />
            <Text style={styles.emptyTitle}>No split bills</Text>
            <Text style={styles.emptyBody}>
              Paid for everyone? Split it and Aza will ask each person for their share.
            </Text>
            <TouchableOpacity style={styles.cta} onPress={() => navigation.navigate('CreateSplit')}>
              <Text style={styles.ctaText}>Split a bill</Text>
            </TouchableOpacity>
          </View>
        }
        renderSectionHeader={({ section }) =>
          section.data.length === 0 ? null : (
            <Text style={styles.sectionLabel}>{section.title}</Text>
          )
        }
        renderItem={({ item, section }) =>
          section.kind === 'balance'
            ? renderBalance(item as SplitBalance)
            : renderSplit(item as Split)
        }
      />
    </SafeAreaView>
  );

  function renderBalance(b: SplitBalance) {
    const owed = b.net >= 0;
    const amount = Math.abs(b.net);
    // A settlement already waiting means the ask has been made; asking again would
    // only net the same debts twice.
    const waiting = !!b.openSettlementId;

    return (
      <View style={styles.balanceCard}>
        {b.avatarUrl ? (
          <Image source={{ uri: b.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInitial}>{(b.name || '?').charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.flex}>
          <Text style={styles.name}>{b.name}</Text>
          <Text style={[styles.netLine, { color: owed ? Colors.success : Colors.error }]}>
            {amount === 0
              ? 'You’re square'
              : owed
                ? `owes you GH₵ ${amount.toFixed(2)}`
                : `you owe GH₵ ${amount.toFixed(2)}`}
          </Text>
          {/* Show the working when it isn't just one debt one way. */}
          {b.theyOweYou > 0 && b.youOweThem > 0 && (
            <Text style={styles.muted}>
              GH₵ {b.theyOweYou.toFixed(2)} − GH₵ {b.youOweThem.toFixed(2)} · {b.shareCount} shares
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={[styles.settleButton, (waiting || settling === b.userId) && styles.settleDisabled]}
          onPress={() => settle(b)}
          disabled={waiting || settling === b.userId}
        >
          {settling === b.userId ? (
            <ActivityIndicator size="small" color={Colors.secondary} />
          ) : (
            <Text style={styles.settleText}>{waiting ? 'Sent' : 'Settle up'}</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  function renderSplit(item: Split) {
    const owedToMe = item.organisedByMe;
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('SplitDetail', { id: item.id })}
      >
        <View style={styles.cardIcon}>
          <Feather name={owedToMe ? 'arrow-down-left' : 'arrow-up-right'} size={18} color={Colors.secondary} />
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.description}</Text>
          <Text style={styles.cardSub}>
            {owedToMe
              ? item.outstandingAmount > 0
                ? `You're owed GH₵ ${Number(item.outstandingAmount).toFixed(2)}`
                : 'Everyone has settled up'
              : item.myShare != null
                ? `You owe GH₵ ${Number(item.myShare).toFixed(2)}`
                : item.myStatus === 'NETTED'
                  ? 'Rolled into a settle-up'
                  : 'Your share is settled'}
          </Text>
        </View>
        <Text style={[styles.badge, item.status === 'SETTLED' && { color: Colors.success }]}>
          {item.paidCount}/{item.participantCount}
        </Text>
      </TouchableOpacity>
    );
  }
}

const createStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    flex: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg, gap: Spacing.sm },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    headerTitle: { ...Typography.h2, color: Colors.textPrimary, flex: 1 },
    list: { padding: Spacing.md, paddingBottom: Spacing.xl },
    emptyWrap: { flexGrow: 1, justifyContent: 'center' },
    emptyTitle: { ...Typography.h3, color: Colors.textPrimary, marginTop: Spacing.sm },
    emptyBody: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center' },
    cta: {
      marginTop: Spacing.md,
      paddingHorizontal: Spacing.lg,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: Colors.primary,
    },
    ctaText: { ...Typography.button, fontSize: 15, color: Colors.secondary },
    sectionLabel: {
      ...Typography.caption,
      color: Colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      fontWeight: '700',
      marginTop: Spacing.md,
      marginBottom: Spacing.xs,
    },
    balanceCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      backgroundColor: Colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: Colors.border,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
    },
    avatar: { width: 40, height: 40, borderRadius: 20 },
    avatarFallback: { backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
    avatarInitial: { ...Typography.body, fontWeight: '700', color: Colors.secondary },
    name: { ...Typography.body, fontWeight: '700', color: Colors.textPrimary },
    netLine: { ...Typography.body, fontWeight: '600' },
    muted: { ...Typography.caption, color: Colors.textSecondary },
    settleButton: {
      paddingHorizontal: Spacing.md,
      paddingVertical: 9,
      borderRadius: 10,
      backgroundColor: Colors.primary,
      minWidth: 84,
      alignItems: 'center',
    },
    settleDisabled: { backgroundColor: Colors.border },
    settleText: { ...Typography.button, fontSize: 14, color: Colors.secondary },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      backgroundColor: Colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: Colors.border,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
    },
    cardIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: Colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardBody: { flex: 1 },
    cardTitle: { ...Typography.bodyLg, fontWeight: '700', color: Colors.textPrimary },
    cardSub: { ...Typography.caption, color: Colors.textSecondary },
    badge: { ...Typography.caption, fontWeight: '700', color: Colors.textSecondary },
  });
