import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { RootStackParamList } from '../../../navigation/types';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';
import { BackButton } from '../../../components/ui/BackButton';
import { queryKeys } from '../../../lib/queryKeys';
import { getSpendingCategories } from '../../../services/api';
import { formatCurrency } from '../../../utils/transactionUtils';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'SpendingCategories'>;

type Category = {
  name: string;
  key: string;
  total: number;
  count: number;
  color: string;
};

type SpendingData = {
  categories: Category[];
  totalSpent: number;
};

type Period = '7d' | 'month' | '3m';

const PERIODS: { key: Period; label: string }[] = [
  { key: '7d', label: 'Last 7 days' },
  { key: 'month', label: 'This month' },
  { key: '3m', label: 'Last 3 months' },
];

function getPeriodDates(period: Period): { startDate: string; endDate: string } {
  const now = new Date();
  const end = now.toISOString().split('T')[0]!;

  if (period === '7d') {
    const start = new Date(now);
    start.setDate(now.getDate() - 7);
    return { startDate: start.toISOString().split('T')[0]!, endDate: end };
  }

  if (period === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { startDate: start.toISOString().split('T')[0]!, endDate: end };
  }

  // 3m
  const start = new Date(now);
  start.setMonth(now.getMonth() - 3);
  return { startDate: start.toISOString().split('T')[0]!, endDate: end };
}

export default function SpendingCategoriesScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();

  const [period, setPeriod] = useState<Period>('month');
  const { startDate, endDate } = getPeriodDates(period);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.spendingCategories(startDate, endDate),
    queryFn: async () => {
      const res = await getSpendingCategories(startDate, endDate);
      return (res.data?.data || res.data) as SpendingData;
    },
    staleTime: 5 * 60_000,
  });

  const categories: Category[] = data?.categories ?? [];
  const totalSpent: number = data?.totalSpent ?? 0;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" />

      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Spending Breakdown</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Period selector */}
      <View style={styles.pillRow}>
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p.key}
            style={[styles.pill, period === p.key && styles.pillActive]}
            activeOpacity={0.8}
            onPress={() => setPeriod(p.key)}
          >
            <Text style={[styles.pillText, period === p.key && styles.pillTextActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : categories.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No spending data for this period</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total spent</Text>
            <Text style={styles.summaryAmount}>{formatCurrency(totalSpent, 'GHS')}</Text>
          </View>

          {/* Horizontal bar chart */}
          <Text style={styles.groupLabel}>By Category</Text>
          <View style={styles.chartCard}>
            {categories.map((cat, i) => {
              const pct = totalSpent > 0 ? (cat.total / totalSpent) * 100 : 0;
              const isLast = i === categories.length - 1;
              return (
                <View key={cat.key} style={[styles.barRow, !isLast && styles.barRowBorder]}>
                  <View style={styles.barLabelRow}>
                    <View style={[styles.colorDot, { backgroundColor: cat.color }]} />
                    <Text style={styles.catName} numberOfLines={1}>{cat.name}</Text>
                    <Text style={styles.catPct}>{pct.toFixed(1)}%</Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${pct}%` as any, backgroundColor: cat.color },
                      ]}
                    />
                  </View>
                  <View style={styles.barMetaRow}>
                    <Text style={styles.catCount}>{cat.count} transaction{cat.count !== 1 ? 's' : ''}</Text>
                    <Text style={styles.catAmount}>{formatCurrency(cat.total, 'GHS')}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Category list */}
          <Text style={styles.groupLabel}>Detail</Text>
          <View style={styles.tableCard}>
            {categories.map((cat, i) => (
              <View
                key={cat.key}
                style={[styles.tableRow, i === categories.length - 1 && styles.tableRowLast]}
              >
                <View style={styles.tableLeft}>
                  <View style={[styles.colorDot, { backgroundColor: cat.color }]} />
                  <View>
                    <Text style={styles.tableLabel}>{cat.name}</Text>
                    <Text style={styles.tableSubLabel}>{cat.count} txn{cat.count !== 1 ? 's' : ''}</Text>
                  </View>
                </View>
                <Text style={styles.tableValue}>{formatCurrency(cat.total, 'GHS')}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
    },
    headerTitle: {
      ...Typography.body,
      fontWeight: '600',
      color: Colors.textPrimary,
    },
    pillRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.md,
    },
    pill: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: Radius.lg,
      backgroundColor: isDark ? Colors.surface : '#F3F4F6',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: Colors.border,
    },
    pillActive: {
      backgroundColor: Colors.primary,
      borderColor: Colors.primary,
    },
    pillText: {
      fontSize: 12,
      fontWeight: '600',
      color: Colors.textSecondary,
    },
    pillTextActive: {
      color: isDark ? Colors.textPrimary : Colors.white,
    },
    loader: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: {
      ...Typography.body,
      color: Colors.textSecondary,
    },
    content: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.xl,
    },
    summaryCard: {
      backgroundColor: isDark ? Colors.surface : Colors.white,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: Colors.border,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
    },
    summaryLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: Colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    summaryAmount: {
      fontSize: 28,
      fontWeight: '700',
      color: Colors.textPrimary,
    },
    groupLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: Colors.textSecondary,
      marginBottom: Spacing.sm,
      marginTop: Spacing.sm,
    },
    chartCard: {
      backgroundColor: isDark ? Colors.surface : Colors.white,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: Colors.border,
      overflow: 'hidden',
      marginBottom: Spacing.xl,
    },
    barRow: {
      padding: Spacing.md,
    },
    barRowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.border,
    },
    barLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    colorDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginRight: Spacing.sm,
    },
    catName: {
      ...Typography.body,
      fontWeight: '600',
      color: Colors.textPrimary,
      flex: 1,
    },
    catPct: {
      fontSize: 13,
      fontWeight: '600',
      color: Colors.textSecondary,
    },
    barTrack: {
      height: 8,
      backgroundColor: isDark ? Colors.border : '#F3F4F6',
      borderRadius: 4,
      overflow: 'hidden',
      marginBottom: 6,
    },
    barFill: {
      height: 8,
      borderRadius: 4,
      minWidth: 4,
    },
    barMetaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    catCount: {
      fontSize: 12,
      color: Colors.textSecondary,
    },
    catAmount: {
      fontSize: 13,
      fontWeight: '600',
      color: Colors.textPrimary,
    },
    tableCard: {
      backgroundColor: isDark ? Colors.surface : Colors.white,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: Colors.border,
      overflow: 'hidden',
    },
    tableRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.border,
    },
    tableRowLast: {
      borderBottomWidth: 0,
    },
    tableLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    tableLabel: {
      ...Typography.body,
      color: Colors.textPrimary,
      fontWeight: '500',
    },
    tableSubLabel: {
      fontSize: 12,
      color: Colors.textSecondary,
      marginTop: 2,
    },
    tableValue: {
      ...Typography.body,
      fontWeight: '600',
      color: Colors.textPrimary,
    },
  });
}
