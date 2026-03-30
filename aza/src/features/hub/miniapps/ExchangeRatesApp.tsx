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
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';
import { MiniAppProps } from './types';

type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'NGN' | 'XOF' | 'ZAR';
type Direction = 'GHS_TO' | 'TO_GHS';

interface CurrencyInfo {
  rate: number; // units of currency per 1 GHS
  flag: string;
  name: string;
  symbol: string;
}

const RATES: Record<CurrencyCode, CurrencyInfo> = {
  USD: { rate: 0.067, flag: '🇺🇸', name: 'US Dollar', symbol: '$' },
  EUR: { rate: 0.062, flag: '🇪🇺', name: 'Euro', symbol: '€' },
  GBP: { rate: 0.053, flag: '🇬🇧', name: 'British Pound', symbol: '£' },
  NGN: { rate: 101.2, flag: '🇳🇬', name: 'Nigerian Naira', symbol: '₦' },
  XOF: { rate: 40.5, flag: '🌍', name: 'CFA Franc', symbol: 'XOF' },
  ZAR: { rate: 1.23, flag: '🇿🇦', name: 'South African Rand', symbol: 'R' },
};

const CURRENCY_CODES = Object.keys(RATES) as CurrencyCode[];

export default function ExchangeRatesApp({ onClose }: MiniAppProps) {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);

  const [direction, setDirection] = useState<Direction>('GHS_TO');
  const [selected, setSelected] = useState<CurrencyCode>('USD');
  const [inputAmount, setInputAmount] = useState('');

  const info = RATES[selected];
  const parsed = parseFloat(inputAmount);
  const hasResult = !isNaN(parsed) && parsed > 0;

  const converted = hasResult
    ? direction === 'GHS_TO'
      ? parsed * info.rate
      : parsed / info.rate
    : null;

  const resultLabel = direction === 'GHS_TO'
    ? `${info.flag} ${info.symbol}${converted?.toFixed(2)}`
    : `GH₵ ${converted?.toFixed(2)}`;

  const rateLabel = direction === 'GHS_TO'
    ? `1 GHS = ${info.symbol}${info.rate.toFixed(4)} ${selected}`
    : `1 ${selected} = GH₵${(1 / info.rate).toFixed(4)}`;

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
        {/* Direction toggle */}
        <View style={styles.toggle}>
          {(['GHS_TO', 'TO_GHS'] as Direction[]).map((d) => (
            <TouchableOpacity
              key={d}
              style={[styles.togglePill, direction === d && styles.togglePillActive]}
              onPress={() => { setDirection(d); setInputAmount(''); }}
              accessibilityRole="radio"
              accessibilityLabel={d === 'GHS_TO' ? 'GHS to foreign currency' : 'Foreign currency to GHS'}
              accessibilityState={{ checked: direction === d }}
            >
              <Text style={[styles.toggleText, direction === d && styles.toggleTextActive]}>
                {d === 'GHS_TO' ? 'GHS → Foreign' : 'Foreign → GHS'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Input */}
        <Text style={styles.sectionLabel}>
          {direction === 'GHS_TO' ? 'Amount (GH₵)' : `Amount (${selected})`}
        </Text>
        <View style={styles.inputContainer}>
          <Text style={styles.inputPrefix}>
            {direction === 'GHS_TO' ? 'GH₵' : info.symbol}
          </Text>
          <TextInput
            style={styles.input}
            placeholder="0.00"
            placeholderTextColor={Colors.textSecondary}
            keyboardType="decimal-pad"
            value={inputAmount}
            onChangeText={setInputAmount}
            accessibilityLabel="Amount to convert"
          />
        </View>

        {/* Currency grid */}
        <Text style={styles.sectionLabel}>Currency</Text>
        <View style={styles.currencyGrid}>
          {CURRENCY_CODES.map((code) => {
            const cur = RATES[code];
            const active = selected === code;
            return (
              <TouchableOpacity
                key={code}
                style={[styles.currencyCard, active && styles.currencyCardActive]}
                onPress={() => setSelected(code)}
                accessibilityRole="radio"
                accessibilityLabel={`${cur.name}`}
                accessibilityState={{ checked: active }}
              >
                <Text style={styles.currencyFlag}>{cur.flag}</Text>
                <Text style={[styles.currencyCode, active && { color: Colors.primary }]}>{code}</Text>
                <Text style={styles.currencyName} numberOfLines={1}>{cur.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Result card */}
        {hasResult && converted !== null && (
          <View style={styles.resultCard}>
            <Text style={styles.resultAmount}>{resultLabel}</Text>
            <Text style={styles.resultRate}>{rateLabel}</Text>
          </View>
        )}

        {/* All rates table */}
        <Text style={styles.sectionLabel}>Today's Rates (per GHS)</Text>
        <View style={styles.ratesTable}>
          {CURRENCY_CODES.map((code, idx) => {
            const cur = RATES[code];
            return (
              <View
                key={code}
                style={[
                  styles.rateRow,
                  idx === CURRENCY_CODES.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <Text style={styles.rateFlag}>{cur.flag}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rateCode}>{code}</Text>
                  <Text style={styles.rateName}>{cur.name}</Text>
                </View>
                <Text style={styles.rateValue}>
                  {cur.symbol}{cur.rate.toFixed(4)}
                </Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.disclaimer}>
          Rates are indicative. Actual rates may vary at time of transaction.
        </Text>
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
    toggle: {
      flexDirection: 'row',
      backgroundColor: Colors.surface,
      borderRadius: Radius.full,
      padding: 3,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    togglePill: {
      flex: 1,
      paddingVertical: 9,
      borderRadius: Radius.full,
      alignItems: 'center',
    },
    togglePillActive: { backgroundColor: Colors.primary },
    toggleText: { ...Typography.caption, color: Colors.textSecondary, fontWeight: '600' },
    toggleTextActive: { color: Colors.secondary },
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
    inputPrefix: {
      ...Typography.bodyLg,
      fontWeight: '700',
      color: Colors.textSecondary,
      marginRight: Spacing.sm,
    },
    input: { flex: 1, ...Typography.bodyLg, color: Colors.textPrimary },
    currencyGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    currencyCard: {
      width: '30%',
      alignItems: 'center',
      paddingVertical: Spacing.sm,
      paddingHorizontal: 4,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.surface,
    },
    currencyCardActive: {
      borderColor: Colors.primary,
      borderWidth: 2,
      backgroundColor: Colors.isDark ? Colors.surface : '#F0F9F0',
    },
    currencyFlag: { fontSize: 22, marginBottom: 2 },
    currencyCode: {
      ...Typography.caption,
      fontWeight: '700',
      color: Colors.textPrimary,
    },
    currencyName: {
      fontSize: 9,
      color: Colors.textSecondary,
      textAlign: 'center',
    },
    resultCard: {
      marginTop: Spacing.lg,
      backgroundColor: Colors.isDark ? Colors.surface : '#F0F9F0',
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: Colors.primary,
      padding: Spacing.lg,
      alignItems: 'center',
    },
    resultAmount: {
      fontSize: 28,
      fontWeight: '700',
      color: Colors.primary,
      marginBottom: 4,
    },
    resultRate: { ...Typography.caption, color: Colors.textSecondary },
    ratesTable: {
      backgroundColor: Colors.surface,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: Colors.border,
      overflow: 'hidden',
    },
    rateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.border,
      gap: Spacing.sm,
    },
    rateFlag: { fontSize: 20 },
    rateCode: { ...Typography.body, fontWeight: '700', color: Colors.textPrimary },
    rateName: { ...Typography.caption, color: Colors.textSecondary },
    rateValue: { ...Typography.body, fontWeight: '600', color: Colors.textPrimary },
    disclaimer: {
      ...Typography.caption,
      color: Colors.textSecondary,
      textAlign: 'center',
      marginTop: Spacing.lg,
      fontStyle: 'italic',
    },
  });
}
