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
import { Feather } from '@react-native-vector-icons/feather';
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from '@tanstack/react-query';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from "../../../theme";
import { RootStackParamList } from "../../../navigation/types";
import { getYearlySpendingSummary } from "../../../services/api";
import { BackButton } from "../../../components/ui/BackButton";

const { width } = Dimensions.get("window");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type MonthData = { spent: number; avg: number };

export default function SpendingScreen() {
  const currentMonthIdx = new Date().getMonth();
  const [selectedMonth, setSelectedMonth] = useState<string>(MONTHS[currentMonthIdx]!);
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const { data: yearlyData, isLoading: loading } = useQuery({
    queryKey: ['spending-yearly'],
    queryFn: async () => {
      const response = await getYearlySpendingSummary();
      return response.data?.data ?? { months: {}, currency: 'GHS' };
    },
    staleTime: 5 * 60_000,
  });

  const spendingData: Record<string, MonthData> = yearlyData?.months ?? {};
  const currency: string = yearlyData?.currency ?? 'GHS';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <BackButton onPress={() => navigation.goBack()} />
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
              {(() => {
                const maxSpent = Object.keys(spendingData).length > 0
                  ? Math.max(...Object.values(spendingData).map(m => m.spent))
                  : 0;

                return MONTHS.map((month) => {
                  const isSelected = month === selectedMonth;
                  const data = spendingData[month];
                  const hasData = data && data.spent > 0;
                  
                  // Calculate height based on spent amount
                  let barHeight = 0;
                  if (hasData) {
                     const ratio = maxSpent > 0 ? data.spent / maxSpent : 0;
                     barHeight = Math.max(10, ratio * 120);
                  }
                  
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
              })})()}
            </ScrollView>

            {/* Stats */}
            <View style={styles.statsContainer}>
              <View style={styles.statLeft}>
                <Text style={styles.statAmount}>{spendingData[selectedMonth]?.avg.toFixed(2) || "0.00"} {currency}</Text>
                <View style={styles.statLabelRow}>
                  <Text style={styles.statLabel}>Avg monthly spend</Text>
                  <Feather name="help-circle" size={16} color={Colors.textPrimary} style={{ marginLeft: 4 }} />
                </View>
              </View>
              <View style={styles.statRight}>
                <Text style={styles.statAmountRight}>{spendingData[selectedMonth]?.spent.toFixed(2) || "0.00"} {currency}</Text>
                <Text style={styles.statLabelRight}>Spent this month</Text>
              </View>
            </View>
          </View>

          {/* Empty State / Illustration */}
          {(!spendingData[selectedMonth] || spendingData[selectedMonth].spent === 0) ? (
            <View style={styles.emptyStateContainer}>
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
                You spent {spendingData[selectedMonth].spent.toFixed(2)} {currency} in {selectedMonth}.
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
