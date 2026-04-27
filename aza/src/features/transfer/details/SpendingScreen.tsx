import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from "../../../theme";
import { RootStackParamList } from "../../../navigation/types";

const { width } = Dimensions.get("window");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type MonthData = { spent: number; avg: number };

const SPENDING_DATA: Record<string, MonthData> = {
  Jan: { spent: 450.2, avg: 922.54 },
  Feb: { spent: 120.0, avg: 922.54 },
  Mar: { spent: 0, avg: 922.54 },
  Apr: { spent: 890.5, avg: 922.54 },
  May: { spent: 300.0, avg: 922.54 },
  Jun: { spent: 0, avg: 922.54 },
  Jul: { spent: 0, avg: 922.54 },
  Aug: { spent: 0, avg: 922.54 },
  Sep: { spent: 0, avg: 922.54 },
  Oct: { spent: 0, avg: 922.54 },
  Nov: { spent: 0, avg: 922.54 },
  Dec: { spent: 0, avg: 922.54 },
};

export default function SpendingScreen() {
  const [selectedMonth, setSelectedMonth] = useState<string>("Sep");
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Go back"
          >
            <Feather name="arrow-left" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.title}>Spending</Text>

          {/* Bar Chart Area */}
          <View style={styles.chartContainer}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              contentContainerStyle={styles.chartBars}
            >
              {MONTHS.map((month) => {
                const isSelected = month === selectedMonth;
                const data = SPENDING_DATA[month];
                const hasData = data && data.spent > 0;
                
                // Calculate height based on spent amount (max 120)
                // Just a mock calculation for visual purposes
                const barHeight = hasData ? Math.max(40, Math.min(120, (data.spent / 1000) * 120)) : 0;
                
                // In the design, selected empty month can still be visually distinct
                // Or we can just use the exact logic they want. We will highlight the selected month.
                
                return (
                  <TouchableOpacity 
                    key={month} 
                    style={styles.barColumn}
                    onPress={() => setSelectedMonth(month)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.barWrapper}>
                      {hasData ? (
                        <View style={[
                          styles.barFill, 
                          { height: barHeight },
                          isSelected && { backgroundColor: Colors.primary }
                        ]} />
                      ) : isSelected ? (
                        <View style={[styles.barFill, { height: 120, opacity: 0.3 }]} />
                      ) : (
                        <View style={styles.barEmpty} />
                      )}
                    </View>
                    <Text style={[styles.monthLabel, isSelected && styles.monthLabelSelected]}>{month}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Stats */}
            <View style={styles.statsContainer}>
              <View style={styles.statLeft}>
                <Text style={styles.statAmount}>{SPENDING_DATA[selectedMonth]?.avg.toFixed(2) || "0.00"} GHS</Text>
                <View style={styles.statLabelRow}>
                  <Text style={styles.statLabel}>Avg monthly spend</Text>
                  <Feather name="help-circle" size={16} color={Colors.textPrimary} style={{ marginLeft: 4 }} />
                </View>
              </View>
              <View style={styles.statRight}>
                <Text style={styles.statAmountRight}>{SPENDING_DATA[selectedMonth]?.spent.toFixed(2) || "0.00"} GHS</Text>
                <Text style={styles.statLabelRight}>Spent this month</Text>
              </View>
            </View>
          </View>

          {/* Empty State / Illustration */}
          {(!SPENDING_DATA[selectedMonth] || SPENDING_DATA[selectedMonth].spent === 0) ? (
            <View style={styles.emptyStateContainer}>
              {/* Using a placeholder image for the illustration. In a real app this would be a local asset or a Lottie animation. */}
              <Image
                source={{ uri: "https://cdn3d.iconscout.com/3d/premium/thumb/money-stack-5120300-4277708.png" }}
                style={styles.illustration}
                resizeMode="contain"
              />
              <Text style={styles.emptyStateText}>
                You haven't sent or spent anything yet this month.
              </Text>
            </View>
          ) : (
            <View style={styles.emptyStateContainer}>
              <Text style={styles.emptyStateText}>
                You spent {SPENDING_DATA[selectedMonth].spent.toFixed(2)} GHS in {selectedMonth}.
              </Text>
            </View>
          )}
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
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.sm,
    },
    headerButton: {
      width: 44,
      height: 44,
      borderRadius: Radius.full,
      backgroundColor: isDark ? Colors.surface : Colors.white,
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
    chartContainer: {
      marginBottom: Spacing.xl,
    },
    chartBars: {
      flexDirection: "row",
      alignItems: "flex-end",
      height: 140,
      marginBottom: Spacing.md,
      paddingHorizontal: Spacing.sm,
    },
    barColumn: {
      alignItems: "center",
      width: width / 7,
    },
    barWrapper: {
      height: 120,
      justifyContent: "flex-end",
      alignItems: "center",
      marginBottom: Spacing.xs,
    },
    barFill: {
      width: 20,
      backgroundColor: isDark ? Colors.border : Colors.white,
      borderRadius: Radius.full,
    },
    barEmpty: {
      width: 20,
      height: 20,
      borderRadius: Radius.full,
      borderWidth: 1.5,
      borderColor: isDark ? Colors.border : Colors.white,
      backgroundColor: "transparent",
    },
    monthLabel: {
      ...Typography.caption,
      color: Colors.textSecondary,
    },
    monthLabelSelected: {
      color: Colors.textPrimary,
      fontWeight: "600",
    },
    statsContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: Spacing.lg,
    },
    statLeft: {
      alignItems: "flex-start",
    },
    statRight: {
      alignItems: "flex-end",
    },
    statAmount: {
      ...Typography.h3,
      fontWeight: "700",
      color: Colors.textPrimary,
      marginBottom: 4,
    },
    statAmountRight: {
      ...Typography.h3,
      fontWeight: "700",
      color: Colors.textPrimary,
      marginBottom: 4,
    },
    statLabelRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    statLabel: {
      ...Typography.body,
      color: Colors.textSecondary,
    },
    statLabelRight: {
      ...Typography.body,
      color: Colors.textSecondary,
    },
    emptyStateContainer: {
      alignItems: "center",
      marginTop: Spacing.xl * 2,
      paddingHorizontal: Spacing.xl,
    },
    illustration: {
      width: 200,
      height: 200,
      marginBottom: Spacing.xl,
    },
    emptyStateText: {
      ...Typography.body,
      color: Colors.textSecondary,
      textAlign: "center",
      lineHeight: 22,
    },
  });
}
