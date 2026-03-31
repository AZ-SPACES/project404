import React, { ComponentProps } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  StatusBar } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from "../../theme";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/types";
import { useDisplayContext } from "../../providers/DisplayProvider";
import { useProfile } from "../../providers/ProfileProvider";

const { height } = Dimensions.get("window");



type ActionTargetProps = {
  icon: ComponentProps<typeof Feather>["name"];
  label: string;
  onPress?: () => void;
};

function ActionTarget({ icon, label, onPress }: ActionTargetProps) {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  return (
    <TouchableOpacity
      style={styles.actionContainer}
      activeOpacity={0.7}
      onPress={onPress}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.actionIconCircle}>
        <Feather name={icon} size={24} color={Colors.white} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

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
  const { displayName, profileImageUri } = useProfile();

  const firstName = displayName?.trim().split(" ")[0];
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
            <Text style={[Typography.h1, { color: Colors.white }]}>
              {`${greeting}${firstName ? `, ${firstName}` : ""}`}
            </Text>
            <View style={styles.headerRight}>
              <TouchableOpacity
                style={styles.profilePicContainer}
                onPress={() => navigation.navigate("Profile")}
                accessibilityLabel="Open profile"
              >
                {profileImageUri ? (
                  <Image source={{ uri: profileImageUri }} style={styles.profilePic} accessibilityLabel="Profile photo" />
                ) : (
                  <View style={[styles.profilePic, styles.profilePicPlaceholder]}>
                    <Feather name="user" size={20} color="rgba(255,255,255,0.8)" />
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.bellButton}
                onPress={() => navigation.navigate("Inbox")}
                accessibilityLabel="Open notifications"
              >
                <Feather name="bell" size={24} color={Colors.white} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Balance */}
          <View style={styles.balanceSection}>
            <Text style={[Typography.bodyLg, styles.accountType]}>
              Main • GHS
            </Text>
            <View style={styles.balanceRow}>
              <Text style={[Typography.h1, styles.balanceText]}>GH₵ 0.00</Text>
              <TouchableOpacity style={styles.eyeIcon} accessibilityLabel="Toggle balance visibility">
                <Feather
                  name="eye-off"
                  size={Typography.h1.fontSize}
                  color={Colors.white}
                />
              </TouchableOpacity>
            </View>
            <Text style={[Typography.caption, styles.updateTime]}>
              Updated last 20s ago
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            <ActionTarget
              icon="arrow-up"
              label="Send"
              onPress={() => navigation.navigate("Send")}
            />
            <ActionTarget icon="arrow-down" label="Request" onPress={() => navigation.navigate("Receive")}/>
            <ActionTarget icon="credit-card" label="Details" />
            <ActionTarget icon="more-horizontal" label="More" />
          </View>
        </SafeAreaView>
      </View>

      <View style={styles.bottomSection}>
        <View style={styles.transactionsHeader}>
          <Text style={[Typography.h3, styles.transactionsTitle]}>
            Transactions
          </Text>
          <TouchableOpacity>
            <Text style={[Typography.body, styles.seeAllText]}>See all</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.emptyStateCard}>
          <View style={styles.clockIconContainer}>
            <Feather name="clock" size={20} color={Colors.textSecondary} />
          </View>
          <Text style={[Typography.body, styles.emptyStateText]}>
            No transactions
          </Text>
        </View>
      </View>
    </View>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background },
  topSection: {
    height: height * 0.55,
    backgroundColor: Colors.primary },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md },
  headerRight: {
    flexDirection: "row",
    alignItems: "center" },
  profilePicContainer: {
    marginRight: Spacing.md },
  profilePic: {
    width: 44,
    height: 44,
    borderRadius: Radius.full },
  profilePicPlaceholder: {
    backgroundColor: "rgba(0,0,0,0.28)",
    justifyContent: "center",
    alignItems: "center" },
  bellButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: "rgba(0, 0, 0, 0.28)",
    justifyContent: "center",
    alignItems: "center" },
  balanceSection: {
    alignItems: "center",
    marginTop: Spacing.xl * 2 },
  accountType: {
    color: Colors.white,
    marginBottom: Spacing.xs },
  balanceRow: {
    flexDirection: "row",
    alignItems: "center" },
  balanceText: {
    color: Colors.white },
  eyeIcon: {
    marginLeft: Spacing.md },
  updateTime: {
    color: "rgba(255,255,255,0.8)",
    marginTop: Spacing.sm },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.xl * 2 },
  actionContainer: {
    alignItems: "center" },
  actionIconCircle: {
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    backgroundColor: Colors.black30,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.sm },
  actionLabel: {
    ...Typography.body,
    fontWeight: "600",
    color: Colors.white },
  bottomSection: {
    flex: 1,
    backgroundColor: Colors.background,
    marginTop: -Spacing.lg,
    borderTopLeftRadius: Radius.md,
    borderTopRightRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg },
  transactionsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md },
  transactionsTitle: {
    color: Colors.textPrimary },
  seeAllText: {
    color: Colors.primary },
  emptyStateCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: isDark ? Colors.surface : Colors.white,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border },
  clockIconContainer: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md },
  emptyStateText: {
    color: Colors.textSecondary } });
}
