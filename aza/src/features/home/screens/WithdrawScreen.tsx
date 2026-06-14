import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppTheme, Typography, Spacing, Radius } from "../../../theme";
import { useNavigation } from "@react-navigation/native";
import { Feather } from '@react-native-vector-icons/feather';
import { BackButton } from "../../../components/ui/BackButton";
import { requestWithdrawal } from "../../../services/api";

type Provider = 'MTN' | 'Vodafone' | 'AirtelTigo' | 'Bank';

const PROVIDERS: { id: Provider; label: string; icon: string; color: string }[] = [
  { id: 'MTN', label: 'MTN MoMo', icon: 'smartphone', color: '#FFCB05' },
  { id: 'Vodafone', label: 'Vodafone Cash', icon: 'smartphone', color: '#E60000' },
  { id: 'AirtelTigo', label: 'AirtelTigo Money', icon: 'smartphone', color: '#E8001C' },
  { id: 'Bank', label: 'Bank Transfer', icon: 'credit-card', color: '#60A5FA' },
];

type Step = 'provider' | 'details' | 'passcode' | 'success';

export function WithdrawScreen() {
  const { colors: Colors } = useAppTheme();
  const navigation = useNavigation();

  const [step, setStep] = useState<Step>('provider');
  const [provider, setProvider] = useState<Provider | null>(null);
  const [destination, setDestination] = useState('');
  const [bankName, setBankName] = useState('');
  const [amount, setAmount] = useState('');
  const [passcode, setPasscode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState('');

  function handleProviderSelect(p: Provider) {
    setProvider(p);
    setStep('details');
    setError(null);
  }

  function handleDetailsNext() {
    if (!destination.trim()) { setError('Please enter a destination'); return; }
    if (provider === 'Bank' && !bankName.trim()) { setError('Please enter your bank name'); return; }
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt < 1) { setError('Enter an amount of at least GHS 1.00'); return; }
    setError(null);
    setStep('passcode');
  }

  async function handleSubmit() {
    if (passcode.length < 4) { setError('Enter your passcode'); return; }
    setSubmitting(true);
    setError(null);
    try {
      const payload: Parameters<typeof requestWithdrawal>[0] = {
        amount: parseFloat(amount),
        provider: provider!,
        destination: destination.trim(),
        passcode,
      };
      if (provider === 'Bank' && bankName.trim()) payload.bankName = bankName.trim();
      const result: any = await requestWithdrawal(payload);
      const data = result?.data?.data ?? result?.data ?? result;
      setReference(data?.id?.slice(0, 8).toUpperCase() ?? 'N/A');
      setStep('success');
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Withdrawal request failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const providerInfo = PROVIDERS.find(p => p.id === provider);

  const headerTitle =
    step === 'provider' ? 'Withdraw' :
    step === 'details' ? providerInfo?.label ?? 'Withdraw' :
    step === 'passcode' ? 'Confirm withdrawal' :
    'Request submitted';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <BackButton onPress={() => {
            if (step === 'provider' || step === 'success') { navigation.goBack(); return; }
            if (step === 'details') { setStep('provider'); setError(null); }
            if (step === 'passcode') { setStep('details'); setPasscode(''); setError(null); }
          }} />
          <Text style={[Typography.h2, { color: Colors.textPrimary, marginLeft: Spacing.md }]}>
            {headerTitle}
          </Text>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {/* ── Step 1: Provider selection ─────────────────────────────────── */}
          {step === 'provider' && (
            <View>
              <Text style={[styles.subtitle, { color: Colors.textSecondary }]}>
                Choose how you'd like to receive your funds
              </Text>
              {PROVIDERS.map(p => (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => handleProviderSelect(p.id)}
                  activeOpacity={0.7}
                  style={[styles.providerCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
                >
                  <View style={[styles.providerIcon, { backgroundColor: p.color + '22' }]}>
                    <Feather name={p.icon as any} size={20} color={p.color} />
                  </View>
                  <Text style={[styles.providerLabel, { color: Colors.textPrimary }]}>{p.label}</Text>
                  <Feather name="chevron-right" size={16} color={Colors.textSecondary} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ── Step 2: Amount + destination ───────────────────────────────── */}
          {step === 'details' && (
            <View style={{ gap: Spacing.md }}>
              <Text style={[styles.subtitle, { color: Colors.textSecondary }]}>
                {provider === 'Bank'
                  ? 'Enter your bank details and the amount'
                  : `Enter your ${providerInfo?.label} number and amount`}
              </Text>

              {/* Amount */}
              <View>
                <Text style={[styles.label, { color: Colors.textSecondary }]}>Amount (GHS)</Text>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={Colors.textSecondary + '60'}
                  style={[styles.input, { backgroundColor: Colors.surface, borderColor: Colors.border, color: Colors.textPrimary }]}
                />
              </View>

              {/* Destination */}
              <View>
                <Text style={[styles.label, { color: Colors.textSecondary }]}>
                  {provider === 'Bank' ? 'Account Number' : 'Phone Number'}
                </Text>
                <TextInput
                  value={destination}
                  onChangeText={setDestination}
                  keyboardType={provider === 'Bank' ? 'number-pad' : 'phone-pad'}
                  placeholder={provider === 'Bank' ? '1234567890' : '0XX XXX XXXX'}
                  placeholderTextColor={Colors.textSecondary + '60'}
                  style={[styles.input, { backgroundColor: Colors.surface, borderColor: Colors.border, color: Colors.textPrimary }]}
                />
              </View>

              {/* Bank name (bank transfers only) */}
              {provider === 'Bank' && (
                <View>
                  <Text style={[styles.label, { color: Colors.textSecondary }]}>Bank Name</Text>
                  <TextInput
                    value={bankName}
                    onChangeText={setBankName}
                    placeholder="e.g. GCB, Ecobank, Absa"
                    placeholderTextColor={Colors.textSecondary + '60'}
                    style={[styles.input, { backgroundColor: Colors.surface, borderColor: Colors.border, color: Colors.textPrimary }]}
                  />
                </View>
              )}

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                onPress={handleDetailsNext}
                style={[styles.primaryBtn, { backgroundColor: Colors.primary }]}
                activeOpacity={0.8}
              >
                <Text style={[styles.primaryBtnText, { color: Colors.background }]}>Continue</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Step 3: Passcode confirmation ──────────────────────────────── */}
          {step === 'passcode' && (
            <View style={{ gap: Spacing.md }}>
              {/* Summary */}
              <View style={[styles.summaryCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: Colors.textSecondary }]}>Amount</Text>
                  <Text style={[styles.summaryValue, { color: Colors.textPrimary }]}>GHS {parseFloat(amount).toFixed(2)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: Colors.textSecondary }]}>To</Text>
                  <Text style={[styles.summaryValue, { color: Colors.textPrimary }]}>{destination}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: Colors.textSecondary }]}>Via</Text>
                  <Text style={[styles.summaryValue, { color: Colors.textPrimary }]}>{providerInfo?.label}</Text>
                </View>
                {bankName ? (
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: Colors.textSecondary }]}>Bank</Text>
                    <Text style={[styles.summaryValue, { color: Colors.textPrimary }]}>{bankName}</Text>
                  </View>
                ) : null}
              </View>

              <Text style={[styles.subtitle, { color: Colors.textSecondary }]}>
                Enter your passcode to confirm this withdrawal request
              </Text>

              <View>
                <Text style={[styles.label, { color: Colors.textSecondary }]}>Passcode</Text>
                <TextInput
                  value={passcode}
                  onChangeText={setPasscode}
                  secureTextEntry
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder="Enter passcode"
                  placeholderTextColor={Colors.textSecondary + '60'}
                  style={[styles.input, { backgroundColor: Colors.surface, borderColor: Colors.border, color: Colors.textPrimary }]}
                />
              </View>

              <Text style={[styles.notice, { color: Colors.textSecondary }]}>
                Withdrawals are reviewed within 1–2 business days. Funds will be sent once approved.
              </Text>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={submitting}
                style={[styles.primaryBtn, { backgroundColor: Colors.primary, opacity: submitting ? 0.5 : 1 }]}
                activeOpacity={0.8}
              >
                {submitting
                  ? <ActivityIndicator size="small" color={Colors.background} />
                  : <Text style={[styles.primaryBtnText, { color: Colors.background }]}>Submit Withdrawal Request</Text>
                }
              </TouchableOpacity>
            </View>
          )}

          {/* ── Step 4: Success ────────────────────────────────────────────── */}
          {step === 'success' && (
            <View style={{ alignItems: 'center', gap: Spacing.lg, paddingTop: Spacing.xl }}>
              <View style={[styles.successIcon, { backgroundColor: Colors.primary + '22' }]}>
                <Feather name="check-circle" size={48} color={Colors.primary} />
              </View>
              <View style={{ alignItems: 'center', gap: Spacing.xs }}>
                <Text style={[Typography.h2, { color: Colors.textPrimary }]}>Request submitted</Text>
                <Text style={[styles.subtitle, { color: Colors.textSecondary, textAlign: 'center' }]}>
                  Your withdrawal of GHS {parseFloat(amount).toFixed(2)} has been queued for review.
                </Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: Colors.surface, borderColor: Colors.border, width: '100%' }]}>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: Colors.textSecondary }]}>Reference</Text>
                  <Text style={[styles.summaryValue, { color: Colors.textPrimary, fontFamily: 'monospace' }]}>{reference}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: Colors.textSecondary }]}>Status</Text>
                  <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, backgroundColor: '#F59E0B22' }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#F59E0B' }}>Pending Review</Text>
                  </View>
                </View>
              </View>
              <Text style={[styles.notice, { color: Colors.textSecondary, textAlign: 'center' }]}>
                You'll be notified when your withdrawal is processed. This typically takes 1–2 business days.
              </Text>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={[styles.primaryBtn, { backgroundColor: Colors.primary, width: '100%' }]}
                activeOpacity={0.8}
              >
                <Text style={[styles.primaryBtnText, { color: Colors.background }]}>Back to Home</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.md,
  },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: Spacing.sm },
  label: { fontSize: 12, fontWeight: '500', marginBottom: Spacing.xs },
  input: {
    borderWidth: 1, borderRadius: Radius.md ?? 12,
    paddingHorizontal: Spacing.md, paddingVertical: 12, fontSize: 15,
  },
  providerCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    borderWidth: 1, borderRadius: Radius.md ?? 12,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    marginBottom: Spacing.sm,
  },
  providerIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  providerLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  primaryBtn: {
    borderRadius: Radius.md ?? 12, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryBtnText: { fontSize: 15, fontWeight: '700' },
  summaryCard: {
    borderWidth: 1, borderRadius: Radius.md ?? 12, padding: Spacing.md, gap: Spacing.sm,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 13 },
  summaryValue: { fontSize: 13, fontWeight: '600' },
  notice: { fontSize: 12, lineHeight: 18, fontStyle: 'italic' },
  errorText: { fontSize: 13, color: '#F87171' },
  successIcon: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
});
