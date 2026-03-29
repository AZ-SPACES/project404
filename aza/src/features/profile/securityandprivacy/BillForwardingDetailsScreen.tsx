import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Switch } from "react-native";
import * as Haptics from "expo-haptics";
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from "../../../theme";
import { useProfile } from "../../../providers/ProfileProvider";

type NavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "BillForwardingDetails"
>;

export function BillForwardingDetailsScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();
  const [enabled, setEnabled] = useState(true);
  const [copied, setCopied] = useState(false);
  const { email } = useProfile();
  // TODO: replace with user-specific billing address from backend (e.g. bills+{handle}@aza.app)
  const emailAddress = email ? `bills+${email.split('@')[0]}@aza.app` : 'Pending account setup';

  const handleCopy = () => {
    Clipboard.setString(emailAddress);
    setCopied(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => {
      Clipboard.setStringAsync('');
      setCopied(false);
    }, 30000); // clear clipboard after 30s
  };


  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Feather name="chevron-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleSection}>
          <Text style={[Typography.h1, styles.mainTitle]}>
            Bill forwarding email
          </Text>
        </View>

        <View style={styles.section}>
          <View style={styles.row}>
            <View style={styles.iconContainer}>
              <Feather name="mail" size={22} color={Colors.textPrimary} />
            </View>
            <View style={styles.textContainer}>
              <Text style={[Typography.body, styles.rowTitle]}>
                Bill forwarding email
              </Text>
              <Text style={[Typography.caption, styles.rowSubtitle]}>
                Enable receiving bills via your profile's dedicated email
                address
              </Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={setEnabled}
              trackColor={{ false: "#E5E7EB", true: "#243b14" }}
              thumbColor={Colors.white}
              ios_backgroundColor="#E5E7EB"
              accessibilityRole="switch"
              accessibilityLabel="Enable bill forwarding"
            />
          </View>
        </View>

        {enabled && (
          <View style={styles.detailsContainer}>
            <View style={styles.emailRow}>
              <View style={styles.emailContainer}>
                <Text style={styles.label}>Send bills or invoices to</Text>
                <Text style={styles.emailText}>
                  {emailAddress}
                </Text>
              </View>
              <TouchableOpacity 
                style={[styles.copyButton, copied && { backgroundColor: "#DCFCE7" }]} 
                activeOpacity={0.7}
                onPress={handleCopy}
              >
                <Text style={[styles.copyButtonText, copied && { color: "#166534" }]}>
                  {copied ? "Copied" : "Copy"}
                </Text>
              </TouchableOpacity>

            </View>
            <View style={styles.divider} />
          </View>
        )}

        <View style={styles.footerSection}>
          <Text style={styles.footerText}>
            You are responsible for checking that received invoices are valid
            and should be paid. This service uses AI, which can make mistakes.
            Please check details before paying.{" "}
            <Text style={styles.learnMore}>Learn more</Text>
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.background === '#121212';
  return StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between" },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    justifyContent: "center",
    alignItems: "center" },
  faqButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.full,
    gap: 8 },
  faqButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textPrimary },
  scrollContent: {
    paddingBottom: Spacing.xl },
  titleSection: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.xl },
  mainTitle: {
    color: Colors.textPrimary,
    fontSize: 32,
    fontWeight: "700" },
  section: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.lg },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md },
  textContainer: {
    flex: 1,
    justifyContent: "center",
    paddingRight: Spacing.md },
  rowTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4 },
  rowSubtitle: {
    color: Colors.textSecondary,
    fontSize: 15,
    lineHeight: 22 },
  detailsContainer: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md },
  emailRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: Spacing.lg },
  emailContainer: {
    flex: 1,
    paddingRight: Spacing.md },
  label: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 8 },
  emailText: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.textPrimary },
  copyButton: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: Radius.full },
  copyButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textPrimary },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginTop: Spacing.lg },
  footerSection: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.xl },
  footerText: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 24 },
  learnMore: {
    color: "#004D00",
    fontWeight: "700",
    textDecorationLine: "underline" } });
}


