import React, { useState } from 'react';
import { ScrollView, View, Text, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Spacing } from '../../../../../theme';
import { NavProps } from '../types';
import { extractData, fmtAmount, fmtDate } from '../helpers';
import { getMerchantPayouts, requestMerchantPayout } from '../../../../../services/api';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../../../lib/queryKeys';
import { queryClient } from '../../../../../lib/queryClient';
import InternalHeader from '../components/InternalHeader';
import FieldInput from '../components/FieldInput';
import PrimaryButton from '../components/PrimaryButton';
import StatusBadge from '../components/StatusBadge';
import { extractErrorMessage } from '../../../../../utils/errorUtils';

export default function PayoutsPage({ merchant, goBack, onMerchantUpdate, Colors, styles }: NavProps) {
  const [amount, setAmount] = useState('');
  const [passcode, setPasscode] = useState('');
  const [loading, setLoading] = useState(false);
  const { data: payouts = [], isLoading: payoutsLoading } = useQuery({
    queryKey: queryKeys.merchantPayouts(),
    queryFn: async () => { const r = await getMerchantPayouts(0, 20); return extractData(r)?.content ?? []; },
    staleTime: 60_000,
  });

  const canSubmit = parseFloat(amount) > 0 && passcode.length === 6;

  const submit = async () => {
    const amt = parseFloat(amount);
    if (amt > (merchant?.balance ?? 0)) {
      Alert.alert('Insufficient Balance', 'Payout amount exceeds your merchant balance.');
      return;
    }
    setLoading(true);
    try {
      await requestMerchantPayout(amt, passcode);
      Alert.alert('Success', `GH₵${amt.toFixed(2)} has been transferred to your Aza wallet.`);
      setAmount('');
      setPasscode('');
      queryClient.invalidateQueries({ queryKey: queryKeys.merchantPayouts() });
      queryClient.invalidateQueries({ queryKey: queryKeys.merchant() });
    } catch (e: unknown) {
      Alert.alert('Error', extractErrorMessage(e, 'Payout failed.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled">
        <InternalHeader title="Payouts" onBack={goBack} Colors={Colors} styles={styles} />

        <View style={[styles.balanceCard, { backgroundColor: Colors.primary, marginBottom: Spacing.lg, borderColor: Colors.primary }]}>
          <Text style={[styles.balanceLabel, { color: Colors.secondary + 'AA' }]}>Available to Withdraw</Text>
          <Text style={[styles.balanceAmount, { color: Colors.secondary }]}>
            {fmtAmount(merchant?.balance, merchant?.currency ?? 'GHS')}
          </Text>
        </View>

        <Text style={[styles.sectionLabel, { color: Colors.textPrimary }]}>Withdraw to Aza Wallet</Text>
        <FieldInput label="Amount (GHS) *" value={amount} onChangeText={setAmount} placeholder="0.00" keyboardType="decimal-pad" Colors={Colors} styles={styles} />
        <FieldInput label="Passcode *" value={passcode} onChangeText={setPasscode} placeholder="Enter 6-digit passcode" keyboardType="number-pad" secureTextEntry Colors={Colors} styles={styles} />
        <PrimaryButton label="Request Payout" onPress={submit} disabled={!canSubmit} loading={loading} Colors={Colors} styles={styles} />

        {!payoutsLoading && payouts.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: Spacing.xl }]}>Payout History</Text>
            <View style={styles.rowContainer}>
              {payouts.map((p: any, i: number) => (
                <View
                  key={p.id ?? i}
                  style={[
                    styles.sessionRow,
                    i < payouts.length - 1 && { borderBottomWidth: 1, borderBottomColor: Colors.border },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sessionAmount, { color: Colors.textPrimary }]}>{fmtAmount(p.amount, p.currency)}</Text>
                    <Text style={[styles.sessionDate, { color: Colors.textSecondary }]}>{fmtDate(p.createdAt)}</Text>
                  </View>
                  <StatusBadge status={p.status ?? 'COMPLETED'} Colors={Colors} />
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
