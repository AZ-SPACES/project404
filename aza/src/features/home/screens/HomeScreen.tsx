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
  Modal,
  Pressable,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  useAppTheme,
  ThemeColors,
  Typography,
  Spacing,
  Radius,
} from "../../../theme";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";
import { useDisplayContext } from "../../../providers/DisplayProvider";
import { useProfile } from "../../../providers/ProfileProvider";
import { useNotifications } from "../../../providers/NotificationProvider";
import { TransactionItem } from "../../../components/ui/TransactionItem";
import { ActionTarget } from "../components/ActionTarget";
import { useWallet } from "../../../hooks/useWallet";

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
  const { homeBackground } = useDisplayContext();
  const { handle, profileImageUri } = useProfile();

  const [isBalanceVisible, setIsBalanceVisible] = React.useState(true);
  const { wallet, recentTransactions, loading, refreshing, refresh, error } = useWallet();
  const { unreadCount } = useNotifications();
  const [isMoreModalVisible, setIsMoreModalVisible] = React.useState(false);
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
  

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />
      {/* Background Hero Image */}
      <View style={styles.topSection}>
        <Image
          source={{ uri: homeBackground }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />

        <SafeAreaView>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[Typography.h2, { color: Colors.white }]} adjustsFontSizeToFit numberOfLines={1}>
              {`${greeting}${handle ? `, ${handle}` : ""}`}
            </Text>
            <View style={styles.headerRight}>
              <TouchableOpacity
                style={styles.profilePicContainer}
                onPress={() => navigation.navigate("Profile")}
                accessibilityLabel="Open profile"
              >
                {profileImageUri ? (
                  <Image
                    source={{ uri: profileImageUri }}
                    style={styles.profilePic}
                    accessibilityLabel="Profile photo"
                  />
                ) : (
                  <View
                    style={[styles.profilePic, styles.profilePicPlaceholder]}
                  >
                    <Feather
                      name="user"
                      size={20}
                      color="rgba(255,255,255,0.8)"
                    />
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.bellButton}
                onPress={() => navigation.navigate("Inbox")}
                accessibilityLabel="Open notifications"
              >
                <Feather name="bell" size={24} color={Colors.white} />
                {unreadCount > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Balance */}
          <View style={styles.balanceSection}>
            <Text style={[Typography.bodyLg, styles.accountType]}>
              Main • GHS
            </Text>
            <View style={styles.balanceRow}>
                {loading && !wallet ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text
                    style={[Typography.h1, styles.balanceText]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {isBalanceVisible ? (wallet?.formattedBalance || "GH₵ 0.00") : "••••"}
                  </Text>
                )}
              <TouchableOpacity
                style={styles.eyeIcon}
                accessibilityLabel="Toggle balance visibility"
                onPress={() => setIsBalanceVisible(!isBalanceVisible)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Feather
                  name={isBalanceVisible ? "eye-off" : "eye"}
                  size={Typography.h1.fontSize}
                  color={Colors.white}
                />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={{ flexDirection: "row", alignItems: "center" }}
              onPress={onRefresh}
              disabled={refreshing}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[Typography.caption, styles.updateTime]}>
                {updateText}
              </Text>
              {refreshing ? (
                <ActivityIndicator
                  size="small"
                  color="rgba(255,255,255,0.8)"
                  style={{ marginLeft: 6, marginTop: Spacing.sm, transform: [{ scale: 0.6 }] }}
                />
              ) : (
                <Feather
                  name="refresh-cw"
                  size={12}
                  color="rgba(255,255,255,0.8)"
                  style={{ marginLeft: 6, marginTop: Spacing.sm }}
                />
              )}
            </TouchableOpacity>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            <ActionTarget
              icon="arrow-up"
              label="Send"
              onPress={() => navigation.navigate("Send")}
            />
            <ActionTarget
              icon="arrow-down"
              label="Request"
              onPress={() => navigation.navigate("Receive")}
            />
            <ActionTarget
              icon="credit-card"
              label="Details"
              onPress={() => navigation.navigate("Details")}
            />
            <ActionTarget
              icon="more-horizontal"
              label="More"
              onPress={() => setIsMoreModalVisible(true)}
            />
          </View>
        </SafeAreaView>
      </View>

      <View style={styles.bottomSection}>
        <View style={styles.transactionsHeader}>
          <Text style={[Typography.h3, styles.transactionsTitle]}>
            Transactions
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate("Transactions", { balance: wallet?.formattedBalance || "GH₵ 0.00" })}>
            <Text style={[Typography.body, styles.seeAllText]}>See all</Text>
          </TouchableOpacity>
        </View>

        {loading && recentTransactions.length === 0 ? (
          <View style={[styles.emptyStateCard, { justifyContent: 'center', padding: Spacing.xl }]}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        ) : recentTransactions.length > 0 ? (
          <View style={styles.recentTransactionsList}>
            {recentTransactions.map((item) => (
              <TransactionItem key={item.id} item={item} />
            ))}
          </View>
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

      {/* More Options Bottom Sheet */}
      <Modal
        visible={isMoreModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsMoreModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setIsMoreModalVisible(false)}
        />
        <View style={styles.bottomSheet}>
          <View style={styles.bottomSheetHandle} />
          <Text style={[Typography.h3, styles.bottomSheetTitle]}>More Options</Text>
          
          <TouchableOpacity
            style={styles.bottomSheetItem}
            onPress={() => {
              setIsMoreModalVisible(false);
              navigation.navigate("Withdraw");
            }}
          >
            <View style={styles.bottomSheetIcon}>
              <Feather name="log-out" size={20} color={Colors.textPrimary} />
            </View>
            <Text style={[Typography.body, styles.bottomSheetItemText]}>Withdraw Funds</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.bottomSheetItem}
            onPress={() => {
              setIsMoreModalVisible(false);
              navigation.navigate("StatementDownload");
            }}
          >
            <View style={styles.bottomSheetIcon}>
              <Feather name="file-text" size={20} color={Colors.textPrimary} />
            </View>
            <Text style={[Typography.body, styles.bottomSheetItemText]}>Account Statement</Text>
          </TouchableOpacity>
        </View>
      </Modal>
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
      flex: 1,
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
