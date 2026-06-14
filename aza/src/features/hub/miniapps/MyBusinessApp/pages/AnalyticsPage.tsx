import React, { useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { Feather } from '@react-native-vector-icons/feather';
import { Spacing } from '../../../../../theme';
import { NavProps } from '../types';
import { extractData, fmtAmount, fmtDate } from '../helpers';
import { getMerchantAnalytics } from '../../../../../services/api';
import { useQuery } from '@tanstack/react-query';
import InternalHeader from '../components/InternalHeader';

const SCREEN_W = Dimensions.get('window').width;
const BAR_AREA_W = SCREEN_W - Spacing.lg * 2 - 32; // padding

const PERIODS: { label: string; days: number }[] = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
];

interface AnalyticsData {
  days: number;
  todayRevenue: number;
  periodRevenue: number;
  revenueChange: number;
  periodSessionCount: number;
  periodCompletedCount: number;
  completedChange: number;
  conversionRate: number;
  prevConversionRate: number;
  avgOrderValue: number;
  allTimeRevenue: number;
  dailySeries: { date: string; revenue: number; count: number }[];
  topCustomers: { userId: string; displayName: string; totalPaid: number; paymentCount: number }[];
}

function ChangeChip({ pct, Colors }: { pct: number; Colors: NavProps['Colors'] }) {
  const up = pct >= 0;
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 3,
      paddingHorizontal: 7, paddingVertical: 3,
      borderRadius: 99,
      backgroundColor: (up ? '#4ADE80' : '#F87171') + '20',
    }}>
      <Feather name={up ? 'trending-up' : 'trending-down'} size={10} color={up ? '#4ADE80' : '#F87171'} />
      <Text style={{ fontSize: 11, fontWeight: '700', color: up ? '#4ADE80' : '#F87171' }}>
        {up ? '+' : ''}{pct.toFixed(1)}%
      </Text>
    </View>
  );
}

function StatBlock({
  label, value, sub, pct, currency, Colors,
}: {
  label: string; value: string; sub?: string; pct?: number; currency?: string; Colors: NavProps['Colors'];
}) {
  return (
    <View style={{
      flex: 1, backgroundColor: Colors.surface, borderRadius: 14,
      borderWidth: 1, borderColor: Colors.border, padding: 14,
    }}>
      <Text style={{ fontSize: 11, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
        {label}
      </Text>
      <Text style={{ fontSize: 20, fontWeight: '800', color: Colors.textPrimary, fontVariant: ['tabular-nums'], marginBottom: 4 }}>
        {value}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {sub && <Text style={{ fontSize: 11, color: Colors.textSecondary }}>{sub}</Text>}
        {pct !== undefined && <ChangeChip pct={pct} Colors={Colors} />}
      </View>
    </View>
  );
}

function DailyBars({ series, currency, Colors }: {
  series: { date: string; revenue: number; count: number }[];
  currency: string;
  Colors: NavProps['Colors'];
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  if (!series.length) return null;
  const maxRevenue = Math.max(...series.map(s => s.revenue), 1);
  const barW = Math.max(8, Math.floor(BAR_AREA_W / series.length) - 3);

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 80, gap: 3 }}>
        {series.map((s, i) => {
          const h = Math.max(4, Math.round((s.revenue / maxRevenue) * 76));
          const active = hovered === i;
          return (
            <TouchableOpacity
              key={s.date}
              activeOpacity={0.8}
              onPress={() => setHovered(active ? null : i)}
              style={{ width: barW, alignItems: 'center', justifyContent: 'flex-end', height: 80 }}
            >
              <View style={{
                width: barW, height: h, borderRadius: 4,
                backgroundColor: active ? Colors.primary : Colors.primary + '55',
              }} />
            </TouchableOpacity>
          );
        })}
      </View>
      {hovered !== null && series[hovered] && (
        <View style={{
          marginTop: 10, padding: 10, borderRadius: 10,
          backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
        }}>
          <Text style={{ fontSize: 12, color: Colors.textSecondary, marginBottom: 2 }}>
            {fmtDate(series[hovered]!.date)}
          </Text>
          <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.textPrimary }}>
            {fmtAmount(series[hovered]!.revenue, currency)}
          </Text>
          <Text style={{ fontSize: 11, color: Colors.textSecondary }}>
            {series[hovered]!.count} payment{series[hovered]!.count !== 1 ? 's' : ''}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function AnalyticsPage({ merchant, goBack, Colors, styles }: NavProps) {
  const [days, setDays] = useState(30);
  const currency = merchant?.currency ?? 'GHS';

  const { data, isLoading, error } = useQuery<AnalyticsData>({
    queryKey: ['merchantAnalytics', days],
    queryFn: async () => {
      const r = await getMerchantAnalytics(days);
      return extractData(r) as AnalyticsData;
    },
    staleTime: 60_000,
  });

  const periodLabel = PERIODS.find(p => p.days === days)?.label ?? `${days}d`;

  return (
    <ScrollView contentContainerStyle={styles.pageContent}>
      <InternalHeader title="Analytics" onBack={goBack} Colors={Colors} styles={styles} />

      {/* Period picker */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: Spacing.lg }}>
        {PERIODS.map(p => {
          const active = p.days === days;
          return (
            <TouchableOpacity
              key={p.days}
              onPress={() => setDays(p.days)}
              style={{
                paddingHorizontal: 16, paddingVertical: 7,
                borderRadius: 99, borderWidth: 1,
                borderColor: active ? Colors.primary : Colors.border,
                backgroundColor: active ? Colors.primary + '22' : Colors.surface,
              }}
            >
              <Text style={{
                fontSize: 13, fontWeight: '600',
                color: active ? Colors.primary : Colors.textSecondary,
              }}>
                {p.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {isLoading ? (
        <View style={{ paddingVertical: 60, alignItems: 'center' }}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : error ? (
        <View style={{ padding: 20, borderRadius: 12, backgroundColor: Colors.error + '15', alignItems: 'center' }}>
          <Text style={{ color: Colors.error, fontSize: 13 }}>Failed to load analytics</Text>
        </View>
      ) : data ? (
        <>
          {/* KPI row */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
            <StatBlock
              label={`Revenue (${periodLabel})`}
              value={fmtAmount(data.periodRevenue, currency)}
              pct={data.revenueChange}
              Colors={Colors}
            />
            <StatBlock
              label="All Time"
              value={fmtAmount(data.allTimeRevenue, currency)}
              Colors={Colors}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: Spacing.lg }}>
            <StatBlock
              label="Conversion"
              value={`${data.conversionRate.toFixed(1)}%`}
              sub={`${data.periodCompletedCount} paid`}
              pct={data.conversionRate - (data.prevConversionRate ?? 0)}
              Colors={Colors}
            />
            <StatBlock
              label="Avg Order"
              value={fmtAmount(data.avgOrderValue, currency)}
              sub={`${data.periodSessionCount} sessions`}
              Colors={Colors}
            />
          </View>

          {/* Daily revenue chart */}
          {data.dailySeries.length > 0 && (
            <View style={{
              backgroundColor: Colors.surface, borderRadius: 16,
              borderWidth: 1, borderColor: Colors.border,
              padding: 16, marginBottom: Spacing.lg,
            }}>
              <Text style={[styles.sectionLabel, { color: Colors.textPrimary, marginBottom: Spacing.md }]}>
                Daily Revenue ({periodLabel})
              </Text>
              <DailyBars series={data.dailySeries} currency={currency} Colors={Colors} />
            </View>
          )}

          {/* Top customers */}
          {data.topCustomers.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: Colors.textPrimary }]}>Top Customers</Text>
              <View style={styles.rowContainer}>
                {data.topCustomers.map((c, i) => (
                  <View
                    key={c.userId}
                    style={[
                      styles.sessionRow,
                      i < data.topCustomers.length - 1 && { borderBottomWidth: 1, borderBottomColor: Colors.border },
                    ]}
                  >
                    <View style={{
                      width: 32, height: 32, borderRadius: 10,
                      backgroundColor: Colors.primary + '22',
                      alignItems: 'center', justifyContent: 'center', marginRight: 12,
                    }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.primary }}>
                        {(c.displayName || '?').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.textPrimary }}>
                        {c.displayName}
                      </Text>
                      <Text style={{ fontSize: 11, color: Colors.textSecondary }}>
                        {c.paymentCount} payment{c.paymentCount !== 1 ? 's' : ''}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.textPrimary, fontVariant: ['tabular-nums'] }}>
                      {fmtAmount(c.totalPaid, currency)}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </>
      ) : null}
    </ScrollView>
  );
}
