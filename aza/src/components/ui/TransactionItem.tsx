import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Feather } from '@react-native-vector-icons/feather';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from "../../theme";
import { useDisplayContext } from "../../providers/DisplayProvider";
import { Transaction } from "../../features/home/screens/TransactionsScreen";
import { formatCurrency } from "../../utils/transactionUtils";

export type TransactionItemProps = {
  item: Transaction;
  onPress?: () => void;
};

type StatusChip = { label: string; bg: string; color: string };

function resolveStatusChip(status: string | undefined, isPending: boolean | undefined, Colors: ThemeColors): StatusChip | null {
  const s = status ?? (isPending ? 'PENDING' : undefined);
  switch (s) {
    case 'PENDING':   return { label: 'Pending',   bg: 'rgba(245,158,11,0.12)', color: '#D97706' };
    case 'FAILED':    return { label: 'Failed',    bg: 'rgba(234,67,53,0.10)',  color: Colors.error };
    case 'CANCELLED': return { label: 'Cancelled', bg: 'rgba(107,114,128,0.12)', color: Colors.textSecondary };
    default:          return null;
  }
}

export function TransactionItem({ item, onPress }: TransactionItemProps) {
  const { colors: Colors } = useAppTheme();
  const { transactionDensity } = useDisplayContext();
  const compact = transactionDensity === 'compact';
  const styles = React.useMemo(() => createStyles(Colors, compact), [Colors, compact]);

  const chip = resolveStatusChip(item.status, item.isPending, Colors);
  const isSettled = !chip; // COMPLETED or unknown — treat as done

  // Icon appearance
  const isTerminal = item.status === 'FAILED' || item.status === 'CANCELLED';
  const iconBg = isTerminal
    ? 'rgba(107,114,128,0.10)'
    : item.isCredit
      ? 'rgba(183,238,122,0.22)'
      : 'rgba(23,71,23,0.08)';
  const iconColor = isTerminal
    ? Colors.textSecondary
    : item.isCredit
      ? Colors.primary
      : Colors.textPrimary;

  // Amount
  const amountColor = isTerminal
    ? Colors.textSecondary
    : item.isCredit
      ? Colors.primary
      : Colors.textPrimary;
  const prefix = item.isCredit ? '+' : '−';
  const amountFormatted = formatCurrency(item.amount, item.currency);
  const amountStr = `${prefix}${amountFormatted}`;

  return (
    <TouchableOpacity
      style={[styles.row, !isSettled && styles.rowMuted]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
        <Feather
          name={item.isCredit ? 'arrow-down-left' : 'arrow-up-right'}
          size={compact ? 15 : 18}
          color={iconColor}
        />
      </View>

      <View style={styles.middle}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        <View style={styles.subRow}>
          <Text style={styles.sub} numberOfLines={1}>{item.type} · {item.time}</Text>
          {chip && (
            <View style={[styles.chip, { backgroundColor: chip.bg }]}>
              <Text style={[styles.chipText, { color: chip.color }]}>{chip.label}</Text>
            </View>
          )}
        </View>
      </View>

      <Text
        style={[styles.amount, { color: amountColor }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {amountStr}
      </Text>
    </TouchableOpacity>
  );
}

function createStyles(Colors: ThemeColors, compact: boolean) {
  const iconSize = compact ? 32 : 40;
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: compact ? Spacing.sm : Spacing.md,
    },
    rowMuted: {
      opacity: 0.72,
    },
    iconWrap: {
      width: iconSize,
      height: iconSize,
      borderRadius: Radius.full,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: compact ? Spacing.sm : Spacing.md,
      flexShrink: 0,
    },
    middle: {
      flex: 1,
      marginRight: Spacing.sm,
    },
    name: {
      ...Typography.body,
      fontSize: compact ? 13 : 14,
      color: Colors.textPrimary,
      fontWeight: '500',
      marginBottom: 2,
    },
    subRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexWrap: 'nowrap',
    },
    sub: {
      ...Typography.caption,
      fontSize: compact ? 11 : 12,
      color: Colors.textSecondary,
    },
    chip: {
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 4,
    },
    chipText: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    amount: {
      ...Typography.body,
      fontSize: compact ? 13 : 14,
      fontWeight: '600',
      flexShrink: 1,
      textAlign: 'right',
    },
  });
}
