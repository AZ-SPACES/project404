import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Feather } from '@react-native-vector-icons/feather';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppTheme, Typography, Spacing, ThemeColors } from '../../../theme';
import type { RootStackParamList } from '../../../navigation/types';
import { BackButton } from '../../../components/ui/BackButton';
import { getSentAkyede, getReceivedAkyede, Akyede, AkyedeOccasion } from '../../../services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'MyAkyede'>;

type Tab = 'sent' | 'received';

const OCCASION_EMOJI: Record<AkyedeOccasion, string> = {
  BIRTHDAY: '🎂',
  WEDDING: '💍',
  OUTDOORING: '👶',
  GRADUATION: '🎓',
  CONGRATULATIONS: '🎉',
  THANK_YOU: '🙏',
  CHRISTMAS: '🎄',
  EID: '🌙',
  EASTER: '🐣',
  JUST_BECAUSE: '💛',
};

const STATUS_COPY: Record<
  Akyede['status'],
  { sent: string; received: string; tone: 'open' | 'done' | 'returned' }
> = {
  UNOPENED: { sent: 'Waiting', received: 'Unopened', tone: 'open' },
  OPENED: { sent: 'Opened', received: 'Opened', tone: 'done' },
  EXPIRED_REFUNDED: { sent: 'Returned to you', received: 'Expired', tone: 'returned' },
};

export default function MyAkyedeScreen({ navigation }: Props) {
  const { colors: Colors } = useAppTheme();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const [tab, setTab] = useState<Tab>('received');
  const [gifts, setGifts] = useState<Akyede[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (which: Tab) => {
    try {
      const res = which === 'sent' ? await getSentAkyede() : await getReceivedAkyede();
      const page = res.data?.data ?? res.data;
      setGifts(page?.content ?? []);
    } catch {
      // Leave whatever is already on screen rather than blanking the list.
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { setLoading(true); load(tab); }, [tab, load]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>My Akyede</Text>
      </View>

      <View style={styles.tabs}>
        {(['received', 'sent'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            style={[styles.tab, tab === t && styles.tabActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t }}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'received' ? 'Received' : 'Sent'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={[styles.center, styles.flex]}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={gifts}
          keyExtractor={(g) => g.id}
          contentContainerStyle={gifts.length === 0 ? styles.emptyWrap : styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(tab); }}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Feather name="gift" size={40} color={Colors.textSecondary} />
              <Text style={styles.emptyTitle}>
                {tab === 'sent' ? 'You haven’t sent any' : 'Nothing yet'}
              </Text>
              <Text style={styles.emptyBody}>
                {tab === 'sent'
                  ? 'Send someone money as a gift — for a birthday, a wedding, or just because.'
                  : 'When someone sends you an Akyede, it will wait for you here.'}
              </Text>
              {tab === 'sent' && (
                <TouchableOpacity style={styles.emptyCta} onPress={() => navigation.navigate('CreateAkyede', {})}>
                  <Text style={styles.emptyCtaText}>Send one</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          renderItem={({ item }) => {
            const status = STATUS_COPY[item.status];
            const other = tab === 'sent' ? item.recipientName : item.senderName;
            // An unopened gift keeps its amount from the recipient — the list must not
            // give away what the wrapping is hiding.
            const amount = item.amount != null ? `GH₵ ${Number(item.amount).toFixed(2)}` : 'Wrapped';

            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => navigation.navigate('AkyedeOpen', { claimCode: item.claimCode })}
              >
                <View style={styles.cardIcon}>
                  <Text style={styles.cardEmoji}>{OCCASION_EMOJI[item.occasion ?? 'JUST_BECAUSE']}</Text>
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>
                    {amount}
                    <Text style={styles.cardTitleDim}>
                      {'  '}{tab === 'sent' ? 'to' : 'from'} {other ?? 'someone'}
                    </Text>
                  </Text>
                  <Text style={styles.cardSub} numberOfLines={1}>
                    {item.message || 'Akyede'}
                  </Text>
                </View>
                <Text style={[styles.statusText, styles[`status_${status.tone}`]]}>
                  {tab === 'sent' ? status.sent : status.received}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    flex: { flex: 1 },
    center: { alignItems: 'center', justifyContent: 'center', padding: Spacing.lg, gap: Spacing.sm },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    headerTitle: { ...Typography.h2, color: Colors.textPrimary },
    tabs: {
      flexDirection: 'row',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingBottom: Spacing.sm,
    },
    tab: {
      paddingVertical: 8,
      paddingHorizontal: Spacing.md,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.surface,
    },
    tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    tabText: { ...Typography.body, fontWeight: '600', color: Colors.textPrimary },
    tabTextActive: { color: Colors.secondary },
    list: { padding: Spacing.md, gap: Spacing.sm },
    emptyWrap: { flexGrow: 1, justifyContent: 'center' },
    emptyTitle: { ...Typography.h3, color: Colors.textPrimary, marginTop: Spacing.sm },
    emptyBody: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center' },
    emptyCta: {
      marginTop: Spacing.md,
      paddingHorizontal: Spacing.lg,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: Colors.primary,
    },
    emptyCtaText: { ...Typography.button, fontSize: 15, color: Colors.secondary },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      backgroundColor: Colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: Colors.border,
      padding: Spacing.md,
    },
    cardIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: Colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardEmoji: { fontSize: 18 },
    cardBody: { flex: 1 },
    cardTitle: { ...Typography.bodyLg, fontWeight: '700', color: Colors.textPrimary },
    cardTitleDim: { ...Typography.body, fontWeight: '400', color: Colors.textSecondary },
    cardSub: { ...Typography.caption, color: Colors.textSecondary },
    statusText: { ...Typography.caption, fontWeight: '700' },
    status_open: { color: Colors.success },
    status_done: { color: Colors.textSecondary },
    status_returned: { color: Colors.warning },
  });
