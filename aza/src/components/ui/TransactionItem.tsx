import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from "../../theme";
import { Transaction } from "../../features/home/screens/TransactionsScreen";

export type TransactionItemProps = {
  item: Transaction;
  onPress?: () => void;
};

export function TransactionItem({ item, onPress }: TransactionItemProps) {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);

  const formatCurrency = (amount: number) => {
    return `GH₵ ${amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <TouchableOpacity 
      style={styles.transactionItem}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View style={styles.transactionLeft}>
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: item.isCredit
                ? "rgba(183, 238, 122, 0.2)" // light secondary
                : "rgba(234, 67, 53, 0.1)", // light error
            },
          ]}
        >
          <Feather
            name={item.isCredit ? "arrow-down-left" : "arrow-up-right"}
            size={18}
            color={item.isCredit ? Colors.primary : Colors.error}
          />
        </View>
        <View style={styles.transactionDetails}>
          <Text style={styles.transactionName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.transactionSub}>
            {item.type} • {item.time}
          </Text>
        </View>
      </View>
      <Text
        style={[
          styles.transactionAmount,
          { color: item.isCredit ? Colors.primary : Colors.textPrimary },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {formatCurrency(item.amount)}
      </Text>
    </TouchableOpacity>
  );
}

function createStyles(Colors: ThemeColors) {
  return StyleSheet.create({
    transactionItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: Spacing.md,
    },
    transactionLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: Radius.full,
      justifyContent: "center",
      alignItems: "center",
      marginRight: Spacing.md,
    },
    transactionDetails: {
      flex: 1,
    },
    transactionName: {
      ...Typography.body,
      color: Colors.textPrimary,
      fontWeight: "500",
      marginBottom: 2,
    },
    transactionSub: {
      ...Typography.caption,
      color: Colors.textSecondary,
    },
    transactionAmount: {
      ...Typography.body,
      fontWeight: "600",
      marginLeft: Spacing.sm,
      flexShrink: 1,
      textAlign: "right",
    },
  });
}
