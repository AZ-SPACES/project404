import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator, Dimensions,
} from 'react-native';
import { Feather } from '@react-native-vector-icons/feather';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import Svg, { Path, Circle, G } from 'react-native-svg';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';
import { RootStackParamList } from '../../../navigation/types';
import { BackButton } from '../../../components/ui/BackButton';
import { queryKeys } from '../../../lib/queryKeys';
import { getSpendingCategories, getFinancialSummary, getBudgetStatus } from '../../../services/api';
import { formatCurrency } from '../../../utils/transactionUtils';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'FinancialDashboard'>;
type Period = '7D' | '1M' | '3M' | '6M' | '1Y';

const PERIODS: { key: Period; label: string }[] = [
  { key: '7D', label: '7D' },
  { key: '1M', label: '1M' },
  { key: '3M', label: '3M' },
  { key: '6M', label: '6M' },
  { key: '1Y', label: '1Y' },
];

function getPeriodDates(period: Period): { startDate: string; endDate: string } {
  const now = new Date();
  const end = now.toISOString().split('T')[0]!;
  const start = new Date(now);
  if (period === '7D') start.setDate(now.getDate() - 7);
  else if (period === '1M') start.setMonth(now.getMonth() - 1);
  else if (period === '3M') start.setMonth(now.getMonth() - 3);
  else if (period === '6M') start.setMonth(now.getMonth() - 6);
  else start.setFullYear(now.getFullYear() - 1);
  return { startDate: start.toISOString().split('T')[0]!, endDate: end };
}

// SVG Donut Chart helpers
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, outerR: number, innerR: number, startAngle: number, endAngle: number): string {
  const spread = endAngle - startAngle;
  if (spread >= 359.9) {
    const top = polarToCartesian(cx, cy, outerR, 0);
    const bot = polarToCartesian(cx, cy, outerR, 180);
    const iTop = polarToCartesian(cx, cy, innerR, 0);
    const iBot = polarToCartesian(cx, cy, innerR, 180);
    return [
      `M ${top.x} ${top.y}`,
      `A ${outerR} ${outerR} 0 1 1 ${bot.x} ${bot.y}`,
      `A ${outerR} ${outerR} 0 1 1 ${top.x} ${top.y}`,
      `M ${iTop.x} ${iTop.y}`,
      `A ${innerR} ${innerR} 0 1 0 ${iBot.x} ${iBot.y}`,
      `A ${innerR} ${innerR} 0 1 0 ${iTop.x} ${iTop.y} Z`,
    ].join(' ');
  }
  const outerStart = polarToCartesian(cx, cy, outerR, startAngle);
  const outerEnd   = polarToCartesian(cx, cy, outerR, endAngle);
  const innerEnd   = polarToCartesian(cx, cy, innerR, endAngle);
  const innerStart = polarToCartesian(cx, cy, innerR, startAngle);
  const large = spread > 180 ? 1 : 0;
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}

const CATEGORY_ICON: Record<string, string> = {
  BILLS: 'zap', TRANSPORT: 'navigation', FOOD: 'coffee', EDUCATION: 'book-open',
  ENTERTAINMENT: 'film', SHOPPING: 'shopping-bag', HEALTHCARE: 'heart',
  SAVINGS: 'trending-up', OTHERS: 'more-horizontal',
};

const { width: SCREEN_W } = Dimensions.get('window');
const CHART_SIZE = Math.min(SCREEN_W - Spacing.lg * 2, 240);
const CX = CHART_SIZE / 2;
const OUTER_R = CHART_SIZE / 2 - 8;
const INNER_R = OUTER_R * 0.62;

export default function FinancialDashboardScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();
  const [period, setPeriod] = useState<Period>('1M');

  const { startDate, endDate } = getPeriodDates(period);

  const { data: catData, isLoading: catLoading } = useQuery({
    queryKey: queryKeys.spendingCategories(startDate, endDate),
    queryFn: async () => {
      const res = await getSpendingCategories(startDate, endDate);
      return res.data?.data || res.data;
    },
    staleTime: 5 * 60_000,
  });

  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: queryKeys.financialSummary(startDate, endDate),
    queryFn: async () => {
      const res = await getFinancialSummary(startDate, endDate);
      return res.data?.data || res.data;
    },
    staleTime: 5 * 60_000,
  });

  const { data: budgetData } = useQuery({
    queryKey: queryKeys.budgetStatus(startDate, endDate),
    queryFn: async () => {
      const res = await getBudgetStatus(startDate, endDate);
      return (res.data?.data || res.data) as BudgetItem[];
    },
    staleTime: 5 * 60_000,
  });

  type Category = { name: string; key: string; total: number; count: number; color: string };
  type BudgetItem = { category: string; categoryName: string; color: string; spent: number; budgetAmount?: number; remaining?: number; percentUsed?: number };

  const categories: Category[] = catData?.categories ?? [];
  const totalSpent: number = catData?.totalSpent ?? 0;
  const totalIncome: number = summaryData?.totalIncome ?? 0;
  const balance: number = summaryData?.balance ?? 0;
  const currency: string = summaryData?.currency ?? 'GHS';

  const isLoading = catLoading || summaryLoading;

  // Build donut segments
  const segments = useMemo(() => {
    if (!categories.length || totalSpent === 0) return [];
    const GAP = 2;
    let angle = 0;
    return categories.map(cat => {
      const pct = cat.total / totalSpent;
      const sweep = pct * (360 - GAP * categories.length);
      const start = angle;
      const end = angle + sweep;
      angle = end + GAP;
      return { ...cat, start, end };
    });
  }, [categories, totalSpent]);

  const budgetItems = (budgetData ?? []).filter(b => b.budgetAmount || b.spent > 0);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" />

      {/* Header */}
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Finance</Text>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.navigate('BudgetManagement')}
          activeOpacity={0.7}
        >
          <Feather name="sliders" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Period Tabs */}
      <View style={styles.periodRow}>
        {PERIODS.map(p => (
          <TouchableOpacity
            key={p.key}
            style={[styles.periodTab, period === p.key && styles.periodTabActive]}
            onPress={() => setPeriod(p.key)}
            activeOpacity={0.8}
          >
            <Text style={[styles.periodTabText, period === p.key && styles.periodTabTextActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {/* Overview Cards */}
          <View style={styles.cardsRow}>
            <View style={[styles.overviewCard, { borderColor: '#34D39933' }]}>
              <View style={[styles.overviewIcon, { backgroundColor: '#34D39920' }]}>
                <Feather name="arrow-down-left" size={16} color="#34D399" />
              </View>
              <Text style={styles.overviewLabel}>Income</Text>
              <Text style={[styles.overviewAmount, { color: '#34D399' }]} numberOfLines={1}>
                {formatCurrency(totalIncome, currency)}
              </Text>
            </View>

            <View style={[styles.overviewCard, { borderColor: '#EF444433' }]}>
              <View style={[styles.overviewIcon, { backgroundColor: '#EF444420' }]}>
                <Feather name="arrow-up-right" size={16} color="#EF4444" />
              </View>
              <Text style={styles.overviewLabel}>Spent</Text>
              <Text style={[styles.overviewAmount, { color: '#EF4444' }]} numberOfLines={1}>
                {formatCurrency(totalSpent, currency)}
              </Text>
            </View>

            <View style={[styles.overviewCard, { borderColor: Colors.primary + '33' }]}>
              <View style={[styles.overviewIcon, { backgroundColor: Colors.primary + '20' }]}>
                <Feather name="credit-card" size={16} color={Colors.primary} />
              </View>
              <Text style={styles.overviewLabel}>Balance</Text>
              <Text style={[styles.overviewAmount, { color: Colors.primary }]} numberOfLines={1}>
                {formatCurrency(balance, currency)}
              </Text>
            </View>
          </View>

          {/* AI Assistant Banner */}
          <TouchableOpacity
            style={styles.aiBanner}
            onPress={() => navigation.navigate('AiAssistant')}
            activeOpacity={0.8}
          >
            <View style={styles.aiIconWrap}>
              <Feather name="cpu" size={16} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.aiBannerTitle}>Ask Aza AI</Text>
              <Text style={styles.aiBannerSub}>Get insights about your spending</Text>
            </View>
            <Feather name="chevron-right" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>

          {/* Donut Chart */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Spending Breakdown</Text>
            {totalSpent === 0 ? (
              <View style={styles.emptyChart}>
                <Text style={styles.emptyText}>No spending data for this period</Text>
              </View>
            ) : (
              <>
                <View style={styles.chartWrap}>
                  <Svg width={CHART_SIZE} height={CHART_SIZE} viewBox={`0 0 ${CHART_SIZE} ${CHART_SIZE}`}>
                    {segments.length === 0 ? (
                      <Circle cx={CX} cy={CX} r={OUTER_R} fill="none" stroke={isDark ? Colors.border : '#E5E7EB'} strokeWidth={OUTER_R - INNER_R} />
                    ) : (
                      segments.map((seg, i) => (
                        <Path
                          key={seg.key}
                          d={arcPath(CX, CX, OUTER_R, INNER_R, seg.start, seg.end)}
                          fill={seg.color}
                        />
                      ))
                    )}
                  </Svg>
                  <View style={styles.chartCenter} pointerEvents="none">
                    <Text style={styles.chartCenterLabel}>Spent</Text>
                    <Text style={styles.chartCenterAmount} numberOfLines={1}>
                      {formatCurrency(totalSpent, currency)}
                    </Text>
                  </View>
                </View>

                {/* Legend */}
                <View style={styles.legendGrid}>
                  {categories.map(cat => {
                    const pct = totalSpent > 0 ? ((cat.total / totalSpent) * 100).toFixed(1) : '0';
                    return (
                      <View key={cat.key} style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: cat.color }]} />
                        <Text style={styles.legendName} numberOfLines={1}>{cat.name}</Text>
                        <Text style={styles.legendPct}>{pct}%</Text>
                      </View>
                    );
                  })}
                </View>
              </>
            )}
          </View>

          {/* Category Breakdown with Budget */}
          {categories.length > 0 && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Category Detail</Text>
              {categories.map((cat, i) => {
                const pct = totalSpent > 0 ? (cat.total / totalSpent) * 100 : 0;
                const budget = budgetData?.find(b => b.category === cat.key);
                const budgetPct = budget?.percentUsed ?? null;
                const isLast = i === categories.length - 1;
                return (
                  <View key={cat.key} style={[styles.catRow, !isLast && styles.catRowBorder]}>
                    <View style={[styles.catIconWrap, { backgroundColor: cat.color + '20' }]}>
                      <Feather name={(CATEGORY_ICON[cat.key] ?? 'grid') as any} size={16} color={cat.color} />
                    </View>
                    <View style={styles.catInfo}>
                      <View style={styles.catNameRow}>
                        <Text style={styles.catName}>{cat.name}</Text>
                        <Text style={styles.catAmount}>{formatCurrency(cat.total, currency)}</Text>
                      </View>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: cat.color }]} />
                      </View>
                      <View style={styles.catMetaRow}>
                        <Text style={styles.catCount}>{cat.count} txn{cat.count !== 1 ? 's' : ''}</Text>
                        {budget?.budgetAmount ? (
                          <Text style={[styles.budgetHint, budgetPct && budgetPct > 90 ? { color: '#EF4444' } : budgetPct && budgetPct > 70 ? { color: '#F59E0B' } : {}]}>
                            {budgetPct?.toFixed(0)}% of budget
                          </Text>
                        ) : null}
                      </View>
                      {budget?.budgetAmount ? (
                        <View style={styles.budgetBarTrack}>
                          <View style={[
                            styles.budgetBarFill,
                            {
                              width: `${Math.min(budgetPct ?? 0, 100)}%` as any,
                              backgroundColor: (budgetPct ?? 0) > 90 ? '#EF4444' : (budgetPct ?? 0) > 70 ? '#F59E0B' : '#34D399',
                            }
                          ]} />
                        </View>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Budget Overview */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Budgets</Text>
              <TouchableOpacity onPress={() => navigation.navigate('BudgetManagement')} activeOpacity={0.7}>
                <Text style={styles.manageLink}>Manage</Text>
              </TouchableOpacity>
            </View>
            {budgetItems.length === 0 ? (
              <View style={styles.noBudget}>
                <Feather name="target" size={24} color={Colors.textSecondary} style={{ marginBottom: 8 }} />
                <Text style={styles.noBudgetText}>No budgets set yet</Text>
                <TouchableOpacity onPress={() => navigation.navigate('BudgetManagement')} style={styles.setBudgetBtn} activeOpacity={0.8}>
                  <Text style={styles.setBudgetText}>Set a budget</Text>
                </TouchableOpacity>
              </View>
            ) : (
              budgetItems.filter(b => !!b.budgetAmount).map((b, i) => {
                const pct = b.percentUsed ?? 0;
                const barColor = pct > 90 ? '#EF4444' : pct > 70 ? '#F59E0B' : '#34D399';
                return (
                  <View key={b.category} style={[styles.budgetRow, i < budgetItems.filter(x => !!x.budgetAmount).length - 1 && styles.catRowBorder]}>
                    <View style={[styles.catIconWrap, { backgroundColor: b.color + '20' }]}>
                      <Feather name={(CATEGORY_ICON[b.category] ?? 'grid') as any} size={16} color={b.color} />
                    </View>
                    <View style={styles.catInfo}>
                      <View style={styles.catNameRow}>
                        <Text style={styles.catName}>{b.categoryName}</Text>
                        <Text style={styles.catAmount}>{formatCurrency(b.spent, currency)} / {formatCurrency(b.budgetAmount!, currency)}</Text>
                      </View>
                      <View style={styles.budgetBarTrack}>
                        <View style={[styles.budgetBarFill, { width: `${Math.min(pct, 100)}%` as any, backgroundColor: barColor }]} />
                      </View>
                      <Text style={[styles.budgetHint, { color: barColor }]}>
                        {pct.toFixed(0)}% used · {formatCurrency(b.remaining ?? 0, currency)} left
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>

        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    },
    headerTitle: { ...Typography.body, fontWeight: '600', color: Colors.textPrimary },
    headerBtn: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: isDark ? Colors.surface : Colors.white,
      borderWidth: 1, borderColor: Colors.border,
      alignItems: 'center', justifyContent: 'center',
    },
    periodRow: {
      flexDirection: 'row', gap: Spacing.xs,
      paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md,
    },
    periodTab: {
      flex: 1, paddingVertical: 8, borderRadius: Radius.lg,
      backgroundColor: isDark ? Colors.surface : '#F3F4F6',
      alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
    },
    periodTabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    periodTabText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
    periodTabTextActive: { color: isDark ? Colors.textPrimary : '#fff' },
    loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl * 2 },

    // Overview cards
    cardsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
    overviewCard: {
      flex: 1, backgroundColor: isDark ? Colors.surface : Colors.white,
      borderRadius: Radius.sm, borderWidth: 1, padding: Spacing.sm,
    },
    overviewIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
    overviewLabel: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary, marginBottom: 2 },
    overviewAmount: { fontSize: 13, fontWeight: '700' },

    // AI Banner
    aiBanner: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: Colors.primary + '12',
      borderRadius: 14, borderWidth: 1, borderColor: Colors.primary + '28',
      paddingHorizontal: Spacing.md, paddingVertical: 12,
      marginBottom: Spacing.lg,
    },
    aiIconWrap: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: Colors.primary + '20',
      alignItems: 'center', justifyContent: 'center',
    },
    aiBannerTitle: { ...Typography.body, fontWeight: '700', color: Colors.textPrimary },
    aiBannerSub: { ...Typography.caption, color: Colors.textSecondary, marginTop: 1 },

    // Section cards
    sectionCard: {
      backgroundColor: isDark ? Colors.surface : Colors.white,
      borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border,
      padding: Spacing.md, marginBottom: Spacing.lg,
    },
    sectionTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
    sectionTitle: { ...Typography.body, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.md },
    manageLink: { fontSize: 13, fontWeight: '600', color: Colors.primary },

    // Chart
    chartWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md, position: 'relative' },
    chartCenter: {
      position: 'absolute', alignItems: 'center', justifyContent: 'center',
      width: INNER_R * 2 - 12, height: INNER_R * 2 - 12,
    },
    chartCenterLabel: { fontSize: 11, color: Colors.textSecondary, fontWeight: '500' },
    chartCenterAmount: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginTop: 2 },
    emptyChart: { height: 100, alignItems: 'center', justifyContent: 'center' },
    emptyText: { ...Typography.body, color: Colors.textSecondary },

    // Legend
    legendGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    legendItem: { flexDirection: 'row', alignItems: 'center', width: '47%', gap: 6 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendName: { flex: 1, fontSize: 12, color: Colors.textSecondary },
    legendPct: { fontSize: 12, fontWeight: '600', color: Colors.textPrimary },

    // Category rows
    catRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: Spacing.sm },
    catRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
    catIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.sm },
    catInfo: { flex: 1 },
    catNameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    catName: { ...Typography.body, fontWeight: '600', color: Colors.textPrimary, fontSize: 13 },
    catAmount: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
    catMetaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
    catCount: { fontSize: 11, color: Colors.textSecondary },
    budgetHint: { fontSize: 11, color: Colors.textSecondary, fontWeight: '500' },
    barTrack: { height: 6, backgroundColor: isDark ? Colors.border : '#F3F4F6', borderRadius: 3, overflow: 'hidden' },
    barFill: { height: 6, borderRadius: 3, minWidth: 4 },
    budgetBarTrack: { height: 4, backgroundColor: isDark ? Colors.border : '#E5E7EB', borderRadius: 2, overflow: 'hidden', marginTop: 6 },
    budgetBarFill: { height: 4, borderRadius: 2 },

    // Budget
    budgetRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: Spacing.sm },
    noBudget: { alignItems: 'center', paddingVertical: Spacing.lg },
    noBudgetText: { ...Typography.body, color: Colors.textSecondary, marginBottom: Spacing.md },
    setBudgetBtn: {
      backgroundColor: Colors.primary, borderRadius: 10,
      paddingHorizontal: Spacing.xl, paddingVertical: 10,
    },
    setBudgetText: { ...Typography.button, color: '#fff', fontWeight: '600' },
  });
}
