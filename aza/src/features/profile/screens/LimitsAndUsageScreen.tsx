import React from 'react';
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
import { Feather } from '@react-native-vector-icons/feather';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { RootStackParamList } from '../../../navigation/types';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';
import { BackButton } from '../../../components/ui/BackButton';
import { queryKeys } from '../../../lib/queryKeys';
import { getUserLimits, getTodaySent } from '../../../services/api';
import { formatCurrency } from '../../../utils/transactionUtils';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'LimitsAndUsage'>;

const FEE_ROWS = [
  { label: 'Send money',          value: 'Free' },
  { label: 'Receive money',       value: 'Free' },
  { label: 'Cash withdrawal',     value: 'Free' },
  { label: 'Account maintenance', value: 'Free' },
];

function UsageBar({ used, total, color }: { used: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min(used / total, 1) : 0;
  const { colors: Colors } = useAppTheme();
  return (
    <View style={{ height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden', marginTop: 8 }}>
      <View style={{ height: 6, width: `${pct * 100}%` as any, backgroundColor: color, borderRadius: 3 }} />
    </View>
  );
}

export default function LimitsAndUsageScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();

  const { data: limitsData, isLoading: limitsLoading } = useQuery({
    queryKey: queryKeys.userLimits(),
    queryFn: async () => { const res = await getUserLimits(); return res.data?.data || res.data; },
    staleTime: 5 * 60_000,
  });

  const { data: todayData, isLoading: todayLoading } = useQuery({
    queryKey: queryKeys.todaySent(),
    queryFn: async () => { const res = await getTodaySent(); return res.data?.data || res.data; },
    staleTime: 60_000,
  });

  const isLoading = limitsLoading || todayLoading;
  const dailyLimit: number = limitsData?.dailyLimitGhs ?? 0;
  const singleLimit: number = limitsData?.singleTransactionLimitGhs ?? 0;
  const sentToday: number = todayData?.sentToday ?? 0;
  const dailyRemaining = Math.max(dailyLimit - sentToday, 0);
  const usagePct = dailyLimit > 0 ? sentToday / dailyLimit : 0;
  const barColor = usagePct >= 0.9 ? '#EF4444' : usagePct >= 0.6 ? '#F59E0B' : Colors.primary;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" />

      {/* Header */}
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Fees & Limits</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.loader}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : (
          <>
            {/* Today's usage */}
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>Today's Usage</Text>
              <View style={styles.usageRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.usageMain}>{formatCurrency(sentToday, 'GHS')}</Text>
                  <Text style={styles.usageSub}>sent today</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.usageMain}>{formatCurrency(dailyRemaining, 'GHS')}</Text>
                  <Text style={styles.usageSub}>remaining</Text>
                </View>
              </View>
              <UsageBar used={sentToday} total={dailyLimit} color={barColor} />
              <Text style={styles.limitCaption}>
                Daily limit: {formatCurrency(dailyLimit, 'GHS')}
              </Text>
            </View>

            {/* Limits */}
            <Text style={styles.groupLabel}>Your limits</Text>
            <View style={styles.tableCard}>
              <View style={styles.tableRow}>
                <Text style={styles.tableLabel}>Max per transaction</Text>
                <Text style={styles.tableValue}>{formatCurrency(singleLimit, 'GHS')}</Text>
              </View>
              <View style={[styles.tableRow, styles.tableRowLast]}>
                <Text style={styles.tableLabel}>Max per day</Text>
                <Text style={styles.tableValue}>{formatCurrency(dailyLimit, 'GHS')}</Text>
              </View>
            </View>

            {/* Fees */}
            <Text style={styles.groupLabel}>Transaction fees</Text>
            <View style={styles.tableCard}>
              {FEE_ROWS.map((row, i) => (
                <View
                  key={row.label}
                  style={[styles.tableRow, i === FEE_ROWS.length - 1 && styles.tableRowLast]}
                >
                  <Text style={styles.tableLabel}>{row.label}</Text>
                  <Text style={[styles.tableValue, styles.freeValue]}>{row.value}</Text>
                </View>
              ))}
            </View>

            {/* Request increase */}
            <Text style={styles.groupLabel}>Need higher limits?</Text>
            <TouchableOpacity
              style={styles.requestCard}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('LimitIncreaseRequest')}
            >
              <View style={styles.requestIcon}>
                <Feather name="trending-up" size={20} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.requestTitle}>Request a limit increase</Text>
                <Text style={styles.requestSub}>We'll review your request within 2 business days</Text>
              </View>
              <Feather name="chevron-right" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>

            <View style={styles.legalNote}>
              <Feather name="info" size={14} color={Colors.textSecondary} />
              <Text style={styles.legalText}>
                Limits are set per your account profile in accordance with Bank of Ghana
                regulations (Act 987) and may be adjusted by aza with 30 days' notice.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
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
    content: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.xl,
    },
    loader: {
      paddingTop: 60,
      alignItems: 'center',
    },

    // Today's usage card
    card: {
      backgroundColor: isDark ? Colors.surface : Colors.white,
      borderRadius: Radius.sm,
      padding: Spacing.lg,
      borderWidth: 1,
      borderColor: Colors.border,
      marginTop: Spacing.md,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: Colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: Spacing.sm,
    },
    usageRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
    },
    usageMain: {
      fontSize: 22,
      fontWeight: '700',
      color: Colors.textPrimary,
    },
    usageSub: {
      fontSize: 12,
      color: Colors.textSecondary,
      marginTop: 2,
    },
    limitCaption: {
      fontSize: 12,
      color: Colors.textSecondary,
      marginTop: Spacing.sm,
    },

    // Group label
    groupLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: Colors.textSecondary,
      marginTop: Spacing.xl,
      marginBottom: Spacing.sm,
    },

    // Table card
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
    tableLabel: {
      ...Typography.body,
      color: Colors.textPrimary,
    },
    tableValue: {
      ...Typography.body,
      fontWeight: '600',
      color: Colors.textPrimary,
    },
    freeValue: {
      color: '#16a34a',
    },

    // Request card
    requestCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      backgroundColor: isDark ? Colors.surface : Colors.white,
      borderRadius: Radius.sm,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    requestIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: isDark ? 'rgba(183,238,122,0.15)' : '#EAF5E9',
      alignItems: 'center',
      justifyContent: 'center',
    },
    requestTitle: {
      ...Typography.body,
      fontWeight: '600',
      color: Colors.textPrimary,
    },
    requestSub: {
      ...Typography.caption,
      color: Colors.textSecondary,
      marginTop: 2,
    },

    // Legal note
    legalNote: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
      marginTop: Spacing.xl,
      paddingHorizontal: Spacing.xs,
    },
    legalText: {
      flex: 1,
      fontSize: 13,
      color: Colors.textSecondary,
      lineHeight: 18,
    },
  });
}
