import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from "../../../theme";
import { RootStackParamList } from "../../../navigation/types";

export default function DetailsScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Go back"
          >
            <Feather name="arrow-left" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.title}>Summary</Text>

          {/* Spending Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Spending</Text>
              <TouchableOpacity onPress={() => navigation.navigate("Spending")}>
                <Text style={styles.seeAllText}>See all</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.spendingRow}>
              <View style={styles.iconContainer}>
                <View style={styles.cashIcon}>
                  <View style={styles.cashIconInnerCircle} />
                  <View style={styles.cashIconLine} />
                </View>
              </View>
              <View style={styles.spendingInfo}>
                <Text style={styles.periodText}>Spent this month</Text>
                <Text style={styles.amountText}>0.00 GHS</Text>
              </View>
            </View>

            <View style={[styles.spendingRow, { marginTop: Spacing.xl }]}>
              <View style={styles.iconContainer}>
                <View style={styles.cashIcon}>
                  <View style={styles.cashIconInnerCircle} />
                  <View style={styles.cashIconLine} />
                </View>
              </View>
              <View style={styles.spendingInfo}>
                <Text style={styles.periodText}>Spent last month</Text>
                <Text style={styles.amountText}>0.00 GHS</Text>
              </View>
            </View>
          </View>

          {/* Feedback Section */}
          <View style={styles.feedbackSection}>
            <Text style={styles.feedbackText}>
              What do you think about this experience?
            </Text>
            <TouchableOpacity style={styles.feedbackButton}>
              <Text style={styles.giveFeedbackText}>Give us feedback</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    header: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.sm,
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: Radius.full,
      backgroundColor: isDark ? Colors.surface : "#F9FAFB",
      justifyContent: "center",
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    scrollContent: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.xl * 2,
    },
    title: {
      ...Typography.h1,
      fontSize: 32,
      color: Colors.textPrimary,
      marginTop: Spacing.md,
      marginBottom: Spacing.xl,
    },
    card: {
      backgroundColor: isDark ? Colors.surface : Colors.white,
      borderRadius: Radius.lg,
      padding: Spacing.xl,
      borderWidth: 1,
      borderColor: isDark ? Colors.border : "#E5E7EB",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.03,
      shadowRadius: 8,
      elevation: 1,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: Spacing.xl,
    },
    cardTitle: {
      ...Typography.h2,
      fontSize: 20,
      color: Colors.textPrimary,
    },
    seeAllText: {
      ...Typography.body,
      fontWeight: "600",
      color: Colors.primary,
      textDecorationLine: "underline",
    },
    spendingRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: isDark ? Colors.border : "#E5E7EB",
      justifyContent: "center",
      alignItems: "center",
      marginRight: Spacing.md,
    },
    cashIcon: {
      width: 22,
      height: 14,
      borderRadius: 2,
      borderWidth: 1.5,
      borderColor: Colors.textPrimary,
      justifyContent: "center",
      alignItems: "center",
    },
    cashIconInnerCircle: {
      width: 6,
      height: 6,
      borderRadius: 3,
      borderWidth: 1.5,
      borderColor: Colors.textPrimary,
    },
    cashIconLine: {
      position: 'absolute',
      bottom: -1.5,
      width: '100%',
      height: 1.5,
      backgroundColor: Colors.textPrimary,
      opacity: 0, // In case we just want the simple rectangle with circle
    },
    spendingInfo: {
      flex: 1,
      justifyContent: "center",
    },
    periodText: {
      ...Typography.body,
      color: Colors.textSecondary,
      marginBottom: 2,
    },
    amountText: {
      ...Typography.bodyLg,
      color: Colors.textPrimary,
    },
    feedbackSection: {
      marginTop: Spacing.xl * 3,
      alignItems: "center",
    },
    feedbackText: {
      ...Typography.body,
      color: Colors.textSecondary,
      marginBottom: Spacing.sm,
    },
    feedbackButton: {
      paddingVertical: Spacing.xs,
    },
    giveFeedbackText: {
      ...Typography.body,
      fontWeight: "600",
      color: Colors.primary,
      textDecorationLine: "underline",
    },
  });
}
