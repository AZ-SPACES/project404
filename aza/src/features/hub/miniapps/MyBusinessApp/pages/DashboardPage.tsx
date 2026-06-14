import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions,
  StatusBar, Animated, Image, ScrollView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@react-native-vector-icons/feather';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../../../theme';
import { useDisplayContext, ACCENT_PALETTES, BANNER_GRADIENTS } from '../../../../../providers/DisplayProvider';
import { NavProps } from '../types';
import { extractData, fmtAmount, fmtDate } from '../helpers';
import { getMerchantReportSummary, getMerchantSessions } from '../../../../../services/api';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../../../lib/queryKeys';
import { CATEGORY_LABELS } from '../constants';
import StatusBadge from '../components/StatusBadge';
import { ActionTarget } from '../../../../home/components/ActionTarget';
import { getAdaptiveForeground } from '../../../../../utils/wallpaperContrast';

const { height } = Dimensions.get('window');
const MONO = 'Courier';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

// ─── Quick action pill ───────────────────────────────────────────────────────

function QuickPill({
  icon, label, onPress, Colors,
}: { icon: string; label: string; onPress: () => void; Colors: ThemeColors }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.72}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 7,
        paddingHorizontal: 14, paddingVertical: 9,
        borderRadius: 99, borderWidth: 1,
        borderColor: Colors.border,
        backgroundColor: Colors.surface,
      }}
    >
      <Feather name={icon as any} size={13} color={Colors.textPrimary} />
      <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.textPrimary }}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Session row (mini) ──────────────────────────────────────────────────────

const SESSION_DOT: Record<string, string> = {
  COMPLETED: '#4ADE80', PENDING: '#FBBF24', CANCELLED: '#F87171',
  EXPIRED: '#9CA3AF', REFUNDED: '#C084FC',
};

function RecentSessionRow({ s, Colors }: { s: any; Colors: ThemeColors }) {
  const dot = SESSION_DOT[s.status] ?? '#9CA3AF';
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: 12, gap: Spacing.sm,
    }}>
      <View style={{
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: dot + '18',
        alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 13, fontWeight: '500', color: Colors.textPrimary }} numberOfLines={1}>
          {s.description ?? 'Payment'}
        </Text>
        <Text style={{ fontSize: 11, color: Colors.textSecondary, marginTop: 1 }}>{fmtDate(s.createdAt)}</Text>
      </View>
      <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.textPrimary, fontFamily: MONO }}>
        {fmtAmount(s.amount, s.currency)}
      </Text>
    </View>
  );
}

// ─── Stat card ───────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent, Colors }: {
  label: string; value: string; sub: string | undefined; accent: boolean | undefined; Colors: ThemeColors;
}) {
  return (
    <View style={{
      flex: 1, borderRadius: 14, borderWidth: 1,
      borderColor: accent ? Colors.primary + '40' : Colors.border,
      backgroundColor: accent ? Colors.primary + '0E' : Colors.surface,
      padding: 12,
    }}>
      <Text style={{
        fontSize: 9, fontWeight: '700', textTransform: 'uppercase',
        letterSpacing: 0.7, color: Colors.textSecondary, marginBottom: 5,
      }}>
        {label}
      </Text>
      <Text style={{
        fontSize: 14, fontWeight: '800', color: accent ? Colors.secondary : Colors.textPrimary,
        fontFamily: MONO, marginBottom: 2,
      }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {sub ? <Text style={{ fontSize: 10, color: Colors.textSecondary }}>{sub}</Text> : null}
    </View>
  );
}

// ─── More sheet section ───────────────────────────────────────────────────────

function SheetSection({
  label, items, onSelect, Colors,
}: {
  label: string;
  items: { id: string; icon: string; label: string; onPress: () => void }[];
  onSelect: () => void;
  Colors: ThemeColors;
}) {
  return (
    <View>
      <Text style={{
        fontSize: 10, fontWeight: '700', color: Colors.textSecondary,
        textTransform: 'uppercase', letterSpacing: 0.8,
        marginBottom: 2, marginTop: 14, paddingHorizontal: 2,
      }}>
        {label}
      </Text>
      {items.map((item, idx) => (
        <TouchableOpacity
          key={item.id}
          onPress={() => { onSelect(); item.onPress(); }}
          activeOpacity={0.65}
          style={{
            flexDirection: 'row', alignItems: 'center',
            paddingVertical: 11,
            borderBottomWidth: idx < items.length - 1 ? StyleSheet.hairlineWidth : 0,
            borderBottomColor: Colors.border,
          }}
        >
          <View style={{
            width: 36, height: 36, borderRadius: 10,
            backgroundColor: Colors.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
            alignItems: 'center', justifyContent: 'center', marginRight: 14,
          }}>
            <Feather name={item.icon as any} size={17} color={Colors.textPrimary} />
          </View>
          <Text style={{ flex: 1, fontSize: 15, fontWeight: '500', color: Colors.textPrimary }}>{item.label}</Text>
          <Feather name="chevron-right" size={15} color={Colors.textSecondary} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function DashboardPage({ merchant, navigate }: NavProps) {
  const { colors: Colors } = useAppTheme();
  const {
    homeBackground, homeDim, homeBlur, homeBannerGradient, accentId,
    balanceCardStyle, homeLayout, balanceHiddenByDefault, reducedMotion, homeBgLuminance,
  } = useDisplayContext();

  const animDuration = reducedMotion ? 0 : 280;
  const accentPalette = ACCENT_PALETTES.find(p => p.id === accentId) ?? ACCENT_PALETTES[0];
  const bannerGrad = homeBannerGradient === 'accent'
    ? [accentPalette.primary, accentPalette.gradientEnd]
    : (BANNER_GRADIENTS.find(g => g.id === homeBannerGradient)?.colors ?? [accentPalette.primary, accentPalette.gradientEnd]) as string[];

  const onImage = homeLayout === 'default' && !!homeBackground;
  const hasCardBacking = balanceCardStyle === 'card' || balanceCardStyle === 'glass';
  const fg = getAdaptiveForeground({ luminance: homeBgLuminance, dim: homeDim, active: onImage, cardBacking: hasCardBacking });

  const [isBalanceVisible, setIsBalanceVisible] = React.useState(!balanceHiddenByDefault);
  const [moreOpen, setMoreOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const sheetAnim = React.useRef(new Animated.Value(height)).current;
  const backdropAnim = React.useRef(new Animated.Value(0)).current;
  const profileSheetAnim = React.useRef(new Animated.Value(height)).current;
  const profileBackdropAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(sheetAnim, { toValue: moreOpen ? 0 : height, duration: animDuration, useNativeDriver: true }),
      Animated.timing(backdropAnim, { toValue: moreOpen ? 1 : 0, duration: animDuration, useNativeDriver: true }),
    ]).start();
  }, [moreOpen]);

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(profileSheetAnim, { toValue: profileOpen ? 0 : height, duration: animDuration, useNativeDriver: true }),
      Animated.timing(profileBackdropAnim, { toValue: profileOpen ? 1 : 0, duration: animDuration, useNativeDriver: true }),
    ]).start();
  }, [profileOpen]);

  const feePercent = ((merchant?.feeRateBps ?? 150) / 100).toFixed(2);
  const balance = fmtAmount(merchant?.balance, merchant?.currency ?? 'GHS');

  const { data: summary } = useQuery({
    queryKey: queryKeys.merchantReportSummary(),
    queryFn: async () => extractData(await getMerchantReportSummary()),
    staleTime: 60_000,
  });

  const { data: recentSessions = [] } = useQuery({
    queryKey: [...queryKeys.merchantSessions(), 'recent'],
    queryFn: async () => { const r = await getMerchantSessions(0, 5); return extractData(r)?.content ?? []; },
    staleTime: 60_000,
  });

  const statCards: { label: string; value: string; sub?: string; accent?: boolean }[] = summary ? [
    { label: 'Today', value: fmtAmount(summary.todayRevenue, merchant?.currency ?? 'GHS'), sub: `${summary.todayPayments ?? 0} payments` },
    { label: '7 Days', value: fmtAmount(summary.sevenDayRevenue, merchant?.currency ?? 'GHS'), sub: `${summary.sevenDayPayments ?? 0} payments`, accent: true },
    { label: '30 Days', value: fmtAmount(summary.thirtyDayRevenue, merchant?.currency ?? 'GHS'), sub: `${Math.round(summary.successRate ?? 0)}% success` },
  ] : [];

  const quickLinks = [
    { id: 'link', icon: 'link', label: 'New Link', onPress: () => navigate('create_session') },
    { id: 'transactions', icon: 'list', label: 'Transactions', onPress: () => navigate('sessions') },
    { id: 'qr', icon: 'grid', label: 'Store QR', onPress: () => navigate('store_qr') },
  ];

  // "More" sheet — business operations only
  const moreSections = [
    {
      label: 'Business',
      items: [
        { id: 'invoices', icon: 'file-text', label: 'Invoices', onPress: () => navigate('invoices') },
        { id: 'customers', icon: 'users', label: 'Customers', onPress: () => navigate('customers') },
        { id: 'products', icon: 'package', label: 'Products', onPress: () => navigate('products') },
        { id: 'payouts', icon: 'download', label: 'Payouts', onPress: () => navigate('payouts') },
        { id: 'settlements', icon: 'trending-up', label: 'Settlements', onPress: () => navigate('settlements') },
      ],
    },
    {
      label: 'Manage',
      items: [
        { id: 'plans', icon: 'repeat', label: 'Plans & Subscriptions', onPress: () => navigate('plans') },
        { id: 'disputes', icon: 'shield', label: 'Disputes', onPress: () => navigate('disputes') },
        { id: 'discount_codes', icon: 'tag', label: 'Discount Codes', onPress: () => navigate('discount_codes') },
      ],
    },
  ];

  // Profile sheet — account, settings, dev
  const profileSections = [
    {
      label: 'Account',
      items: [
        { id: 'settings', icon: 'settings', label: 'Business Settings', onPress: () => navigate('settings') },
        { id: 'team', icon: 'users', label: 'Team Members', onPress: () => navigate('team') },
        { id: 'audit_logs', icon: 'clipboard', label: 'Audit Log', onPress: () => navigate('audit_logs') },
      ],
    },
    {
      label: 'Developer',
      items: [
        { id: 'api_keys', icon: 'key', label: 'API Keys', onPress: () => navigate('api_keys') },
        { id: 'webhooks', icon: 'zap', label: 'Webhooks', onPress: () => navigate('webhooks') },
      ],
    },
  ];

  const headerRow = (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: Spacing.md }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 12, color: fg.header.soft, fontWeight: '500', marginBottom: 1 }}>{getGreeting()}</Text>
        <Text style={{ fontSize: 18, fontWeight: '800', color: fg.header.text }} numberOfLines={1} adjustsFontSizeToFit>
          {merchant?.businessName ?? 'My Business'}
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => setProfileOpen(true)}
        activeOpacity={0.72}
        style={{
          width: 44, height: 44, borderRadius: 14,
          backgroundColor: 'rgba(0,0,0,0.22)',
          overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
        }}
      >
        {merchant?.logoUrl ? (
          <Image source={{ uri: merchant.logoUrl }} style={{ width: 44, height: 44 }} />
        ) : (
          <Feather name="briefcase" size={20} color={fg.header.soft} />
        )}
      </TouchableOpacity>
    </View>
  );

  const actionsRow = (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing.xl, marginTop: Spacing.xl * 2 }}>
      {quickLinks.map(a => (
        <ActionTarget key={a.id} icon={a.icon as any} label={a.label} onPress={a.onPress} color={fg.balance.text} circleColor={fg.balance.pill} />
      ))}
      <ActionTarget icon="more-horizontal" label="More" onPress={() => setMoreOpen(true)} color={fg.balance.text} circleColor={fg.balance.pill} />
    </View>
  );

  const businessCategory = merchant?.category
    ? (CATEGORY_LABELS[merchant.category as keyof typeof CATEGORY_LABELS] ?? merchant.category)
    : null;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <StatusBar barStyle={fg.tone === 'dark-text' ? 'dark-content' : 'light-content'} backgroundColor="transparent" translucent />

      {/* ── Hero section ───────────────────────────────────────────────────── */}
      {homeLayout === 'minimal' ? (
        <View style={{ backgroundColor: accentPalette.primary, overflow: 'hidden' }}>
          <LinearGradient colors={bannerGrad as [string, string]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
          <SafeAreaView edges={['top']}>
            {headerRow}
            <View style={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.xs }}>
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginBottom: 2 }}>Merchant Balance</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 26, fontWeight: '800', color: '#fff', fontFamily: MONO }}>
                  {isBalanceVisible ? balance : '••••'}
                </Text>
                <TouchableOpacity onPress={() => setIsBalanceVisible(v => !v)} style={{ marginLeft: 10 }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Feather name={isBalanceVisible ? 'eye-off' : 'eye'} size={20} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
              </View>
            </View>
            {actionsRow}
          </SafeAreaView>
        </View>
      ) : (
        <View style={{ height: height * 0.52, backgroundColor: accentPalette.primary }}>
          {homeBackground ? (
            <Image source={{ uri: homeBackground }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <LinearGradient colors={bannerGrad as [string, string]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
          )}
          {homeBlur > 0 && <BlurView intensity={homeBlur} tint="default" style={StyleSheet.absoluteFill} />}
          {homeDim > 0 && <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${homeDim})` }]} />}
          {onImage && (
            <LinearGradient pointerEvents="none" colors={fg.scrim} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
          )}

          <SafeAreaView edges={['top']}>
            {headerRow}
            <View style={[
              balanceCardStyle !== 'flat' && {
                marginHorizontal: Spacing.md, marginBottom: Spacing.sm,
                borderRadius: Radius.lg, overflow: 'hidden' as const,
                paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm,
              },
              balanceCardStyle === 'card' && { backgroundColor: 'rgba(0,0,0,0.28)' },
            ]}>
              {balanceCardStyle === 'glass' && (
                <BlurView intensity={22} tint="dark" style={StyleSheet.absoluteFill} />
              )}
              <View style={{ alignItems: 'center', marginTop: Spacing.xl * 2 }}>
                <Text style={{ fontSize: 12, color: fg.balance.soft, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  Merchant Balance
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.xl }}>
                  <Text style={{ fontSize: 34, fontWeight: '800', color: fg.balance.text, fontFamily: MONO, flexShrink: 1 }} numberOfLines={1} adjustsFontSizeToFit>
                    {isBalanceVisible ? balance : '••••'}
                  </Text>
                  <TouchableOpacity onPress={() => setIsBalanceVisible(v => !v)} style={{ marginLeft: Spacing.md }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Feather name={isBalanceVisible ? 'eye-off' : 'eye'} size={22} color={fg.balance.text} />
                  </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', gap: Spacing.lg, marginTop: Spacing.sm }}>
                  <Text style={{ fontSize: 11, color: fg.balance.soft }}>
                    Volume: {fmtAmount(merchant?.totalVolume, merchant?.currency ?? 'GHS')}
                  </Text>
                  <Text style={{ fontSize: 11, color: fg.balance.soft }}>
                    Fee: {feePercent}%
                  </Text>
                </View>
              </View>
              {actionsRow}
            </View>
          </SafeAreaView>
        </View>
      )}

      {/* ── Bottom section ─────────────────────────────────────────────────── */}
      <ScrollView
        style={{ flex: 1, marginTop: -16, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: Colors.background }}
        contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.xl * 3 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Stat cards */}
        {statCards.length > 0 && (
          <View style={{ flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg }}>
            {statCards.map(s => (
              <StatCard key={s.label} label={s.label} value={s.value} sub={s.sub} accent={s.accent} Colors={Colors} />
            ))}
          </View>
        )}

        {/* Quick links scrollable row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.lg }} contentContainerStyle={{ gap: Spacing.sm }}>
          <QuickPill icon="link" label="Payment Link" onPress={() => navigate('create_session')} Colors={Colors} />
          <QuickPill icon="users" label="Customers" onPress={() => navigate('customers')} Colors={Colors} />
          <QuickPill icon="package" label="Products" onPress={() => navigate('products')} Colors={Colors} />
          <QuickPill icon="shield" label="Disputes" onPress={() => navigate('disputes')} Colors={Colors} />
          <QuickPill icon="download" label="Payouts" onPress={() => navigate('payouts')} Colors={Colors} />
          <QuickPill icon="file-text" label="Invoices" onPress={() => navigate('invoices')} Colors={Colors} />
        </ScrollView>

        {/* Recent activity */}
        <View style={{ marginBottom: Spacing.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.textPrimary }}>Recent Activity</Text>
            <TouchableOpacity onPress={() => navigate('sessions')}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.secondary }}>See all</Text>
            </TouchableOpacity>
          </View>

          <View style={{
            borderRadius: 16, borderWidth: 1, borderColor: Colors.border,
            backgroundColor: Colors.surface, overflow: 'hidden',
          }}>
            {recentSessions.length === 0 ? (
              <View style={{ paddingVertical: 28, alignItems: 'center', gap: 8 }}>
                <Feather name="inbox" size={24} color={Colors.textSecondary} style={{ opacity: 0.4 }} />
                <Text style={{ fontSize: 13, color: Colors.textSecondary }}>No transactions yet</Text>
              </View>
            ) : (
              recentSessions.slice(0, 5).map((s: any, idx: number) => (
                <View key={s.id} style={[
                  { paddingHorizontal: Spacing.md },
                  idx < recentSessions.slice(0, 5).length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
                  },
                ]}>
                  <RecentSessionRow s={s} Colors={Colors} />
                </View>
              ))
            )}
          </View>
        </View>

        {/* Business info card */}
        <View style={{ borderRadius: 16, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, overflow: 'hidden' }}>
          <View style={{ paddingHorizontal: Spacing.md, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border }}>
            <View style={{
              width: 42, height: 42, borderRadius: 12,
              backgroundColor: Colors.primary + '22',
              alignItems: 'center', justifyContent: 'center',
              borderWidth: 1, borderColor: Colors.primary + '30',
            }}>
              <Feather name="briefcase" size={18} color={Colors.secondary} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.textPrimary }} numberOfLines={1}>
                {merchant?.businessName}
              </Text>
              <Text style={{ fontSize: 12, color: Colors.textSecondary }}>@{merchant?.businessHandle}</Text>
            </View>
            <StatusBadge status={merchant?.status ?? 'ACTIVE'} Colors={Colors} />
          </View>
          {[
            { label: 'Category', value: businessCategory ?? 'Uncategorized' },
            { label: 'Fee rate', value: `${feePercent}%` },
            { label: 'Total volume', value: fmtAmount(merchant?.totalVolume, merchant?.currency ?? 'GHS') },
          ].map((row, idx, arr) => (
            <View key={row.label} style={{
              paddingHorizontal: Spacing.md, paddingVertical: 13,
              flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              borderBottomWidth: idx < arr.length - 1 ? StyleSheet.hairlineWidth : 0,
              borderBottomColor: Colors.border,
            }}>
              <Text style={{ fontSize: 13, color: Colors.textSecondary }}>{row.label}</Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.textPrimary }}>{row.value}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* ── "More" bottom sheet ─────────────────────────────────────────────── */}
      <View style={StyleSheet.absoluteFill} pointerEvents={moreOpen ? 'auto' : 'none'}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropAnim }]}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} activeOpacity={1} onPress={() => setMoreOpen(false)} />
        </Animated.View>
        <Animated.View style={[{
          backgroundColor: Colors.isDark ? '#1A1A1A' : Colors.white,
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: Colors.border,
          paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl,
          position: 'absolute', bottom: 0, left: 0, right: 0,
        }, { transform: [{ translateY: sheetAnim }] }]}>
          <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 6 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border }} />
          </View>
          <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center', marginBottom: 4 }}>
            More
          </Text>
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: height * 0.48 }}>
            {moreSections.map(section => (
              <SheetSection
                key={section.label}
                label={section.label}
                items={section.items}
                onSelect={() => setMoreOpen(false)}
                Colors={Colors}
              />
            ))}
            <View style={{ height: Spacing.xl }} />
          </ScrollView>
        </Animated.View>
      </View>

      {/* ── Profile / account sheet ─────────────────────────────────────────── */}
      <View style={StyleSheet.absoluteFill} pointerEvents={profileOpen ? 'auto' : 'none'}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: profileBackdropAnim }]}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} activeOpacity={1} onPress={() => setProfileOpen(false)} />
        </Animated.View>
        <Animated.View style={[{
          backgroundColor: Colors.isDark ? '#1A1A1A' : Colors.white,
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: Colors.border,
          paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl,
          position: 'absolute', bottom: 0, left: 0, right: 0,
        }, { transform: [{ translateY: profileSheetAnim }] }]}>
          <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 10 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border }} />
          </View>

          {/* Business identity header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border, marginBottom: 4 }}>
            <View style={{
              width: 48, height: 48, borderRadius: 14,
              backgroundColor: Colors.primary + '22',
              alignItems: 'center', justifyContent: 'center',
              borderWidth: 1, borderColor: Colors.primary + '30',
              overflow: 'hidden',
            }}>
              {merchant?.logoUrl
                ? <Image source={{ uri: merchant.logoUrl }} style={{ width: 48, height: 48 }} />
                : <Feather name="briefcase" size={20} color={Colors.secondary} />
              }
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.textPrimary }} numberOfLines={1}>
                {merchant?.businessName}
              </Text>
              <Text style={{ fontSize: 12, color: Colors.textSecondary }}>@{merchant?.businessHandle}</Text>
            </View>
            <StatusBadge status={merchant?.status ?? 'ACTIVE'} Colors={Colors} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: height * 0.42 }}>
            {profileSections.map(section => (
              <SheetSection
                key={section.label}
                label={section.label}
                items={section.items}
                onSelect={() => setProfileOpen(false)}
                Colors={Colors}
              />
            ))}
            <View style={{ height: Spacing.xl }} />
          </ScrollView>
        </Animated.View>
      </View>
    </View>
  );
}
