import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';
import { MiniAppProps } from './types';

type Category = 'Electricity' | 'Water' | 'TV' | 'Internet';

const CATEGORIES: { id: Category; label: string; emoji: string }[] = [
  { id: 'Electricity', label: 'Electricity', emoji: '⚡' },
  { id: 'Water', label: 'Water', emoji: '💧' },
  { id: 'TV', label: 'TV', emoji: '📺' },
  { id: 'Internet', label: 'Internet', emoji: '🌐' },
];

const BILLERS: Record<Category, string[]> = {
  Electricity: ['ECG', 'NEDCo'],
  Water: ['GWCL', 'Accra Water'],
  TV: ['DStv', 'GOtv', 'StarTimes'],
  Internet: ['MTN Broadband', 'Vodafone Broadband', 'Surfline'],
};

export default function PayBillsApp({ onClose }: MiniAppProps) {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);

  const [category, setCategory] = useState<Category | null>(null);
  const [biller, setBiller] = useState<string | null>(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [amount, setAmount] = useState('');

  const handleCategorySelect = (cat: Category) => {
    setCategory(cat);
    setBiller(null);
  };

  const isValid =
    category !== null &&
    biller !== null &&
    accountNumber.trim().length >= 4 &&
    parseFloat(amount) > 0;

  const allFilled = category && biller && accountNumber.trim() && amount.trim();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Category */}
        <Text style={styles.sectionLabel}>Bill Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow}>
          {CATEGORIES.map((cat) => {
            const active = category === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryChip, active && styles.categoryChipActive]}
                onPress={() => handleCategorySelect(cat.id)}
                accessibilityRole="radio"
                accessibilityLabel={cat.label}
                accessibilityState={{ checked: active }}
              >
                <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                <Text style={[styles.categoryLabel, active && styles.categoryLabelActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Biller */}
        {category && (
          <>
            <Text style={styles.sectionLabel}>Select Biller</Text>
            <View style={styles.billerList}>
              {BILLERS[category].map((b) => {
                const active = biller === b;
                return (
                  <TouchableOpacity
                    key={b}
                    style={[styles.billerRow, active && styles.billerRowActive]}
                    onPress={() => setBiller(b)}
                    accessibilityRole="radio"
                    accessibilityLabel={b}
                    accessibilityState={{ checked: active }}
                  >
                    <Text style={[styles.billerName, active && { color: Colors.primary, fontWeight: '700' }]}>
                      {b}
                    </Text>
                    {active
                      ? <Feather name="check-circle" size={18} color={Colors.primary} />
                      : <Feather name="chevron-right" size={18} color={Colors.textSecondary} />
                    }
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* Account number */}
        {biller && (
          <>
            <Text style={styles.sectionLabel}>Account / Meter Number</Text>
            <View style={styles.inputContainer}>
              <Feather name="hash" size={18} color={Colors.textSecondary} style={{ marginRight: Spacing.sm }} />
              <TextInput
                style={styles.input}
                placeholder="Enter account number"
                placeholderTextColor={Colors.textSecondary}
                value={accountNumber}
                onChangeText={setAccountNumber}
                accessibilityLabel="Account or meter number"
              />
            </View>

            <Text style={styles.sectionLabel}>Amount (GH₵)</Text>
            <View style={styles.inputContainer}>
              <Text style={[styles.currencyPrefix, { color: Colors.textSecondary }]}>GH₵</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                placeholderTextColor={Colors.textSecondary}
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
                accessibilityLabel="Amount in Ghana cedis"
              />
            </View>
          </>
        )}

        {/* Summary card */}
        {allFilled && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Payment Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryKey}>Biller</Text>
              <Text style={styles.summaryValue}>{biller}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryKey}>Account</Text>
              <Text style={styles.summaryValue}>{accountNumber}</Text>
            </View>
            <View style={[styles.summaryRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.summaryKey}>Amount</Text>
              <Text style={[styles.summaryValue, { color: Colors.primary, fontWeight: '700' }]}>
                GH₵{parseFloat(amount || '0').toFixed(2)}
              </Text>
            </View>
          </View>
        )}

        {/* CTA */}
        <TouchableOpacity
          style={[styles.ctaButton, !isValid && styles.ctaButtonDisabled]}
          disabled={!isValid}
          accessibilityRole="button"
          accessibilityLabel="Pay bill"
          accessibilityState={{ disabled: !isValid }}
        >
          <Text style={styles.ctaText}>
            {isValid ? `Pay GH₵${parseFloat(amount).toFixed(2)}` : 'Pay Bill'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(Colors: ThemeColors) {
  return StyleSheet.create({
    scroll: { flex: 1, backgroundColor: Colors.background },
    content: { padding: Spacing.lg, paddingBottom: Spacing.xl * 2 },
    sectionLabel: {
      ...Typography.body,
      fontWeight: '600',
      color: Colors.textPrimary,
      marginBottom: Spacing.sm,
      marginTop: Spacing.lg,
    },
    categoryRow: { flexDirection: 'row', marginBottom: Spacing.sm },
    categoryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.surface,
      marginRight: Spacing.sm,
    },
    categoryChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    categoryEmoji: { fontSize: 16 },
    categoryLabel: { ...Typography.body, color: Colors.textSecondary, fontWeight: '600' },
    categoryLabelActive: { color: Colors.secondary },
    billerList: {
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: Radius.md,
      overflow: 'hidden',
      backgroundColor: Colors.surface,
    },
    billerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      paddingVertical: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.border,
    },
    billerRowActive: { backgroundColor: Colors.isDark ? Colors.background : '#F0F9F0' },
    billerName: { ...Typography.body, color: Colors.textPrimary },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.md,
      height: 52,
    },
    input: { flex: 1, ...Typography.bodyLg, color: Colors.textPrimary },
    currencyPrefix: { ...Typography.bodyLg, fontWeight: '600', marginRight: 4 },
    summaryCard: {
      marginTop: Spacing.lg,
      backgroundColor: Colors.surface,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: Colors.border,
      padding: Spacing.md,
    },
    summaryTitle: {
      ...Typography.body,
      fontWeight: '700',
      color: Colors.textPrimary,
      marginBottom: Spacing.sm,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.border,
    },
    summaryKey: { ...Typography.body, color: Colors.textSecondary },
    summaryValue: { ...Typography.body, color: Colors.textPrimary },
    ctaButton: {
      marginTop: Spacing.xl,
      backgroundColor: Colors.primary,
      borderRadius: Radius.full,
      paddingVertical: 16,
      alignItems: 'center',
    },
    ctaButtonDisabled: { opacity: 0.4 },
    ctaText: { ...Typography.button, color: Colors.secondary, fontWeight: '700' },
  });
}
