import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SectionList,
  TextInput,
  RefreshControl,
  ScrollView,
  Modal,
  Pressable,
  ActivityIndicator,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from '@react-native-vector-icons/feather';
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";
import {
  useAppTheme,
  ThemeColors,
  Typography,
  Spacing,
  Radius,
} from "../../../theme";
import { TransactionItem } from "../../../components/ui/TransactionItem";
import Button from "../../../components/ui/Button";
import { useTransactions, TransactionFilter } from "../../../hooks/useTransactions";
import { useDisplayContext } from "../../../providers/DisplayProvider";
import { useTransferStore } from "../../../store/transferStore";
import { formatCurrency } from "../../../utils/transactionUtils";
import { BackButton } from '../../../components/ui/BackButton';

export type Transaction = {
  id: string;
  name: string;
  type: string;
  time: string;
  amount: number;
  isCredit: boolean;
  isPending?: boolean;
  fullDate: string;
  status?: string;
  note?: string;
  direction?: string;
  senderId?: string;
  recipientId?: string;
  completedAt?: string | null;
};

export type Section = {
  title: string;
  data: Transaction[];
};

// ─── Status config ────────────────────────────────────────────────────────────

type StatusMeta = {
  label: string;
  sublabel: string;
  iconName: React.ComponentProps<typeof Feather>["name"];
  iconBg: string;
  iconColor: string;
  labelColor: string;
};

function resolveStatusMeta(tx: Transaction, Colors: ThemeColors): StatusMeta {
  const s = tx.status ?? (tx.isPending ? "PENDING" : "COMPLETED");
  switch (s) {
    case "PENDING":
      return {
        label: "Pending",
        sublabel: tx.type === "Money Request" && !tx.isCredit
          ? "Awaiting your payment"
          : "Being processed",
        iconName: "clock",
        iconBg: "rgba(245,158,11,0.12)",
        iconColor: "#D97706",
        labelColor: "#D97706",
      };
    case "FAILED":
      return {
        label: "Failed",
        sublabel: "This transaction did not complete",
        iconName: "x-circle",
        iconBg: "rgba(234,67,53,0.10)",
        iconColor: Colors.error,
        labelColor: Colors.error,
      };
    case "CANCELLED":
      return {
        label: "Cancelled",
        sublabel: "This transaction was cancelled",
        iconName: "slash",
        iconBg: "rgba(107,114,128,0.12)",
        iconColor: Colors.textSecondary,
        labelColor: Colors.textSecondary,
      };
    default: // COMPLETED
      return {
        label: "Completed",
        sublabel: tx.isCredit ? "Money received successfully" : "Money sent successfully",
        iconName: "check-circle",
        iconBg: "rgba(183,238,122,0.22)",
        iconColor: Colors.primary,
        labelColor: Colors.primary,
      };
  }
}

function formatDetailDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }) + " · " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ─── PIN dots (matches SendPinScreen style) ───────────────────────────────────

const PIN_LENGTH = 4;
const PIN_ARRAY = Array.from({ length: PIN_LENGTH });

type PinDotsProps = {
  pin: string;
  scaleAnims: Animated.Value[];
  onPress: () => void;
  Colors: ThemeColors;
};

function PinDots({ pin, scaleAnims, onPress, Colors }: PinDotsProps) {
  return (
    <TouchableOpacity
      activeOpacity={1}
      style={{ flexDirection: "row", justifyContent: "center", gap: 12 }}
      onPress={onPress}
    >
      {PIN_ARRAY.map((_, i) => {
        const filled = pin.length > i;
        const current = pin.length === i;
        return (
          <Animated.View
            key={i}
            style={[
              {
                width: 48,
                height: 48,
                borderRadius: 10,
                borderWidth: 1.5,
                borderColor: filled || current ? Colors.primary : Colors.border,
                backgroundColor: Colors.surface,
                alignItems: "center",
                justifyContent: "center",
              },
              { transform: [{ scale: scaleAnims[i]! }] },
            ]}
          >
            {filled
              ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.textPrimary }} />
              : current
                ? <View style={{ width: 2, height: 22, backgroundColor: Colors.primary }} />
                : null}
          </Animated.View>
        );
      })}
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

const FILTERS: TransactionFilter[] = ["All", "Money In", "Money Out", "Pending", "Failed"];

export function TransactionsScreen() {
  const { colors: Colors, isDark } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "Transactions">>();
  const balance = route.params?.balance || "GH₵ 0.00";
  const { transactionGrouping } = useDisplayContext();

  const [searchQuery, setSearchQuery] = useState("");
  const { sections, loading, refreshing, refresh, loadMore, error, filter, setFilter } =
    useTransactions();
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [actionLoading, setActionLoading] = useState<"accept" | "decline" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { acceptMoneyRequest, declineMoneyRequest } = useTransferStore();

  // PIN state for accepting money requests
  const [pinVisible, setPinVisible] = useState(false);
  const [pin, setPin] = useState("");
  const pinInputRef = useRef<TextInput>(null);
  const scaleAnims = useRef(PIN_ARRAY.map(() => new Animated.Value(1))).current;

  const closeSheet = useCallback(() => {
    setSelectedTx(null);
    setPinVisible(false);
    setPin("");
    setActionError(null);
  }, []);

  // Auto-submit PIN when 4 digits entered
  useEffect(() => {
    if (pin.length !== PIN_LENGTH || !pinVisible) return;
    const t = setTimeout(() => handlePayConfirm(pin), 300);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, pinVisible]);

  const handlePinChange = useCallback((text: string) => {
    if (actionLoading) return;
    const cleaned = text.replace(/[^0-9]/g, "").slice(0, PIN_LENGTH);
    if (cleaned.length > pin.length) {
      const idx = cleaned.length - 1;
      Animated.sequence([
        Animated.timing(scaleAnims[idx]!, { toValue: 1.15, duration: 80, useNativeDriver: true }),
        Animated.timing(scaleAnims[idx]!, { toValue: 1, duration: 80, useNativeDriver: true }),
      ]).start();
    }
    if (actionError) setActionError(null);
    setPin(cleaned);
  }, [pin, scaleAnims, actionError, actionLoading]);

  const handlePayConfirm = useCallback(async (enteredPin: string) => {
    if (!selectedTx) return;
    setActionLoading("accept");
    setActionError(null);
    try {
      await acceptMoneyRequest(selectedTx.id, enteredPin);
      closeSheet();
      refresh();
    } catch (err: any) {
      setPin("");
      setActionError(err.message || "Incorrect PIN or payment failed.");
    } finally {
      setActionLoading(null);
    }
  }, [selectedTx, acceptMoneyRequest, closeSheet, refresh]);

  const handleDecline = useCallback(async (tx: Transaction) => {
    setActionLoading("decline");
    setActionError(null);
    try {
      await declineMoneyRequest(tx.id);
      closeSheet();
      refresh();
    } catch (err: any) {
      setActionError(err.message || "Failed to decline. Try again.");
    } finally {
      setActionLoading(null);
    }
  }, [declineMoneyRequest, closeSheet, refresh]);

  const filteredSections = useMemo(() => {
    const filtered = !searchQuery
      ? sections
      : sections
          .map(s => ({
            ...s,
            data: s.data.filter(
              tx =>
                tx.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                tx.type.toLowerCase().includes(searchQuery.toLowerCase()),
            ),
          }))
          .filter(s => s.data.length > 0);

    if (transactionGrouping === "flat") {
      return [{ title: "", data: filtered.flatMap(s => s.data) }];
    }
    return filtered;
  }, [sections, searchQuery, transactionGrouping]);

  const renderItem = ({ item }: { item: Transaction }) => (
    <View style={{ paddingHorizontal: Spacing.lg }}>
      <TransactionItem item={item} onPress={() => setSelectedTx(item)} />
    </View>
  );

  const renderSectionHeader = ({ section: { title } }: { section: Section }) =>
    title ? (
      <View style={styles.sectionHeaderWrap}>
        <Text style={styles.sectionHeader}>{title}</Text>
      </View>
    ) : null;

  const emptyLabel =
    filter === "Pending" ? "No pending transactions" :
    filter === "Failed"  ? "No failed transactions" :
    filter === "Money In"  ? "No incoming transactions" :
    filter === "Money Out" ? "No outgoing transactions" :
    searchQuery ? "No results for your search" :
    "No transactions yet";

  const renderEmpty = () => (
    <View style={styles.emptyWrap}>
      <Feather name="inbox" size={44} color={Colors.border} style={{ marginBottom: Spacing.md }} />
      <Text style={styles.emptyTitle}>{emptyLabel}</Text>
      {!searchQuery && (
        <Text style={styles.emptySub}>
          {filter === "All" ? "Your transactions will appear here." : "Try a different filter."}
        </Text>
      )}
    </View>
  );

  // ─── Detail bottom sheet ─────────────────────────────────────────────────

  const renderDetailSheet = () => {
    if (!selectedTx) return null;
    const meta = resolveStatusMeta(selectedTx, Colors);
    const isPayable =
      selectedTx.isPending &&
      selectedTx.type === "Money Request" &&
      !selectedTx.isCredit;
    const amountPrefix = selectedTx.isCredit ? "+" : "−";
    const amountColor =
      selectedTx.status === "FAILED" || selectedTx.status === "CANCELLED"
        ? Colors.textSecondary
        : selectedTx.isCredit
          ? Colors.primary
          : Colors.textPrimary;

    return (
      <>
        {/* Status icon */}
        <View style={[styles.sheetIconWrap, { backgroundColor: meta.iconBg }]}>
          <Feather name={meta.iconName} size={26} color={meta.iconColor} />
        </View>

        {/* Amount */}
        <Text style={[styles.sheetAmount, { color: amountColor }]}>
          {amountPrefix}{formatCurrency(selectedTx.amount)}
        </Text>
        <Text style={styles.sheetCounterparty}>{selectedTx.name}</Text>

        {/* Status row */}
        <View style={[styles.statusRow, { backgroundColor: meta.iconBg }]}>
          <View style={[styles.statusDot, { backgroundColor: meta.iconColor }]} />
          <View>
            <Text style={[styles.statusLabel, { color: meta.labelColor }]}>{meta.label}</Text>
            <Text style={styles.statusSublabel}>{meta.sublabel}</Text>
          </View>
        </View>

        {/* Detail rows */}
        <View style={styles.detailCard}>
          <DetailRow label="Type" value={selectedTx.type} Colors={Colors} />
          <DetailRow label="Initiated" value={formatDetailDate(selectedTx.fullDate)} Colors={Colors} />
          {selectedTx.completedAt && (
            <DetailRow label="Completed" value={formatDetailDate(selectedTx.completedAt)} Colors={Colors} />
          )}
          {!!selectedTx.note && (
            <DetailRow label="Note" value={selectedTx.note} Colors={Colors} multiline />
          )}
          <DetailRow
            label="Reference"
            value={`AZA-${selectedTx.id.slice(0, 8).toUpperCase()}`}
            Colors={Colors}
          />
        </View>

        {/* Error */}
        {actionError && (
          <Text style={styles.actionError}>{actionError}</Text>
        )}

        {/* PIN entry */}
        {pinVisible ? (
          <View style={{ marginBottom: Spacing.md }}>
            <Text style={[styles.pinLabel]}>Enter your PIN to pay</Text>
            <TextInput
              ref={pinInputRef}
              value={pin}
              onChangeText={handlePinChange}
              keyboardType="number-pad"
              maxLength={PIN_LENGTH}
              style={styles.hiddenInput}
              autoFocus
              secureTextEntry
              autoCorrect={false}
              contextMenuHidden
            />
            <PinDots
              pin={pin}
              scaleAnims={scaleAnims}
              onPress={() => pinInputRef.current?.focus()}
              Colors={Colors}
            />
            {actionLoading === "accept" && (
              <ActivityIndicator
                size="small"
                color={Colors.primary}
                style={{ marginTop: 12 }}
              />
            )}
            <TouchableOpacity
              style={styles.cancelPinBtn}
              onPress={() => { setPinVisible(false); setPin(""); setActionError(null); }}
            >
              <Text style={[styles.cancelPinText, { color: Colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : isPayable ? (
          <View style={styles.actionRow}>
            <View style={{ flex: 1 }}>
              <Button
                title={actionLoading === "decline" ? "Declining…" : "Decline"}
                onPress={() => handleDecline(selectedTx)}
                disabled={!!actionLoading}
                backgroundColor={isDark ? Colors.background : Colors.surface}
                textColor={Colors.error}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title="Pay now"
                onPress={() => { setActionError(null); setPinVisible(true); }}
                disabled={!!actionLoading}
              />
            </View>
          </View>
        ) : (
          <Button
            title="Close"
            onPress={closeSheet}
            backgroundColor={isDark ? Colors.background : Colors.surface}
            textColor={Colors.textPrimary}
          />
        )}
      </>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} size={22} />
        <Text style={styles.headerTitle}>Transaction History</Text>
        <View style={{ width: 22 }} />
      </View>

      <SectionList
        sections={filteredSections}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={[
          styles.listContent,
          filteredSections.length === 0 && { flex: 1 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={Colors.primary}
          />
        }
        ListEmptyComponent={
          loading && sections.length === 0 ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : error ? (
            <View style={styles.emptyWrap}>
              <Feather name="wifi-off" size={44} color={Colors.border} style={{ marginBottom: Spacing.md }} />
              <Text style={styles.emptyTitle}>Couldn't load transactions</Text>
              <TouchableOpacity onPress={refresh} style={styles.retryBtn}>
                <Text style={[styles.emptySub, { color: Colors.primary }]}>Tap to retry</Text>
              </TouchableOpacity>
            </View>
          ) : renderEmpty
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          loading && sections.length > 0 ? (
            <View style={{ paddingVertical: Spacing.lg }}>
              <ActivityIndicator size="small" color={Colors.primary} />
            </View>
          ) : null
        }
        ListHeaderComponent={
          <>
            {/* Balance card */}
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>Account Balance</Text>
              <Text style={styles.balanceValue} numberOfLines={1} adjustsFontSizeToFit>
                {balance}
              </Text>
            </View>

            {/* Search + statement */}
            <View style={styles.searchRow}>
              <View style={styles.searchBox}>
                <Feather name="search" size={16} color={Colors.textSecondary} style={{ marginRight: Spacing.sm }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search transactions…"
                  placeholderTextColor={Colors.textSecondary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery("")}>
                    <Feather name="x" size={14} color={Colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                style={styles.statementBtn}
                onPress={() => navigation.navigate("StatementDownload")}
                accessibilityLabel="Download statement"
              >
                <Feather name="file-text" size={18} color={Colors.primary} />
                <View style={styles.statementBadge}>
                  <Feather name="arrow-down" size={9} color={Colors.white} />
                </View>
              </TouchableOpacity>
            </View>

            {/* Filter chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {FILTERS.map(f => {
                const active = filter === f;
                return (
                  <TouchableOpacity
                    key={f}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setFilter(f)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{f}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        }
      />

      {/* Transaction detail bottom sheet */}
      <Modal
        visible={!!selectedTx}
        transparent
        animationType="slide"
        onRequestClose={closeSheet}
      >
        <Pressable style={styles.overlay} onPress={closeSheet} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          {renderDetailSheet()}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Detail row helper ────────────────────────────────────────────────────────

function DetailRow({
  label,
  value,
  Colors,
  multiline,
}: {
  label: string;
  value: string;
  Colors: ThemeColors;
  multiline?: boolean;
}) {
  return (
    <View style={[detailRowStyle.row, multiline && { alignItems: "flex-start" }]}>
      <Text style={[detailRowStyle.label, { color: Colors.textSecondary }]}>{label}</Text>
      <Text
        style={[
          detailRowStyle.value,
          { color: Colors.textPrimary },
          multiline && { flex: 1, textAlign: "right", marginLeft: 16 },
        ]}
        numberOfLines={multiline ? 3 : 1}
      >
        {value}
      </Text>
    </View>
  );
}

const detailRowStyle = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  label: {
    ...Typography.body,
    fontSize: 13,
  },
  value: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: "500",
  },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
    },
    backButton: { padding: 4 },
    headerTitle: {
      ...Typography.h3,
      color: Colors.textPrimary,
    },
    listContent: {
      paddingBottom: Spacing.xl * 2,
    },

    // Balance card
    balanceCard: {
      backgroundColor: Colors.surface,
      borderRadius: Radius.lg,
      paddingVertical: Spacing.xl,
      paddingHorizontal: Spacing.xl,
      alignItems: "center",
      marginHorizontal: Spacing.lg,
      marginTop: Spacing.md,
      marginBottom: Spacing.lg,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    balanceLabel: {
      ...Typography.caption,
      color: Colors.textSecondary,
      marginBottom: 4,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    balanceValue: {
      ...Typography.h2,
      fontWeight: "700",
      color: Colors.textPrimary,
    },

    // Search
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.lg,
      gap: Spacing.sm,
    },
    searchBox: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDark ? Colors.surface : Colors.white,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.md,
      height: 44,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    searchInput: {
      flex: 1,
      ...Typography.body,
      color: Colors.textPrimary,
      fontSize: 14,
    },
    statementBtn: {
      width: 44,
      height: 44,
      backgroundColor: isDark ? Colors.surface : Colors.white,
      borderRadius: Radius.md,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: Colors.border,
    },
    statementBadge: {
      position: "absolute",
      bottom: 10,
      right: 10,
      backgroundColor: Colors.primary,
      borderRadius: Radius.full,
      width: 13,
      height: 13,
      justifyContent: "center",
      alignItems: "center",
    },

    // Filter chips
    filterRow: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.lg,
      gap: Spacing.sm,
    },
    chip: {
      paddingHorizontal: Spacing.md,
      paddingVertical: 7,
      borderRadius: Radius.full,
      backgroundColor: isDark ? Colors.surface : Colors.black10,
      borderWidth: 1,
      borderColor: "transparent",
      marginRight: 4,
    },
    chipActive: {
      backgroundColor: Colors.primary,
      borderColor: Colors.primary,
    },
    chipText: {
      ...Typography.body,
      fontSize: 13,
      color: Colors.textSecondary,
      fontWeight: "500",
    },
    chipTextActive: {
      color: Colors.white,
      fontWeight: "600",
    },

    // Section header
    sectionHeaderWrap: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.xs,
    },
    sectionHeader: {
      ...Typography.caption,
      fontSize: 11,
      fontWeight: "600",
      color: Colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },

    // Empty / error
    loadingWrap: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingTop: Spacing.xl * 3,
    },
    emptyWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: Spacing.xl * 3,
      paddingHorizontal: Spacing.xl,
    },
    emptyTitle: {
      ...Typography.h3,
      color: Colors.textPrimary,
      marginBottom: Spacing.xs,
      textAlign: "center",
    },
    emptySub: {
      ...Typography.body,
      color: Colors.textSecondary,
      textAlign: "center",
    },
    retryBtn: { marginTop: Spacing.sm },

    // Bottom sheet
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.45)",
    },
    sheet: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: isDark ? Colors.surface : Colors.white,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: Spacing.xl,
      paddingBottom: 36,
      paddingTop: Spacing.lg,
    },
    sheetHandle: {
      width: 36,
      height: 4,
      borderRadius: Radius.full,
      backgroundColor: Colors.border,
      alignSelf: "center",
      marginBottom: Spacing.lg,
    },
    sheetIconWrap: {
      width: 56,
      height: 56,
      borderRadius: Radius.full,
      justifyContent: "center",
      alignItems: "center",
      alignSelf: "center",
      marginBottom: Spacing.md,
    },
    sheetAmount: {
      ...Typography.h2,
      fontWeight: "700",
      textAlign: "center",
      marginBottom: 4,
    },
    sheetCounterparty: {
      ...Typography.body,
      color: Colors.textSecondary,
      textAlign: "center",
      marginBottom: Spacing.lg,
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: Radius.md,
      padding: Spacing.md,
      marginBottom: Spacing.md,
      gap: Spacing.sm,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    statusLabel: {
      ...Typography.body,
      fontWeight: "700",
      fontSize: 13,
    },
    statusSublabel: {
      ...Typography.caption,
      color: Colors.textSecondary,
      marginTop: 1,
    },
    detailCard: {
      backgroundColor: isDark ? Colors.background : Colors.surface,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.md,
      marginBottom: Spacing.lg,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    actionError: {
      color: Colors.error,
      fontSize: 13,
      textAlign: "center",
      marginBottom: Spacing.sm,
    },
    pinLabel: {
      ...Typography.body,
      color: Colors.textSecondary,
      textAlign: "center",
      marginBottom: Spacing.md,
    },
    hiddenInput: {
      position: "absolute",
      width: 0,
      height: 0,
      opacity: 0,
    },
    cancelPinBtn: {
      alignSelf: "center",
      marginTop: Spacing.md,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.lg,
    },
    cancelPinText: {
      ...Typography.body,
      fontSize: 14,
    },
    actionRow: {
      flexDirection: "row",
      gap: Spacing.md,
    },
  });
}
