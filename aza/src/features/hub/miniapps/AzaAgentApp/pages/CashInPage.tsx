import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import { agentCashIn } from '../../../../../services/api';
import { errorMessage, extractData, fmtAmount, newIdempotencyKey } from '../helpers';
import { NavProps } from '../types';

export default function CashInPage({ goBack, refresh, Colors, styles }: NavProps) {
  const [customer, setCustomer] = useState('');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const deposit = async () => {
    const value = Number(amount);
    if (!customer.trim()) return Alert.alert('Missing customer', 'Enter the customer phone, email or @username.');
    if (!value || value <= 0) return Alert.alert('Invalid amount', 'Enter an amount greater than zero.');

    setSubmitting(true);
    try {
      const res = await agentCashIn({
        customerIdentifier: customer.trim(),
        amount: value,
        idempotencyKey: newIdempotencyKey(),
      });
      const data = extractData(res);
      refresh();
      Alert.alert(
        'Deposit complete',
        `${fmtAmount(value)} added to the customer.\nYour float is now ${fmtAmount(
          data?.agentFloatBalance,
        )}.`,
        [{ text: 'Done', onPress: goBack }],
      );
    } catch (e) {
      Alert.alert('Cash-in failed', errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={goBack}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cash in</Text>
      </View>

      <Text style={styles.inputLabel}>Customer (phone, email or @username)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 024 000 0000"
        placeholderTextColor={Colors.textSecondary}
        autoCapitalize="none"
        value={customer}
        onChangeText={setCustomer}
      />

      <Text style={styles.inputLabel}>Cash received (GH₵)</Text>
      <TextInput
        style={styles.input}
        placeholder="0.00"
        placeholderTextColor={Colors.textSecondary}
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
      />

      <TouchableOpacity
        style={[styles.button, submitting && styles.buttonDisabled]}
        onPress={deposit}
        disabled={submitting}>
        <Text style={styles.buttonText}>{submitting ? 'Processing…' : 'Confirm deposit'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
