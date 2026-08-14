import React, { useCallback, useMemo, useState } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppTheme, Typography, Spacing, ThemeColors } from '../../../theme';
import type { RootStackParamList } from '../../../navigation/types';
import { BackButton } from '../../../components/ui/BackButton';
import { getSplits, Split } from '../../../services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'Splits'>;

export default function SplitsScreen({ navigation }: Props) {
  const { colors: Colors } = useAppTheme();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const [splits, setSplits] = useState<Split[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getSplits();
      const page = res.data?.data ?? res.data;
      setSplits(page?.content ?? []);
    } catch {
      // Leave whatever is on screen rather than blanking the list.
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fires on mount and on every return to the screen, so coming back from paying a
  // share shows it settled.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Split bills</Text>
        <TouchableOpacity onPress={() => navigation.navigate('CreateSplit')} accessibilityLabel="Split a bill">
          <Feather name="plus" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <FlatList
          data={splits}
          keyExtractor={(s) => s.id}
          contentContainerStyle={splits.length === 0 ? styles.emptyWrap : styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} />
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
          renderItem={({ item }) => {
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
                        : 'Your share is settled'}
                  </Text>
                </View>
                <Text style={[styles.badge, item.status === 'SETTLED' && { color: Colors.success }]}>
                  {item.paidCount}/{item.participantCount}
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
    cta: {
      marginTop: Spacing.md,
      paddingHorizontal: Spacing.lg,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: Colors.primary,
    },
    ctaText: { ...Typography.button, fontSize: 15, color: Colors.secondary },
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
    cardBody: { flex: 1 },
    cardTitle: { ...Typography.bodyLg, fontWeight: '700', color: Colors.textPrimary },
    cardSub: { ...Typography.caption, color: Colors.textSecondary },
    badge: { ...Typography.caption, fontWeight: '700', color: Colors.textSecondary },
  });
