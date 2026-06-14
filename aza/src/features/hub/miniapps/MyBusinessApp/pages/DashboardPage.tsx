import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Animated,
  Image,
  ScrollView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@react-native-vector-icons/feather';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../../../theme';
import { useDisplayContext, ACCENT_PALETTES, BANNER_GRADIENTS } from '../../../../../providers/DisplayProvider';
import { NavProps } from '../types';
import { extractData, fmtAmount } from '../helpers';
import { getMerchantReportSummary } from '../../../../../services/api';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../../../lib/queryKeys';
import { CATEGORY_LABELS } from '../constants';
import StatusBadge from '../components/StatusBadge';
import { ActionTarget } from '../../../../home/components/ActionTarget';
import { getAdaptiveForeground } from '../../../../../utils/wallpaperContrast';

const { height } = Dimensions.get('window');

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

export default function DashboardPage({ merchant, navigate }: NavProps) {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const {
    homeBackground, homeDim, homeBlur, homeBannerGradient, accentId, balanceCardStyle,
    homeLayout, balanceHiddenByDefault, reducedMotion, homeBgLuminance
  } = useDisplayContext();

  const animDuration = reducedMotion ? 0 : 300;
  const accentPalette = ACCENT_PALETTES.find(p => p.id === accentId) ?? ACCENT_PALETTES[0];
  const bannerGrad = homeBannerGradient === 'accent'
    ? [accentPalette.primary, accentPalette.gradientEnd]
    : (BANNER_GRADIENTS.find(g => g.id === homeBannerGradient)?.colors ?? [accentPalette.primary, accentPalette.gradientEnd]) as string[];

  // Adaptive foreground: keeps text/icons readable over light wallpapers.
  const onImage = homeLayout === 'default' && !!homeBackground;
  const hasCardBacking = balanceCardStyle === 'card' || balanceCardStyle === 'glass';
  const fg = getAdaptiveForeground({
    luminance: homeBgLuminance,
    dim: homeDim,
    active: onImage,
    cardBacking: hasCardBacking,
  });
    
  const [isBalanceVisible, setIsBalanceVisible] = React.useState(!balanceHiddenByDefault);
  const [isMoreModalVisible, setIsMoreModalVisible] = React.useState(false);
  const moreSheetAnim = React.useRef(new Animated.Value(height)).current;
  const moreBackdropAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (isMoreModalVisible) {
      Animated.parallel([
        Animated.timing(moreSheetAnim, { toValue: 0, duration: animDuration, useNativeDriver: true }),
        Animated.timing(moreBackdropAnim, { toValue: 1, duration: animDuration, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(moreSheetAnim, { toValue: height, duration: animDuration, useNativeDriver: true }),
        Animated.timing(moreBackdropAnim, { toValue: 0, duration: animDuration, useNativeDriver: true }),
      ]).start();
    }
  }, [isMoreModalVisible, moreSheetAnim, moreBackdropAnim]);

  const greeting = getGreeting();
  const feePercent = ((merchant?.feeRateBps ?? 150) / 100).toFixed(2);
  const formattedBalance = fmtAmount(merchant?.balance, merchant?.currency ?? 'GHS');

  const { data: summary } = useQuery({
    queryKey: queryKeys.merchantReportSummary(),
    queryFn: async () => extractData(await getMerchantReportSummary()),
    staleTime: 60_000,
  });

  const statCards = summary ? [
    { label: 'Today', value: fmtAmount(summary.todayRevenue, merchant?.currency ?? 'GHS'), sub: `${summary.todayPayments ?? 0} payments` },
    { label: '7 Days', value: fmtAmount(summary.sevenDayRevenue, merchant?.currency ?? 'GHS'), sub: `${summary.sevenDayPayments ?? 0} payments` },
    { label: '30 Days', value: fmtAmount(summary.thirtyDayRevenue, merchant?.currency ?? 'GHS'), sub: `${Math.round(summary.successRate ?? 0)}% success` },
  ] : [];

  const actionHandlers = [
    { id: 'link', icon: 'link', label: 'Payment Link', onPress: () => navigate('create_session') },
    { id: 'transactions', icon: 'list', label: 'Transactions', onPress: () => navigate('sessions') },
    { id: 'store_qr', icon: 'grid', label: 'Store QR', onPress: () => navigate('store_qr') },
  ];

  const moreActionSections = [
    {
      label: 'Business',
      items: [
        { id: 'invoices', icon: 'file-text', label: 'Invoices', onPress: () => navigate('invoices') },
        { id: 'customers', icon: 'users', label: 'Customers', onPress: () => navigate('customers') },
        { id: 'products', icon: 'package', label: 'Products', onPress: () => navigate('products') },
        { id: 'settlements', icon: 'trending-up', label: 'Settlements', onPress: () => navigate('settlements') },
        { id: 'payouts', icon: 'download', label: 'Payouts', onPress: () => navigate('payouts') },
      ],
    },
    {
      label: 'Manage',
      items: [
        { id: 'plans', icon: 'repeat', label: 'Plans & Subscriptions', onPress: () => navigate('plans') },
        { id: 'disputes', icon: 'shield', label: 'Disputes', onPress: () => navigate('disputes') },
        { id: 'discount_codes', icon: 'tag', label: 'Discount Codes', onPress: () => navigate('discount_codes') },
        { id: 'team', icon: 'users', label: 'Team', onPress: () => navigate('team') },
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
    {
      label: 'Account',
      items: [
        { id: 'settings', icon: 'settings', label: 'Business Settings', onPress: () => navigate('settings') },
      ],
    },
  ];

  const headerRow = (
    <View style={styles.header}>
      <Text style={[Typography.h2, { color: fg.header.text, flex: 1 }]} adjustsFontSizeToFit numberOfLines={1}>
        {`${greeting}${merchant?.businessName ? `, ${merchant.businessName}` : ""}`}
      </Text>
      <View style={styles.headerRight}>
        <View style={styles.profilePicContainer}>
          {merchant?.logoUrl ? (
            <Image source={{ uri: merchant.logoUrl }} style={styles.profilePic} accessibilityLabel="Business logo" />
          ) : (
            <View style={[styles.profilePic, styles.profilePicPlaceholder, { backgroundColor: fg.header.pill }]}>
              <Feather name="briefcase" size={20} color={fg.header.soft} />
            </View>
          )}
        </View>
      </View>
    </View>
  );

  const actionsRow = (
    <View style={styles.actionsRow}>
      {actionHandlers.slice(0, 3).map(a => (
        <ActionTarget key={a.id} icon={a.icon as any} label={a.label} onPress={a.onPress} color={fg.balance.text} circleColor={fg.balance.pill} />
      ))}
      <ActionTarget icon="more-horizontal" label="More" onPress={() => setIsMoreModalVisible(true)} color={fg.balance.text} circleColor={fg.balance.pill} />
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle={fg.tone === 'dark-text' ? 'dark-content' : 'light-content'} backgroundColor="transparent" translucent />

      {homeLayout === 'minimal' ? (
        <View style={[styles.minimalBanner, { backgroundColor: accentPalette.primary }]}>
          <LinearGradient colors={bannerGrad as [string, string]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
          <SafeAreaView edges={['top']}>
            {headerRow}
            <View style={styles.minimalBalanceRow}>
              <View>
                <Text style={[Typography.bodyLg, styles.accountType]}>Merchant Balance</Text>
                <View style={styles.balanceRow}>
                  <Text style={[Typography.h2, styles.balanceText]} numberOfLines={1} adjustsFontSizeToFit>
                    {isBalanceVisible ? formattedBalance : "••••"}
                  </Text>
                  <TouchableOpacity style={styles.eyeIcon} onPress={() => setIsBalanceVisible(!isBalanceVisible)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Feather name={isBalanceVisible ? "eye-off" : "eye"} size={22} color={Colors.white} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
            {actionsRow}
          </SafeAreaView>
        </View>
      ) : (
        <View style={styles.topSection}>
          {homeBackground ? (
            <Image source={{ uri: homeBackground }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <LinearGradient colors={bannerGrad as [string, string]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
          )}
          {homeBlur > 0 && <BlurView intensity={homeBlur} tint="default" style={StyleSheet.absoluteFill} />}
          {homeDim > 0 && <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${homeDim})` }]} />}
          {/* Contrast scrim — guarantees text legibility over busy/bright wallpapers */}
          {onImage && (
            <LinearGradient
              pointerEvents="none"
              colors={fg.scrim}
              locations={[0, 0.5, 1]}
              style={StyleSheet.absoluteFill}
            />
          )}

          <SafeAreaView edges={['top']}>
            {headerRow}

            <View style={[
              balanceCardStyle !== 'flat' && styles.balanceCardWrapper,
              balanceCardStyle === 'card' && styles.balanceCardSolid,
            ]}>
              {balanceCardStyle === 'glass' && (
                <BlurView intensity={22} tint="dark" style={StyleSheet.absoluteFill} />
              )}

              <View style={styles.balanceSection}>
                <Text style={[Typography.bodyLg, styles.accountType, { color: fg.balance.soft }]}>Merchant Balance</Text>
                <View style={styles.balanceRow}>
                  <Text style={[Typography.h1, styles.balanceText, { color: fg.balance.text }]} numberOfLines={1} adjustsFontSizeToFit>
                    {isBalanceVisible ? formattedBalance : "••••"}
                  </Text>
                  <TouchableOpacity style={styles.eyeIcon} onPress={() => setIsBalanceVisible(!isBalanceVisible)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Feather name={isBalanceVisible ? "eye-off" : "eye"} size={Typography.h1.fontSize} color={fg.balance.text} />
                  </TouchableOpacity>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: Spacing.sm }}>
                    <Text style={[Typography.caption, styles.updateTime, { color: fg.balance.soft }]}>Volume: {fmtAmount(merchant?.totalVolume, merchant?.currency ?? 'GHS')}</Text>
                    <Text style={[Typography.caption, styles.updateTime, { color: fg.balance.soft, marginLeft: Spacing.md }]}>Fee: {feePercent}%</Text>
                </View>
              </View>

              {actionsRow}
            </View>
          </SafeAreaView>
        </View>
      )}

      <View style={styles.bottomSection}>
        {statCards.length > 0 && (
          <View style={{ flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md }}>
            {statCards.map((s) => (
              <View
                key={s.label}
                style={{
                  flex: 1, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
                  borderRadius: Radius.md, padding: Spacing.sm,
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {s.label}
                </Text>
                <Text style={{ fontSize: 13, fontWeight: '800', color: Colors.textPrimary, marginTop: 2 }} numberOfLines={1} adjustsFontSizeToFit>
                  {s.value}
                </Text>
                <Text style={{ fontSize: 10, color: Colors.textSecondary, marginTop: 1 }}>{s.sub}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.transactionsHeader}>
          <Text style={[Typography.h3, styles.transactionsTitle]}>
            Business Details
          </Text>
        </View>

        <View style={styles.recentTransactionsList}>
            <View style={[styles.infoCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
              <View style={styles.infoCardHeader}>
                <View style={styles.infoCardHeaderIcon}>
                  <Feather name="briefcase" size={20} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[Typography.h3, styles.infoCardTitle, { color: Colors.textPrimary }]}>{merchant?.businessName}</Text>
                  <Text style={[Typography.body, styles.infoCardHandle, { color: Colors.textSecondary }]}>@{merchant?.businessHandle}</Text>
                </View>
              </View>
              
              <View style={styles.infoCardDivider} />
              
              <View style={styles.infoCardRow}>
                <Text style={[Typography.body, { color: Colors.textSecondary }]}>Category</Text>
                <Text style={[Typography.body, { color: Colors.textPrimary, fontWeight: '500' }]}>
                  {merchant?.category ? (CATEGORY_LABELS[merchant.category as keyof typeof CATEGORY_LABELS] ?? merchant.category) : 'Uncategorized'}
                </Text>
              </View>
              
              <View style={styles.infoCardRow}>
                <Text style={[Typography.body, { color: Colors.textSecondary }]}>Status</Text>
                <StatusBadge status={merchant?.status ?? 'ACTIVE'} Colors={Colors} />
              </View>
            </View>
        </View>
      </View>

      <View style={StyleSheet.absoluteFill} pointerEvents={isMoreModalVisible ? 'auto' : 'none'}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: moreBackdropAnim }]}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setIsMoreModalVisible(false)} />
        </Animated.View>
        <Animated.View style={[styles.bottomSheet, { transform: [{ translateY: moreSheetAnim }] }]}>
          <View style={styles.bottomSheetHandle} />
          <Text style={[Typography.h3, styles.bottomSheetTitle]}>More Options</Text>
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: height * 0.55 }}>
            {moreActionSections.map((section) => (
              <View key={section.label}>
                <Text style={{
                  fontSize: 11, fontWeight: '700', color: Colors.textSecondary,
                  textTransform: 'uppercase', letterSpacing: 0.8,
                  marginBottom: 4, marginTop: 8, paddingHorizontal: 4,
                }}>
                  {section.label}
                </Text>
                {section.items.map(action => (
                  <TouchableOpacity
                    key={action.id}
                    style={styles.bottomSheetItem}
                    onPress={() => { setIsMoreModalVisible(false); action.onPress(); }}
                  >
                    <View style={styles.bottomSheetIcon}>
                      <Feather name={action.icon as any} size={20} color={Colors.textPrimary} />
                    </View>
                    <Text style={[Typography.body, styles.bottomSheetItemText]}>{action.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </ScrollView>
        </Animated.View>
      </View>
    </View>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    topSection: {
      height: height * 0.55,
      backgroundColor: Colors.primary,
    },
    minimalBanner: {
      overflow: 'hidden',
    },
    minimalBalanceRow: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.xs,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
    },
    headerRight: {
      flexDirection: "row",
      alignItems: "center",
    },
    profilePicContainer: {
    },
    profilePic: {
      width: 44,
      height: 44,
      borderRadius: Radius.full,
    },
    profilePicPlaceholder: {
      backgroundColor: "rgba(0,0,0,0.28)",
      justifyContent: "center",
      alignItems: "center",
    },
    balanceCardWrapper: {
      marginHorizontal: Spacing.md,
      marginBottom: Spacing.sm,
      borderRadius: Radius.lg,
      overflow: "hidden",
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.sm,
    },
    balanceCardSolid: {
      backgroundColor: "rgba(0,0,0,0.28)",
    },
    balanceSection: {
      alignItems: "center",
      marginTop: Spacing.xl * 2,
    },
    accountType: {
      color: Colors.white,
      marginBottom: Spacing.xs,
    },
    balanceRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: Spacing.xl,
    },
    balanceText: {
      color: Colors.white,
      flexShrink: 1,
    },
    eyeIcon: {
      marginLeft: Spacing.md,
    },
    updateTime: {
      color: "rgba(255,255,255,0.8)",
    },
    actionsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: Spacing.xl,
      marginTop: Spacing.xl * 2,
    },
    bottomSection: {
      flex: 1,
      backgroundColor: Colors.background,
      marginTop: -Spacing.lg,
      borderTopLeftRadius: Radius.md,
      borderTopRightRadius: Radius.md,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.lg,
    },
    transactionsHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: Spacing.md,
    },
    transactionsTitle: {
      color: Colors.textPrimary,
    },
    recentTransactionsList: {
      marginTop: Spacing.sm,
    },
    infoCard: {
      borderWidth: 1,
      borderRadius: Radius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
    },
    infoCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    infoCardHeaderIcon: {
      width: 48,
      height: 48,
      borderRadius: Radius.full,
      backgroundColor: isDark ? Colors.background : Colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.md,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    infoCardTitle: {
      marginBottom: 2,
    },
    infoCardHandle: {
    },
    infoCardDivider: {
      height: 1,
      backgroundColor: Colors.border,
      marginBottom: Spacing.md,
    },
    infoCardRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    modalOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.5)",
    },
    bottomSheet: {
      backgroundColor: isDark ? Colors.surface : Colors.white,
      borderTopLeftRadius: Radius.lg,
      borderTopRightRadius: Radius.lg,
      padding: Spacing.xl,
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
    },
    bottomSheetHandle: {
      width: 40,
      height: 4,
      backgroundColor: Colors.border,
      borderRadius: Radius.full,
      alignSelf: "center",
      marginBottom: Spacing.lg,
    },
    bottomSheetTitle: {
      color: Colors.textPrimary,
      marginBottom: Spacing.lg,
      textAlign: "center",
    },
    bottomSheetItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: Colors.border,
    },
    bottomSheetIcon: {
      width: 40,
      height: 40,
      borderRadius: Radius.full,
      backgroundColor: isDark ? Colors.background : Colors.surface,
      justifyContent: "center",
      alignItems: "center",
      marginRight: Spacing.md,
    },
    bottomSheetItemText: {
      color: Colors.textPrimary,
      fontWeight: "500",
    },
  });
}
