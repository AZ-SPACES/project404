import React, { useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors, Typography, Spacing, Radius } from "../../theme";
import Button from "../../components/ui/Button";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "FeesAndLimits">;

type LimitRow = {
  label: string;
  tier1: string;
  tier2: string;
};

const TRANSACTION_LIMITS: LimitRow[] = [
  { label: "Daily send limit",    tier1: "GH¢ 1,000",  tier2: "GH¢ 5,000"  },
  { label: "Monthly balance cap", tier1: "GH¢ 5,000",  tier2: "GH¢ 50,000" },
  { label: "Min. account balance", tier1: "GH¢ 0",     tier2: "GH¢ 0"      },
];

const FEE_ROWS: LimitRow[] = [
  { label: "Send money",         tier1: "Free",  tier2: "Free"  },
  { label: "Receive money",      tier1: "Free",  tier2: "Free"  },
  { label: "Cash withdrawal",    tier1: "Free",  tier2: "Free"  },
  { label: "Account maintenance", tier1: "Free", tier2: "Free"  },
];

export default function FeesAndLimitsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const scrollY = useRef(new Animated.Value(0)).current;

  const headerBorderOpacity = scrollY.interpolate({
    inputRange: [40, 70],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const handleContinue = () => {
    navigation.navigate("AccountReady");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <Animated.View
          style={[
            styles.header,
            {
              borderBottomColor: headerBorderOpacity.interpolate({
                inputRange: [0, 1],
                outputRange: ["transparent", Colors.border],
              }),
            },
          ]}
        />

        {/* Content */}
        <Animated.ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}
        >
          {/* Zero fees hero */}
          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <MaterialIcons name="check-circle" size={28} color={Colors.primary} />
            </View>
            <Text style={styles.heroLabel}>Zero fees. Always.</Text>
          </View>

          <Text style={styles.title}>Fees & account limits</Text>
          <Text style={styles.subtitle}>
            aza charges no transaction fees — ever. As required by Bank of Ghana
            regulations (Act 987), your account starts at Tier 1 and upgrades to
            Tier 2 automatically after KYC verification.
          </Text>

          {/* Fees table */}
          <Text style={styles.sectionLabel}>Transaction fees</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Fee type</Text>
              <Text style={styles.tableHeaderCell}>Tier 1</Text>
              <Text style={styles.tableHeaderCell}>Tier 2</Text>
            </View>
            {FEE_ROWS.map((row, i) => (
              <View
                key={row.label}
                style={[styles.tableRow, i % 2 === 0 && styles.tableRowAlt]}
              >
                <Text style={[styles.tableCell, { flex: 2 }]}>{row.label}</Text>
                <Text style={[styles.tableCell, styles.tableCellFree]}>{row.tier1}</Text>
                <Text style={[styles.tableCell, styles.tableCellFree]}>{row.tier2}</Text>
              </View>
            ))}
          </View>

          {/* Limits table */}
          <Text style={styles.sectionLabel}>Account limits</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Limit</Text>
              <Text style={styles.tableHeaderCell}>Tier 1</Text>
              <Text style={styles.tableHeaderCell}>Tier 2</Text>
            </View>
            {TRANSACTION_LIMITS.map((row, i) => (
              <View
                key={row.label}
                style={[styles.tableRow, i % 2 === 0 && styles.tableRowAlt]}
              >
                <Text style={[styles.tableCell, { flex: 2 }]}>{row.label}</Text>
                <Text style={styles.tableCell}>{row.tier1}</Text>
                <Text style={styles.tableCell}>{row.tier2}</Text>
              </View>
            ))}
          </View>

          {/* Tier explanation */}
          <View style={styles.tierNote}>
            <MaterialIcons name="upgrade" size={16} color={Colors.primary} />
            <Text style={styles.tierNoteText}>
              Your account is already at <Text style={styles.bold}>Tier 2</Text> — KYC
              verification was completed during sign-up. Higher limits apply immediately.
            </Text>
          </View>

          {/* Regulatory note */}
          <View style={styles.legalNote}>
            <MaterialIcons name="info-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.legalNoteText}>
              Tiered account limits are set by the Bank of Ghana under the Payment
              Systems and Services Act, 2019 (Act 987). Limits apply per calendar
              day and month and may be adjusted by aza with 30 days' notice.
            </Text>
          </View>
        </Animated.ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <Button
            title="Got it — Open my account"
            onPress={handleContinue}
            backgroundColor={Colors.primary}
            textColor={Colors.secondary}
            borderRadius={30}
            paddingVertical={16}
            fontSize={Number(Typography.button.fontSize)}
            fontWeight={Typography.button.fontWeight as any}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: { flex: 1 },
  header: {
    height: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  content: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  heroIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: "#EAF5E9",
    alignItems: "center",
    justifyContent: "center",
  },
  heroLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.primary,
    letterSpacing: 0.1,
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  sectionLabel: {
    fontSize: Typography.bodyLg.fontSize,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  table: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    backgroundColor: Colors.white,
    overflow: "hidden",
    marginBottom: Spacing.lg,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tableHeaderCell: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  tableRow: {
    flexDirection: "row",
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  tableRowAlt: {
    backgroundColor: "#FAFCF8",
  },
  tableCell: {
    flex: 1,
    fontSize: Typography.body.fontSize,
    color: Colors.textPrimary,
  },
  tableCellFree: {
    color: "#16a34a",
    fontWeight: "600",
  },
  tierNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: "#EAF5E9",
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: "#bbddbb",
    marginBottom: Spacing.md,
  },
  tierNoteText: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  bold: { 
    fontWeight: "700"
  },
  legalNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  legalNoteText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
});
