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

type Network = 'MTN' | 'Vodafone' | 'AirtelTigo';
type TopupType = 'airtime' | 'data';

const NETWORKS: { id: Network; label: string; color: string; emoji: string }[] = [
  { id: 'MTN', label: 'MTN', color: '#FFC107', emoji: '🟡' },
  { id: 'Vodafone', label: 'Vodafone', color: '#E53935', emoji: '🔴' },
  { id: 'AirtelTigo', label: 'AirtelTigo', color: '#1565C0', emoji: '🔵' },
];

const AIRTIME_AMOUNTS = [5, 10, 20, 50];

const DATA_BUNDLES = [
  { label: '500MB', price: 5 },
  { label: '1GB', price: 10 },
  { label: '3GB', price: 25 },
  { label: '5GB', price: 40 },
];

export default function AirtimeDataApp({ onClose }: MiniAppProps) {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);

  const [network, setNetwork] = useState<Network | null>(null);
  const [topupType, setTopupType] = useState<TopupType>('airtime');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [selectedBundle, setSelectedBundle] = useState<typeof DATA_BUNDLES[0] | null>(null);

  const isValid =
    network !== null &&
    phoneNumber.replace(/\s/g, '').length >= 10 &&
    (topupType === 'airtime' ? selectedAmount !== null : selectedBundle !== null);

  const buttonLabel = () => {
    if (!isValid) return 'Top Up';
    if (topupType === 'airtime') return `Top Up GH₵${selectedAmount}`;
    return `Buy ${selectedBundle?.label} – GH₵${selectedBundle?.price}`;
  };

  const handleTypeSwitch = (t: TopupType) => {
    setTopupType(t);
    setSelectedAmount(null);
    setSelectedBundle(null);
  };

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
        {/* Network */}
        <Text style={styles.sectionLabel}>Select Network</Text>
        <View style={styles.networkRow}>
          {NETWORKS.map((n) => {
            const active = network === n.id;
            return (
              <TouchableOpacity
                key={n.id}
                style={[styles.networkCard, active && { borderColor: n.color, borderWidth: 2 }]}
                onPress={() => setNetwork(n.id)}
                accessibilityRole="radio"
                accessibilityLabel={n.label}
                accessibilityState={{ checked: active }}
              >
                <View style={[styles.networkDot, { backgroundColor: n.color }]} />
                <Text style={[styles.networkLabel, active && { color: Colors.textPrimary, fontWeight: '700' }]}>
                  {n.label}
                </Text>
                {active && (
                  <Feather name="check-circle" size={14} color={n.color} style={{ marginLeft: 4 }} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Type toggle */}
        <Text style={styles.sectionLabel}>Type</Text>
        <View style={styles.typeToggle}>
          {(['airtime', 'data'] as TopupType[]).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.typePill, topupType === t && styles.typePillActive]}
              onPress={() => handleTypeSwitch(t)}
              accessibilityRole="radio"
              accessibilityLabel={t === 'airtime' ? 'Airtime' : 'Data'}
              accessibilityState={{ checked: topupType === t }}
            >
              <Text style={[styles.typePillText, topupType === t && styles.typePillTextActive]}>
                {t === 'airtime' ? 'Airtime' : 'Data'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Phone number */}
        <Text style={styles.sectionLabel}>Phone Number</Text>
        <View style={styles.inputContainer}>
          <Feather name="phone" size={18} color={Colors.textSecondary} style={{ marginRight: Spacing.sm }} />
          <TextInput
            style={styles.input}
            placeholder="0XX XXX XXXX"
            placeholderTextColor={Colors.textSecondary}
            keyboardType="phone-pad"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            maxLength={13}
            accessibilityLabel="Phone number"
          />
        </View>

        {/* Amounts / bundles */}
        <Text style={styles.sectionLabel}>
          {topupType === 'airtime' ? 'Select Amount (GH₵)' : 'Select Data Bundle'}
        </Text>
        <View style={styles.amountGrid}>
          {topupType === 'airtime'
            ? AIRTIME_AMOUNTS.map((amt) => {
                const active = selectedAmount === amt;
                return (
                  <TouchableOpacity
                    key={amt}
                    style={[styles.amountCard, active && styles.amountCardActive]}
                    onPress={() => setSelectedAmount(amt)}
                    accessibilityRole="radio"
                    accessibilityLabel={`GH₵${amt}`}
                    accessibilityState={{ checked: active }}
                  >
                    <Text style={[styles.amountText, active && styles.amountTextActive]}>
                      GH₵{amt}
                    </Text>
                  </TouchableOpacity>
                );
              })
            : DATA_BUNDLES.map((b) => {
                const active = selectedBundle?.label === b.label;
                return (
                  <TouchableOpacity
                    key={b.label}
                    style={[styles.amountCard, active && styles.amountCardActive]}
                    onPress={() => setSelectedBundle(b)}
                    accessibilityRole="radio"
                    accessibilityLabel={`${b.label} for GH₵${b.price}`}
                    accessibilityState={{ checked: active }}
                  >
                    <Text style={[styles.amountText, active && styles.amountTextActive]}>
                      {b.label}
                    </Text>
                    <Text style={[styles.bundlePrice, active && { color: Colors.secondary }]}>
                      GH₵{b.price}
                    </Text>
                  </TouchableOpacity>
                );
              })}
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={[styles.ctaButton, !isValid && styles.ctaButtonDisabled]}
          disabled={!isValid}
          accessibilityRole="button"
          accessibilityLabel={buttonLabel()}
          accessibilityState={{ disabled: !isValid }}
        >
          <Text style={styles.ctaText}>{buttonLabel()}</Text>
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
    networkRow: { flexDirection: 'row', gap: Spacing.sm },
    networkCard: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      paddingHorizontal: Spacing.sm,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.surface,
      gap: 4,
    },
    networkDot: { width: 10, height: 10, borderRadius: 5 },
    networkLabel: { ...Typography.caption, color: Colors.textSecondary, fontWeight: '600' },
    typeToggle: {
      flexDirection: 'row',
      backgroundColor: Colors.surface,
      borderRadius: Radius.full,
      padding: 3,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    typePill: {
      flex: 1,
      paddingVertical: 9,
      borderRadius: Radius.full,
      alignItems: 'center',
    },
    typePillActive: { backgroundColor: Colors.primary },
    typePillText: { ...Typography.body, color: Colors.textSecondary, fontWeight: '600' },
    typePillTextActive: { color: Colors.secondary },
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
    amountGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    amountCard: {
      width: '47%',
      paddingVertical: Spacing.md,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.surface,
      alignItems: 'center',
    },
    amountCardActive: {
      backgroundColor: Colors.primary,
      borderColor: Colors.primary,
    },
    amountText: { ...Typography.bodyLg, fontWeight: '700', color: Colors.textPrimary },
    amountTextActive: { color: Colors.secondary },
    bundlePrice: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
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
