import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Switch,
} from 'react-native';
import { Feather } from '@react-native-vector-icons/feather';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppTheme, Typography, Spacing, ThemeColors } from '../../../theme';
import type { RootStackParamList } from '../../../navigation/types';
import { BackButton } from '../../../components/ui/BackButton';
import {
  getRecurringSplits,
  setRecurringSplitActive,
  deleteRecurringSplit,
  RecurringSplit,
} from '../../../services/api';
import { extractErrorMessage } from '../../../utils/errorUtils';
import { useToast } from '../../../providers/ToastProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'RecurringSplits'>;

const WEEKDAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function ordinal(n: number) {
  const suffix = n % 10 === 1 && n !== 11 ? 'st'
    : n % 10 === 2 && n !== 12 ? 'nd'
      : n % 10 === 3 && n !== 13 ? 'rd' : 'th';
  return `${n}${suffix}`;
}

export default function RecurringSplitsScreen({ navigation }: Props) {
  const { colors: Colors } = useAppTheme();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const { showToast } = useToast();

  const [items, setItems] = useState<RecurringSplit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await getRecurringSplits();
      setItems(res.data?.data ?? res.data ?? []);
    } catch {
      // Leave what's on screen.
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggle = async (item: RecurringSplit, active: boolean) => {
    setBusy(item.id);
    Haptics.selectionAsync().catch(() => {});
    try {
      await setRecurringSplitActive(item.id, active);
      await load();
    } catch (e) {
      showToast(extractErrorMessage(e, 'Could not change that.'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const remove = async (item: RecurringSplit) => {
    setBusy(item.id);
    try {
      await deleteRecurringSplit(item.id);
      showToast('Stopped', 'success');
      await load();
    } catch (e) {
      showToast(extractErrorMessage(e, 'Could not stop that.'), 'error');
    } finally {
      setBusy(null);
    }
  };

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
        <Text style={styles.headerTitle}>Every month</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(r) => r.id}
        contentContainerStyle={items.length === 0 ? styles.emptyWrap : styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={Colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Feather name="repeat" size={40} color={Colors.textSecondary} />
            <Text style={styles.emptyTitle}>Nothing on repeat</Text>
            <Text style={styles.emptyBody}>
              Rent, the water, the wifi — set it up once and Aza asks everyone on the day,
              every month.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, !item.active && styles.cardPaused]}>
            <View style={styles.cardTop}>
              <View style={styles.flex}>
                <Text style={styles.title}>{item.description}</Text>
                <Text style={styles.muted}>
                  GH₵ {Number(item.totalAmount).toFixed(2)} ·{' '}
                  {item.frequency === 'WEEKLY'
                    ? `every ${WEEKDAYS[item.dayOfPeriod] ?? 'week'}`
                    : `the ${ordinal(item.dayOfPeriod)} of each month`}
                </Text>
                <Text style={styles.muted}>
                  {item.participants.length} {item.participants.length === 1 ? 'person' : 'people'}
                  {item.active ? ` · next on ${item.nextRunOn}` : ' · paused'}
                </Text>
              </View>
              <Switch
                value={item.active}
                onValueChange={(v) => toggle(item, v)}
                disabled={busy === item.id}
                trackColor={{ true: Colors.primary, false: Colors.border }}
              />
            </View>

            <TouchableOpacity
              style={styles.stopRow}
              onPress={() => remove(item)}
              disabled={busy === item.id}
            >
              <Feather name="trash-2" size={14} color={Colors.error} />
              <Text style={styles.stopText}>Stop splitting this</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </SafeAreaView>
  );
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
    list: { padding: Spacing.md, gap: Spacing.sm },
    emptyWrap: { flexGrow: 1, justifyContent: 'center' },
    emptyTitle: { ...Typography.h3, color: Colors.textPrimary, marginTop: Spacing.sm },
    emptyBody: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center' },
    card: {
      backgroundColor: Colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: Colors.border,
      padding: Spacing.md,
      gap: Spacing.sm,
    },
    cardPaused: { opacity: 0.6 },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    title: { ...Typography.bodyLg, fontWeight: '700', color: Colors.textPrimary },
    muted: { ...Typography.caption, color: Colors.textSecondary },
    stopRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    stopText: { ...Typography.caption, fontWeight: '700', color: Colors.error },
  });
