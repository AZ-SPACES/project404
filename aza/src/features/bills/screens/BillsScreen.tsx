import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
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
import { getBillers, getBillPayments, Biller, BillPayment, BillerCategory } from '../../../services/api';
import { extractErrorMessage } from '../../../utils/errorUtils';

type Props = NativeStackScreenProps<RootStackParamList, 'Bills'>;

const CATEGORY_LABEL: Record<BillerCategory, string> = {
  ELECTRICITY: 'Electricity',
  WATER: 'Water',
  AIRTIME: 'Airtime',
  DATA: 'Data',
  TV: 'TV',
  INTERNET: 'Internet',
  GOVERNMENT: 'Government',
  INSURANCE: 'Insurance',
  EDUCATION: 'School fees',
};

const CATEGORY_ICON: Record<BillerCategory, string> = {
  ELECTRICITY: 'zap',
  WATER: 'droplet',
  AIRTIME: 'phone',
  DATA: 'wifi',
  TV: 'tv',
  INTERNET: 'globe',
  GOVERNMENT: 'briefcase',
  INSURANCE: 'shield',
  EDUCATION: 'book',
};

export default function BillsScreen({ navigation }: Props) {
  const { colors: Colors } = useAppTheme();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const [billers, setBillers] = useState<Biller[]>([]);
  const [recent, setRecent] = useState<BillPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [billerRes, historyRes] = await Promise.all([getBillers(), getBillPayments(0, 5)]);
      setBillers(billerRes.data?.data ?? billerRes.data ?? []);
      const page = historyRes.data?.data ?? historyRes.data;
      setRecent(page?.content ?? []);
      setError(null);
    } catch (e) {
      setError(extractErrorMessage(e, 'Could not load billers.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const sections = useMemo(() => {
    const byCategory = new Map<BillerCategory, Biller[]>();
    for (const b of billers) {
      const list = byCategory.get(b.category) ?? [];
      list.push(b);
      byCategory.set(b.category, list);
    }
    return [...byCategory.entries()].map(([category, data]) => ({
      title: CATEGORY_LABEL[category] ?? category,
      icon: CATEGORY_ICON[category] ?? 'file-text',
      data,
    }));
  }, [billers]);

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
        <Text style={styles.headerTitle}>Pay a bill</Text>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(b) => b.slug}
        contentContainerStyle={sections.length === 0 ? styles.emptyWrap : styles.list}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={Colors.primary}
          />
        }
        ListHeaderComponent={
          recent.length > 0 ? (
            <View style={styles.recentBlock}>
              <Text style={styles.sectionLabel}>Recent</Text>
              {recent.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.recentRow}
                  onPress={() => navigation.navigate('BillReceipt', { id: p.id })}
                >
                  <View style={styles.flex}>
                    <Text style={styles.billerName}>{p.billerName}</Text>
                    <Text style={styles.muted}>{p.accountNumber}</Text>
                  </View>
                  <View style={styles.recentMeta}>
                    <Text style={styles.amount}>GH₵ {Number(p.amount).toFixed(2)}</Text>
                    <Text
                      style={[
                        styles.status,
                        p.status === 'COMPLETED' && { color: Colors.success },
                        p.status === 'PENDING' && { color: Colors.warning },
                        (p.status === 'REFUNDED' || p.status === 'FAILED') && { color: Colors.error },
                      ]}
                    >
                      {p.status === 'PENDING' ? 'Confirming' : p.status.toLowerCase()}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Feather name="file-text" size={40} color={Colors.textSecondary} />
            <Text style={styles.emptyTitle}>Nothing to pay yet</Text>
            <Text style={styles.emptyBody}>{error ?? 'No billers are available right now.'}</Text>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Feather name={section.icon as any} size={14} color={Colors.textSecondary} />
            <Text style={styles.sectionLabel}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.billerRow}
            onPress={() => navigation.navigate('PayBill', { billerSlug: item.slug })}
          >
            <View style={styles.flex}>
              <Text style={styles.billerName}>{item.name}</Text>
              <Text style={styles.muted}>{item.accountLabel}</Text>
            </View>
            <Feather name="chevron-right" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
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
    headerTitle: { ...Typography.h2, color: Colors.textPrimary },
    list: { padding: Spacing.md, paddingBottom: Spacing.xl },
    emptyWrap: { flexGrow: 1, justifyContent: 'center' },
    emptyTitle: { ...Typography.h3, color: Colors.textPrimary, marginTop: Spacing.sm },
    emptyBody: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center' },
    recentBlock: { marginBottom: Spacing.md },
    recentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.sm,
    },
    recentMeta: { alignItems: 'flex-end' },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: Spacing.md,
      marginBottom: Spacing.xs,
    },
    sectionLabel: {
      ...Typography.caption,
      color: Colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      fontWeight: '700',
    },
    billerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.sm + 2,
      paddingHorizontal: Spacing.md,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.surface,
      marginBottom: Spacing.xs,
    },
    billerName: { ...Typography.body, fontWeight: '600', color: Colors.textPrimary },
    muted: { ...Typography.caption, color: Colors.textSecondary },
    amount: { ...Typography.body, fontWeight: '700', color: Colors.textPrimary },
    status: { ...Typography.caption, fontWeight: '700', textTransform: 'capitalize' },
  });
