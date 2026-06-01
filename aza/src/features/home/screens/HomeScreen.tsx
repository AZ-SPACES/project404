import React, { ComponentProps } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  ActivityIndicator,
  Animated,
  ScrollView,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from '@react-native-vector-icons/feather';
import {
  useAppTheme,
  ThemeColors,
  Typography,
  Spacing,
  Radius,
} from "../../../theme";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";
import { useDisplayContext, ACCENT_PALETTES, BANNER_GRADIENTS, QUICK_ACTIONS_REGISTRY, QuickActionId } from "../../../providers/DisplayProvider";
import { useProfile } from "../../../providers/ProfileProvider";
import { useNotificationCountQuery } from "../../notifications/hooks/useNotificationQueries";
import { TransactionItem } from "../../../components/ui/TransactionItem";
import { ActionTarget } from "../components/ActionTarget";
import { useWallet } from "../../../hooks/useWallet";
import { cancelTransfer } from "../../../services/api";
import { formatCurrency } from "../../../utils/transactionUtils";
import { queryClient } from "../../../lib/queryClient";
import { queryKeys } from "../../../lib/queryKeys";

const { height } = Dimensions.get("window");


function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

export default function HomeScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    homeBackground, homeDim, homeBlur, homeBannerGradient, accentId, balanceCardStyle,
    homeLayout, balanceHiddenByDefault, reducedMotion, quickActions,
  } = useDisplayContext();
  const animDuration = reducedMotion ? 0 : 300;
  const accentPalette = ACCENT_PALETTES.find(p => p.id === accentId) ?? ACCENT_PALETTES[0];
  const bannerGrad = homeBannerGradient === 'accent'
    ? [accentPalette.primary, accentPalette.gradientEnd]
    : (BANNER_GRADIENTS.find(g => g.id === homeBannerGradient)?.colors ?? [accentPalette.primary, accentPalette.gradientEnd]) as string[];
  const { handle, firstName, profileImageUri } = useProfile();
  const displayName = firstName || handle;

  const [isBalanceVisible, setIsBalanceVisible] = React.useState(!balanceHiddenByDefault);
  const { wallet, recentTransactions, loading, refreshing, refresh, error } = useWallet();
  const { data: unreadCount = 0 } = useNotificationCountQuery();
  const [isMoreModalVisible, setIsMoreModalVisible] = React.useState(false);

  useFocusEffect(
    React.useCallback(() => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notificationCount() });
    }, [])
  );

  const incompleteTransfer = React.useMemo(() => {
    return recentTransactions.find(
      (tx) => tx.isPending && !tx.isCredit && tx.type === "Transfer"
    );
  }, [recentTransactions]);

  const displayTransactions = React.useMemo(() => {
    if (!incompleteTransfer) return recentTransactions;
    return recentTransactions.filter((tx) => tx.id !== incompleteTransfer.id);
  }, [recentTransactions, incompleteTransfer]);

  const handleCancelIncomplete = React.useCallback(async (txId: string) => {
    try {
      await cancelTransfer(txId);
      refresh();
    } catch (err) {
      console.error("Failed to cancel incomplete transfer", err);
    }
  }, [refresh]);

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

  useFocusEffect(
    React.useCallback(() => {
      if (!isMoreModalVisible) {
        moreSheetAnim.setValue(height);
        moreBackdropAnim.setValue(0);
      }
    }, [isMoreModalVisible, moreSheetAnim, moreBackdropAnim])
  );

  const [lastUpdated, setLastUpdated] = React.useState(new Date());
  const [updateText, setUpdateText] = React.useState("Updated just now");

  React.useEffect(() => {
    if (!loading && !refreshing) {
      setLastUpdated(new Date());
    }
  }, [loading, refreshing]);

  React.useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const diffInSeconds = Math.floor(
        (now.getTime() - lastUpdated.getTime()) / 1000
      );

      if (diffInSeconds < 5) {
        setUpdateText("Updated just now");
      } else if (diffInSeconds < 60) {
        setUpdateText(`Updated ${diffInSeconds}s ago`);
      } else if (diffInSeconds < 3600) {
        setUpdateText(`Updated ${Math.floor(diffInSeconds / 60)}m ago`);
      } else {
        setUpdateText(`Updated ${Math.floor(diffInSeconds / 3600)}h ago`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 5000);

    return () => clearInterval(interval);
  }, [lastUpdated]);

  const onRefresh = React.useCallback(() => {
    refresh();
  }, [refresh]);

  const greeting = getGreeting();

  const actionHandlers = React.useMemo<Record<QuickActionId, { icon: string; label: string; onPress: () => void }>>(() => ({
    send:      { icon: 'arrow-up',    label: 'Send',      onPress: () => navigation.navigate('Send') },
    request:   { icon: 'arrow-down',  label: 'Request',   onPress: () => navigation.navigate('Receive') },
    details:   { icon: 'credit-card', label: 'Spending',   onPress: () => navigation.navigate('Details') },
    withdraw:  { icon: 'log-out',     label: 'Withdraw',  onPress: () => navigation.navigate('Withdraw') },
    topup:     { icon: 'plus-circle', label: 'Top Up',    onPress: () => navigation.navigate('Receive') },
    statement: { icon: 'file-text',   label: 'Statement', onPress: () => navigation.navigate('StatementDownload') },
  }), [navigation]);

  // Shared header row used by both layouts
  const headerRow = (
    <View style={styles.header}>
      <Text style={[Typography.h2, { color: Colors.white }]} adjustsFontSizeToFit numberOfLines={1}>
        {`${greeting}${displayName ? `, ${displayName}` : ""}`}
      </Text>
      <View style={styles.headerRight}>
        <TouchableOpacity style={styles.profilePicContainer} onPress={() => navigation.navigate("Profile")} accessibilityLabel="Open profile">
          {profileImageUri ? (
            <Image source={{ uri: profileImageUri }} style={styles.profilePic} accessibilityLabel="Profile photo" />
          ) : (
            <View style={[styles.profilePic, styles.profilePicPlaceholder]}>
              <Feather name="user" size={20} color="rgba(255,255,255,0.8)" />
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.bellButton} onPress={() => navigation.navigate("Inbox")} accessibilityLabel="Open notifications">
          <Feather name="bell" size={24} color={Colors.white} />
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  // Dynamic quick actions
  const actionsRow = (
    <View style={styles.actionsRow}>
      {quickActions.slice(0, 3).map(id => {
        const a = actionHandlers[id];
        return <ActionTarget key={id} icon={a.icon as any} label={a.label} onPress={a.onPress} />;
      })}
      <ActionTarget icon="more-horizontal" label="More" onPress={() => setIsMoreModalVisible(true)} />
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {homeLayout === 'minimal' ? (
        /* ── Minimal layout: compact accent-color header ── */
        <View style={[styles.minimalBanner, { backgroundColor: accentPalette.primary }]}>
          <LinearGradient colors={bannerGrad as [string, string]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
          <SafeAreaView>
            {headerRow}
            <View style={styles.minimalBalanceRow}>
              <View>
                <Text style={[Typography.bodyLg, styles.accountType]}>Main • {wallet?.currency}</Text>
                <View style={styles.balanceRow}>
                  {loading && !wallet ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <Text style={[Typography.h2, styles.balanceText]} numberOfLines={1} adjustsFontSizeToFit>
                      {isBalanceVisible ? (wallet?.formattedBalance || formatCurrency(0, wallet?.currency)) : "••••"}
                    </Text>
                  )}
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
        /* ── Default layout: full banner ── */
        <View style={styles.topSection}>
          {homeBackground ? (
            <Image source={{ uri: homeBackground }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <LinearGradient colors={bannerGrad as [string, string]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
          )}
          {homeBlur > 0 && <BlurView intensity={homeBlur} tint="default" style={StyleSheet.absoluteFill} />}
          {homeDim > 0 && <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${homeDim})` }]} />}

          <SafeAreaView>
            {headerRow}

            {/* Balance + Actions — wrapped in optional card */}
            <View style={[
              balanceCardStyle !== 'flat' && styles.balanceCardWrapper,
              balanceCardStyle === 'card' && styles.balanceCardSolid,
            ]}>
              {balanceCardStyle === 'glass' && (
                <BlurView intensity={22} tint="dark" style={StyleSheet.absoluteFill} />
              )}

              <View style={styles.balanceSection}>
                <Text style={[Typography.bodyLg, styles.accountType]}>Main • {wallet?.currency}</Text>
                <View style={styles.balanceRow}>
                  {loading && !wallet ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <Text style={[Typography.h1, styles.balanceText]} numberOfLines={1} adjustsFontSizeToFit>
                      {isBalanceVisible ? (wallet?.formattedBalance || formatCurrency(0, wallet?.currency)) : "••••"}
                    </Text>
                  )}
                  <TouchableOpacity style={styles.eyeIcon} accessibilityLabel="Toggle balance visibility" onPress={() => setIsBalanceVisible(!isBalanceVisible)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Feather name={isBalanceVisible ? "eye-off" : "eye"} size={Typography.h1.fontSize} color={Colors.white} />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={{ flexDirection: "row", alignItems: "center" }} onPress={onRefresh} disabled={refreshing} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Text style={[Typography.caption, styles.updateTime]}>{updateText}</Text>
                  {refreshing ? (
                    <ActivityIndicator size="small" color="rgba(255,255,255,0.8)" style={{ marginLeft: 6, marginTop: Spacing.sm, transform: [{ scale: 0.6 }] }} />
                  ) : (
                    <Feather name="refresh-cw" size={12} color="rgba(255,255,255,0.8)" style={{ marginLeft: 6, marginTop: Spacing.sm }} />
                  )}
                </TouchableOpacity>
              </View>

              {actionsRow}
            </View>
          </SafeAreaView>
        </View>
      )}

      <View style={styles.bottomSection}>
        <View style={styles.transactionsHeader}>
          <Text style={[Typography.h3, styles.transactionsTitle]}>
            Transactions
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity onPress={() => navigation.navigate("SpendingCategories" as any)}>
              <Text style={[Typography.body, styles.seeAllText, { fontSize: 13 }]}>By category</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate("Transactions", { balance: wallet?.formattedBalance || formatCurrency(0, wallet?.currency) })}>
              <Text style={[Typography.body, styles.seeAllText]}>See all</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Resume Incomplete Transfer Card */}
        {incompleteTransfer && (
          <View style={styles.incompleteCard}>
            <View style={styles.incompleteCardHeader}>
              <View style={styles.incompleteTextContainer}>
                <Text style={styles.incompleteCardTitle}>Resume your transfer</Text>
                <Text style={styles.incompleteCardSubtitle}>
                  You started sending {formatCurrency(incompleteTransfer.amount)} to {incompleteTransfer.name}.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleCancelIncomplete(incompleteTransfer.id)}
                style={styles.incompleteDismissBtn}
                accessibilityLabel="Dismiss incomplete transfer"
              >
                <Feather name="x" size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.incompleteActionsRow}>
              <TouchableOpacity
                style={styles.incompleteCancelBtn}
                onPress={() => handleCancelIncomplete(incompleteTransfer.id)}
              >
                <Text style={styles.incompleteCancelBtnText}>Cancel transfer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.incompleteResumeBtn}
                onPress={() =>
                  navigation.navigate("SendPin", {
                    id: incompleteTransfer.id,
                    name: incompleteTransfer.name,
                    amount: incompleteTransfer.amount,
                    note: incompleteTransfer.note ?? "",
                    identifier: incompleteTransfer.recipientId || "",
                  })
                }
              >
                <Text style={styles.incompleteResumeBtnText}>Resume</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {loading && recentTransactions.length === 0 ? (
          <View style={[styles.emptyStateCard, { justifyContent: 'center', padding: Spacing.xl }]}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        ) : displayTransactions.length > 0 ? (
          <ScrollView style={styles.recentTransactionsList} showsVerticalScrollIndicator={false}>
            {displayTransactions.map((item) => (
              <TransactionItem key={item.id} item={item} />
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptyStateCard}>
            <View style={styles.clockIconContainer}>
              <Feather name="clock" size={20} color={Colors.textSecondary} />
            </View>
            <Text style={[Typography.body, styles.emptyStateText]}>
              No transactions
            </Text>
          </View>
        )}
      </View>

      {/* More Options Bottom Sheet — shows actions not in the quick actions row */}
      <View style={StyleSheet.absoluteFill} pointerEvents={isMoreModalVisible ? 'auto' : 'none'}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: moreBackdropAnim }]}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setIsMoreModalVisible(false)} />
        </Animated.View>
        <Animated.View style={[styles.bottomSheet, { transform: [{ translateY: moreSheetAnim }] }]}>
          <View style={styles.bottomSheetHandle} />
          <Text style={[Typography.h3, styles.bottomSheetTitle]}>More Options</Text>
          {QUICK_ACTIONS_REGISTRY.filter(a => !quickActions.includes(a.id)).map(action => {
            const handler = actionHandlers[action.id];
            return (
              <TouchableOpacity
                key={action.id}
                style={styles.bottomSheetItem}
                onPress={() => { setIsMoreModalVisible(false); handler.onPress(); }}
              >
                <View style={styles.bottomSheetIcon}>
                  <Feather name={action.icon as any} size={20} color={Colors.textPrimary} />
                </View>
                <Text style={[Typography.body, styles.bottomSheetItemText]}>{action.label}</Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={styles.bottomSheetItem}
            onPress={() => {
              setIsMoreModalVisible(false);
              navigation.navigate("ReversalRequest");
            }}
          >
            <View style={styles.bottomSheetIcon}>
              <Feather name="rotate-ccw" size={20} color={Colors.textPrimary} />
            </View>
            <Text style={[Typography.body, styles.bottomSheetItemText]}>Request Reversal</Text>
          </TouchableOpacity>
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
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
    },
    headerRight: {
      flexDirection: "row",
      alignItems: "center",
    },
    profilePicContainer: {
      marginRight: Spacing.md,
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
    bellButton: {
      width: 44,
      height: 44,
      borderRadius: Radius.full,
      backgroundColor: "rgba(0, 0, 0, 0.28)",
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
    unreadBadge: {
      position: "absolute",
      top: 4,
      right: 4,
      backgroundColor: Colors.error || "#EF4444",
      borderRadius: Radius.full,
      minWidth: 16,
      height: 16,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 4,
      borderWidth: 1.5,
      borderColor: Colors.primary,
    },
    unreadBadgeText: {
      color: Colors.white,
      fontSize: 10,
      fontWeight: "bold",
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
      marginTop: Spacing.sm,
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
    seeAllText: {
      color: Colors.primary,
    },
    emptyStateCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDark ? Colors.surface : Colors.white,
      borderRadius: Radius.md,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    clockIconContainer: {
      width: 36,
      height: 36,
      borderRadius: Radius.full,
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.border,
      justifyContent: "center",
      alignItems: "center",
      marginRight: Spacing.md,
    },
    emptyStateText: {
      color: Colors.textSecondary,
    },
    recentTransactionsList: {
      marginTop: Spacing.sm,
    },
    modalOverlay: {
      ...StyleSheet.absoluteFill,
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
    incompleteCard: {
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: 8,
      padding: Spacing.md,
      marginBottom: Spacing.md,
    },
    incompleteCardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: Spacing.md,
    },
    incompleteTextContainer: {
      flex: 1,
      marginRight: Spacing.md,
    },
    incompleteCardTitle: {
      ...Typography.body,
      fontWeight: "700",
      color: Colors.textPrimary,
      marginBottom: 4,
    },
    incompleteCardSubtitle: {
      ...Typography.caption,
      color: Colors.textSecondary,
    },
    incompleteDismissBtn: {
      padding: 4,
    },
    incompleteActionsRow: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: Spacing.sm,
    },
    incompleteCancelBtn: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: isDark ? Colors.background : Colors.surface,
    },
    incompleteCancelBtnText: {
      ...Typography.body,
      fontSize: 13,
      fontWeight: "500",
      color: Colors.textPrimary,
    },
    incompleteResumeBtn: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 8,
      backgroundColor: Colors.primary,
    },
    incompleteResumeBtnText: {
      ...Typography.body,
      fontSize: 13,
      fontWeight: "500",
      color: Colors.white,
    },
  });
}
