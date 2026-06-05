import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@react-native-vector-icons/feather";
import { useAppTheme, Typography, Spacing, Radius } from "../../../theme";
import { getTransactions, createDispute } from "../../../services/api";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { mapBackendTransaction, formatCurrency } from "../../../utils/transactionUtils";
import { Transaction } from "./TransactionsScreen";
import { TransactionItem } from "../../../components/ui/TransactionItem";
import Button from "../../../components/ui/Button";
import { RootStackParamList } from "../../../navigation/types";
import { BackButton } from '../../../components/ui/BackButton';
import { extractErrorMessage } from '../../../utils/errorUtils';

const REASON_CATEGORIES = [
  { id: "WRONG_AMOUNT", label: "Wrong Amount" },
  { id: "DUPLICATE", label: "Duplicate Charge" },
  { id: "OTHER", label: "Sent to Wrong Person / Other" },
];

export function ReversalRequestScreen() {
  const { colors: Colors, isDark } = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // Screen states: 'select_tx' | 'fill_form' | 'success'
  const [step, setStep] = useState<"select_tx" | "fill_form" | "success">("select_tx");

  // Selection/form states
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const { data: transactions = [], isLoading: loadingTxs, error: txError, refetch: refetchTxs } = useQuery({
    queryKey: queryKeys.transactions('COMPLETED'),
    queryFn: async () => {
      const res = await getTransactions(0, 50, undefined, "COMPLETED");
      const content: any[] = res.data?.data?.content || res.data?.content || [];
      return content.map(mapBackendTransaction).filter((tx) => !tx.isCredit);
    },
    staleTime: 30_000,
  });

  const [category, setCategory] = useState<string>("OTHER");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);


  const handleSubmit = async () => {
    if (!selectedTx || !description.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await createDispute({
        transactionId: selectedTx.id,
        category,
        description: description.trim(),
      });
      setStep("success");
    } catch (err: unknown) {
      console.error("Dispute submission error:", err);
      setSubmitError(extractErrorMessage(err, "Failed to submit request. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectTx = (tx: Transaction) => {
    setSelectedTx(tx);
    setStep("fill_form");
  };

  const handleGoBack = () => {
    if (step === "fill_form") {
      setStep("select_tx");
      setSubmitError(null);
    } else {
      navigation.goBack();
    }
  };

  const renderTxItem = ({ item }: { item: Transaction }) => {
    return (
      <View style={styles.txRowWrapper}>
        <TransactionItem item={item} onPress={() => handleSelectTx(item)} />
      </View>
    );
  };

  // ── Step 1: Select Transaction ──
  const renderSelectTx = () => {
    if (loadingTxs) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={[Typography.body, { color: Colors.textSecondary, marginTop: Spacing.md }]}>
            Loading completed transactions...
          </Text>
        </View>
      );
    }

    if (txError) {
      return (
        <View style={styles.centerContainer}>
          <Feather name="wifi-off" size={40} color={Colors.border} />
          <Text style={[Typography.h3, { color: Colors.textPrimary, marginTop: Spacing.md, textAlign: "center" }]}>
            {txError instanceof Error ? txError.message : "Failed to load transactions"}
          </Text>
          <TouchableOpacity onPress={() => refetchTxs()} style={styles.retryBtn}>
            <Text style={[Typography.body, { color: Colors.primary }]}>Tap to retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (transactions.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <Feather name="inbox" size={40} color={Colors.border} />
          <Text style={[Typography.h3, { color: Colors.textPrimary, marginTop: Spacing.md, textAlign: "center" }]}>
            No Completed Transactions
          </Text>
          <Text style={[Typography.body, { color: Colors.textSecondary, marginTop: Spacing.xs, textAlign: "center" }]}>
            Only completed outgoing transfers can be reversed.
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={renderTxItem}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <Text style={[Typography.body, { color: Colors.textSecondary, marginHorizontal: Spacing.lg, marginBottom: Spacing.md }]}>
            Select the transaction you want to dispute or request a reversal for.
          </Text>
        }
      />
    );
  };

  // ── Step 2: Fill Form ──
  const renderFillForm = () => {
    if (!selectedTx) return null;

    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Selected Transaction Summary */}
          <Text style={styles.label}>Selected Transaction</Text>
          <View style={[styles.txCard, { backgroundColor: isDark ? Colors.surface : Colors.white, borderColor: Colors.border }]}>
            <View style={styles.txCardHeader}>
              <Text style={[Typography.body, { color: Colors.textSecondary }]}>Paid to</Text>
              <Text style={[Typography.bodyLg, { color: Colors.textPrimary, fontWeight: "600" }]}>
                {selectedTx.name}
              </Text>
            </View>
            <View style={styles.txCardDivider} />
            <View style={styles.txCardRow}>
              <View>
                <Text style={[Typography.caption, { color: Colors.textSecondary }]}>Amount</Text>
                <Text style={[Typography.bodyLg, { color: Colors.textPrimary, fontWeight: "700", marginTop: 2 }]}>
                  {formatCurrency(selectedTx.amount)}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[Typography.caption, { color: Colors.textSecondary }]}>Date</Text>
                <Text style={[Typography.body, { color: Colors.textPrimary, marginTop: 2 }]}>
                  {new Date(selectedTx.fullDate).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                </Text>
              </View>
            </View>
            <View style={[styles.txCardRow, { paddingTop: 0, marginTop: Spacing.sm }]}>
              <Text style={[Typography.caption, { color: Colors.textSecondary }]}>Reference ID</Text>
              <Text style={[Typography.caption, { color: Colors.textPrimary, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }]}>
                AZA-{selectedTx.id.slice(0, 8).toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Reason Category */}
          <Text style={styles.label}>Reason Category</Text>
          <View style={styles.categoriesContainer}>
            {REASON_CATEGORIES.map((cat) => {
              const active = category === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryBtn,
                    {
                      backgroundColor: isDark ? Colors.surface : Colors.white,
                      borderColor: active ? Colors.primary : Colors.border,
                      borderWidth: active ? 2 : 1,
                    },
                  ]}
                  onPress={() => setCategory(cat.id)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      Typography.body,
                      {
                        color: active ? Colors.primary : Colors.textPrimary,
                        fontWeight: active ? "600" : "400",
                      },
                    ]}
                  >
                    {cat.label}
                  </Text>
                  {active && <Feather name="check-circle" size={16} color={Colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Description */}
          <Text style={styles.label}>Explain what went wrong</Text>
          <TextInput
            underlineColorAndroid="transparent"
            style={[
              styles.textArea,
              {
                backgroundColor: isDark ? Colors.surface : Colors.white,
                borderColor: Colors.border,
                color: Colors.textPrimary,
              },
            ]}
            placeholder="Please explain in detail why you want to reverse this transaction (e.g. wrong account number, duplicate payment, incorrect amount)..."
            placeholderTextColor={Colors.textSecondary}
            multiline
            numberOfLines={4}
            value={description}
            onChangeText={setDescription}
          />

          {submitError && (
            <View style={[styles.errorBox, { backgroundColor: Colors.error + "15", borderColor: Colors.error }]}>
              <Feather name="alert-triangle" size={16} color={Colors.error} />
              <Text style={[Typography.body, { color: Colors.error, marginLeft: Spacing.sm, flex: 1 }]}>
                {submitError}
              </Text>
            </View>
          )}

          <View style={styles.actionButtons}>
            <Button
              title={submitting ? "Submitting..." : "Submit Reversal Request"}
              onPress={handleSubmit}
              backgroundColor={Colors.primary}
              textColor={Colors.white}
              disabled={submitting || !description.trim()}
              leftIcon={submitting ? <ActivityIndicator size="small" color="white" /> : undefined}
            />
            <Button
              title="Change Transaction"
              onPress={() => setStep("select_tx")}
              backgroundColor={isDark ? Colors.background : Colors.surface}
              textColor={Colors.textPrimary}
              disabled={submitting}
              style={{ borderWidth: 1, borderColor: Colors.border }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  };

  // ── Step 3: Success Screen ──
  const renderSuccess = () => {
    return (
      <View style={styles.successContainer}>
        <View style={[styles.successIconCircle, { backgroundColor: Colors.primary + "15" }]}>
          <Feather name="check-circle" size={56} color={Colors.primary} />
        </View>
        <Text style={[Typography.h1, { color: Colors.textPrimary, marginTop: Spacing.lg, textAlign: "center" }]}>
          Request Submitted
        </Text>
        <Text style={[Typography.bodyLg, { color: Colors.textSecondary, marginTop: Spacing.md, textAlign: "center", lineHeight: 22 }]}>
          Your reversal request has been submitted successfully. The admin will review, audit, and process your request shortly.
        </Text>
        <View style={styles.successActions}>
          <Button
            title="Return to Home"
            onPress={() => navigation.navigate("MainTabs")}
            backgroundColor={Colors.primary}
            textColor={Colors.white}
          />
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors.background }]} edges={["top", "bottom"]}>
      {/* Header */}
      {step !== "success" && (
        <View style={styles.header}>
          <BackButton onPress={handleGoBack} />
          <Text style={[Typography.h2, { color: Colors.textPrimary, marginLeft: Spacing.md }]}>
            {step === "select_tx" ? "Request Reversal" : "Request Details"}
          </Text>
        </View>
      )}

      {/* Main Content */}
      <View style={{ flex: 1 }}>
        {step === "select_tx" && renderSelectTx()}
        {step === "fill_form" && renderFillForm()}
        {step === "success" && renderSuccess()}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
  },
  backButton: {
    padding: 4,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xl * 2,
  },
  retryBtn: {
    marginTop: Spacing.md,
    padding: Spacing.sm,
  },
  listContent: {
    paddingBottom: Spacing.xl * 2,
  },
  txRowWrapper: {
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.03)",
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl * 3,
  },
  label: {
    ...Typography.caption,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: "rgba(255, 255, 255, 0.4)",
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  txCard: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
  },
  txCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: Spacing.sm,
  },
  txCardDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginVertical: Spacing.sm,
  },
  txCardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.xs,
  },
  categoriesContainer: {
    gap: Spacing.sm,
  },
  categoryBtn: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  textArea: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
    minHeight: 100,
    textAlignVertical: "top",
    ...Typography.body,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.lg,
  },
  actionButtons: {
    marginTop: Spacing.xl,
    gap: Spacing.md,
  },
  successContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xl * 2,
  },
  successIconCircle: {
    width: 96,
    height: 96,
    borderRadius: Radius.full,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  successActions: {
    marginTop: Spacing.xl * 2,
    width: "100%",
  },
});
