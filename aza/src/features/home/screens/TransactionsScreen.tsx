import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SectionList,
  TextInput,
  Platform,
  RefreshControl,
  ScrollView,
  Modal,
  Pressable,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
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
import { INITIAL_RECIPIENTS } from "../../contacts";
import Button from "../../../components/ui/Button";

export type Transaction = {
  id: string;
  name: string;
  type: string;
  time: string;
  amount: number;
  isCredit: boolean;
  isPending?: boolean;
};

export type Section = {
  title: string;
  data: Transaction[];
};

export const mockTransactions: Section[] = [
  {
    title: "January 22, 2024",
    data: [
      {
        id: "0",
        name: "Paapa Cobbold",
        type: "Transfers",
        time: "11:45 AM",
        amount: 150000.1,
        isCredit: false,
        isPending: true,
      },
      {
        id: "1",
        name: "Davies Opoku",
        type: "Transfers",
        time: "10:25 AM",
        amount: 2000000.0,
        isCredit: true,
      },
      {
        id: "2",
        name: "Ibrahim Mahama",
        type: "Transfers",
        time: "10:26 AM",
        amount: 594200.0,
        isCredit: false,
      },
      {
        id: "3",
        name: "Charlotte osei",
        type: "Transfers",
        time: "10:23 AM",
        amount: 1204000.0,
        isCredit: false,
      },
    ],
  },
  {
    title: "January 21, 2024",
    data: [
      {
        id: "4",
        name: "Kevin Okyere",
        type: "Transfers",
        time: "10:25 AM",
        amount: 17200.0,
        isCredit: false,
      },
      {
        id: "5",
        name: "Shirley Ayorkor Botchwey",
        type: "Transfers",
        time: "10:25 AM",
        amount: 8000000.0,
        isCredit: true,
      },
    ],
  },
];

export function TransactionsScreen() {
  const { colors: Colors, isDark } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "Transactions">>();
  const balance = route.params?.balance || "GH₵ 0.00";

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<
    "All" | "Money In" | "Money Out" | "Pending"
  >("All");
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Simulate a network request or data refresh
    const timer = setTimeout(() => {
      setRefreshing(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const filteredSections = useMemo(() => {
    return mockTransactions
      .map((section) => {
        const filteredData = section.data.filter((tx) => {
          const matchesSearch =
            tx.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            tx.type.toLowerCase().includes(searchQuery.toLowerCase());
          if (!matchesSearch) return false;

          if (selectedFilter === "Money In" && !tx.isCredit) return false;
          if (selectedFilter === "Money Out" && tx.isCredit) return false;
          if (selectedFilter === "Pending" && !tx.isPending) return false;

          return true;
        });

        return { ...section, data: filteredData };
      })
      .filter((section) => section.data.length > 0);
  }, [searchQuery, selectedFilter]);

  const formatCurrency = (amount: number) => {
    return `GH₵ ${amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const renderTransaction = ({ item }: { item: Transaction }) => {
    return (
      <View style={{ paddingHorizontal: Spacing.lg }}>
        <TransactionItem
          item={item}
          onPress={() => setSelectedTransaction(item)}
        />
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyStateContainer}>
      <Feather
        name="search"
        size={48}
        color={Colors.border}
        style={{ marginBottom: Spacing.md }}
      />
      <Text style={styles.emptyStateTitle}>No transactions found</Text>
      <Text style={styles.emptyStateSub}>
        Try adjusting your search or filters.
      </Text>
    </View>
  );

  const renderSectionHeader = ({
    section: { title },
  }: {
    section: Section;
  }) => (
    <View style={styles.sectionHeaderContainer}>
      <Text style={styles.sectionHeader}>{title}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
        >
          <Feather name="arrow-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Transaction History</Text>
        <View style={{ width: 24 }} />
      </View>

      <SectionList
        sections={filteredSections}
        keyExtractor={(item) => item.id}
        renderItem={renderTransaction}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={[
          styles.listContent,
          filteredSections.length === 0 && { flex: 1 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
        ListEmptyComponent={renderEmptyState}
        onEndReached={() => {
          // In a real app, this would trigger loading the next page of transactions
        }}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <>
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>Account Balance</Text>
              <Text
                style={styles.balanceValue}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {balance}
              </Text>
            </View>

            <View style={styles.searchRow}>
              <View style={styles.searchContainer}>
                <Feather
                  name="search"
                  size={20}
                  color={Colors.textSecondary}
                  style={styles.searchIcon}
                />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search"
                  placeholderTextColor={Colors.textSecondary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
              <TouchableOpacity
                style={styles.downloadBtn}
                onPress={() => navigation.navigate("StatementDownload")}
              >
                <Feather name="file-text" size={20} color={Colors.primary} />
                <View style={styles.downloadIconBadge}>
                  <Feather name="arrow-down" size={10} color={Colors.white} />
                </View>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filtersContainer}
            >
              {(["All", "Money In", "Money Out", "Pending"] as const).map(
                (filter) => {
                  const isActive = selectedFilter === filter;
                  return (
                    <TouchableOpacity
                      key={filter}
                      style={[
                        styles.filterChip,
                        isActive && styles.filterChipActive,
                      ]}
                      onPress={() => setSelectedFilter(filter)}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          isActive && styles.filterChipTextActive,
                        ]}
                      >
                        {filter}
                      </Text>
                    </TouchableOpacity>
                  );
                },
              )}
            </ScrollView>
          </>
        }
      />

      <Modal
        visible={!!selectedTransaction}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedTransaction(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setSelectedTransaction(null)}
        />
        <View style={styles.bottomSheet}>
          <View style={styles.bottomSheetHandle} />

          {selectedTransaction && (
            <>
              {(() => {
                const contact = INITIAL_RECIPIENTS.find(
                  (c) => c.name.toLowerCase() === selectedTransaction.name.toLowerCase()
                );

                return (
                  <>
                    {contact ? (
                      <View style={{ alignItems: "center", marginBottom: Spacing.md }}>
                        <Image source={{ uri: contact.avatar }} style={styles.contactAvatar} />
                        <Text style={styles.contactName}>{contact.name}</Text>
                        <Text style={styles.contactUsername}>{contact.username}</Text>
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.bottomSheetIcon,
                          {
                            alignSelf: "center",
                            backgroundColor: selectedTransaction.isCredit
                              ? "rgba(183, 238, 122, 0.2)"
                              : "rgba(234, 67, 53, 0.1)",
                            marginBottom: Spacing.md,
                          },
                        ]}
                      >
                        <Feather
                          name={
                            selectedTransaction.isCredit
                              ? "arrow-down-left"
                              : "arrow-up-right"
                          }
                          size={24}
                          color={
                            selectedTransaction.isCredit ? Colors.primary : Colors.error
                          }
                        />
                      </View>
                    )}

                    <Text style={styles.bottomSheetAmount}>
                      {formatCurrency(selectedTransaction.amount)}
                    </Text>

                    {!contact && (
                      <Text style={styles.bottomSheetTitle}>
                        {selectedTransaction.name}
                      </Text>
                    )}

                    <View style={styles.detailsList}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status</Text>
                  <Text
                    style={[
                      styles.detailValue,
                      selectedTransaction.isPending && {
                        color: Colors.primary,
                      },
                    ]}
                  >
                    {selectedTransaction.isPending ? "Pending" : "Successful"}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Type</Text>
                  <Text style={styles.detailValue}>
                    {selectedTransaction.type}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Time</Text>
                  <Text style={styles.detailValue}>
                    {selectedTransaction.time}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Reference ID</Text>
                  <Text style={styles.detailValue}>
                    AZA-{selectedTransaction.id.padStart(8, "0")}
                  </Text>
                </View>
              </View>

              <Button
                title="Close"
                onPress={() => setSelectedTransaction(null)}
                backgroundColor={isDark ? Colors.background : Colors.surface}
                textColor={Colors.textPrimary}
              />
            </>
          );
        })()}
            </>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

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
    backButton: {
      padding: Spacing.xs,
    },
    headerTitle: {
      ...Typography.h3,
      color: Colors.textPrimary,
    },
    listContent: {
      paddingBottom: Spacing.xl * 2,
    },
    balanceCard: {
      backgroundColor: isDark ? Colors.surface : Colors.surface,
      borderRadius: Radius.lg,
      padding: Spacing.xl,
      alignItems: "center",
      marginHorizontal: Spacing.lg,
      marginTop: Spacing.md,
      marginBottom: Spacing.xl,
    },
    balanceLabel: {
      ...Typography.body,
      color: isDark ? Colors.textSecondary : Colors.primary,
      marginBottom: Spacing.xs,
    },
    balanceValue: {
      ...Typography.h2,
      color: isDark ? Colors.textPrimary : Colors.primary,
    },
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: Spacing.lg,
      marginBottom: Spacing.xl,
    },
    searchContainer: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDark ? Colors.surface : Colors.white,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.md,
      height: 48,
      marginRight: Spacing.md,
    },
    searchIcon: {
      marginRight: Spacing.sm,
    },
    searchInput: {
      flex: 1,
      height: "100%",
      ...Typography.body,
      color: Colors.textPrimary,
    },
    downloadBtn: {
      width: 48,
      height: 48,
      backgroundColor: isDark ? Colors.surface : Colors.white,
      borderRadius: Radius.md,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: isDark ? Colors.border : "#DDF0E6", // subtle green border
    },
    downloadIconBadge: {
      position: "absolute",
      bottom: 12,
      right: 12,
      backgroundColor: Colors.primary,
      borderRadius: Radius.full,
      width: 14,
      height: 14,
      justifyContent: "center",
      alignItems: "center",
    },
    sectionHeaderContainer: {
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.sm,
      marginTop: Spacing.md,
    },
    sectionHeader: {
      ...Typography.caption,
      color: Colors.textSecondary,
      backgroundColor: isDark ? Colors.surface : Colors.black10,
      alignSelf: "flex-start",
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
      borderRadius: Radius.full,
      overflow: "hidden", // for border radius to apply on text element background on android
    },
    filtersContainer: {
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.xl,
      gap: Spacing.sm,
    },
    filterChip: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.full,
      backgroundColor: isDark ? Colors.surface : Colors.black10,
      borderWidth: 1,
      borderColor: "transparent",
      marginRight: Spacing.sm,
    },
    filterChipActive: {
      backgroundColor: Colors.primary,
    },
    filterChipText: {
      ...Typography.body,
      color: Colors.textSecondary,
      fontWeight: "500",
    },
    filterChipTextActive: {
      color: Colors.white,
    },
    emptyStateContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: Spacing.xl * 3,
    },
    emptyStateTitle: {
      ...Typography.h3,
      color: Colors.textPrimary,
      marginBottom: Spacing.xs,
    },
    emptyStateSub: {
      ...Typography.body,
      color: Colors.textSecondary,
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
      marginBottom: Spacing.xl,
    },
    bottomSheetIcon: {
      width: 56,
      height: 56,
      borderRadius: Radius.full,
      justifyContent: "center",
      alignItems: "center",
    },
    contactAvatar: {
      width: 72,
      height: 72,
      borderRadius: Radius.full,
      marginBottom: Spacing.sm,
    },
    contactName: {
      ...Typography.h3,
      color: Colors.textPrimary,
      marginBottom: 2,
    },
    contactUsername: {
      ...Typography.body,
      color: Colors.primary,
      fontWeight: "500",
    },
    bottomSheetAmount: {
      ...Typography.h2,
      color: isDark ? Colors.textPrimary : Colors.black,
      textAlign: "center",
      marginBottom: Spacing.xs,
    },
    bottomSheetTitle: {
      ...Typography.body,
      color: Colors.textSecondary,
      textAlign: "center",
      marginBottom: Spacing.xl,
    },
    detailsList: {
      backgroundColor: isDark ? Colors.background : Colors.surface,
      borderRadius: Radius.md,
      padding: Spacing.md,
      marginBottom: Spacing.xl,
      gap: Spacing.md,
    },
    detailRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    detailLabel: {
      ...Typography.body,
      color: Colors.textSecondary,
    },
    detailValue: {
      ...Typography.body,
      color: Colors.textPrimary,
      fontWeight: "500",
    },
    sheetActions: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 40,
      width: "100%",
      marginBottom: Spacing.xl,
    },
    actionItem: {
      alignItems: "center",
      width: 80,
    },
    actionCircleButton: {
      width: 60,
      height: 60,
      borderRadius: Radius.full,
      backgroundColor: Colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: Spacing.sm,
    },
    actionLabel: {
      ...Typography.body,
      fontWeight: "700",
      color: Colors.primary,
    },
  });
}
