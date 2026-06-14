import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import { agentCashOut } from '../../../../../services/api';
import { errorMessage, extractData, fmtAmount, newIdempotencyKey } from '../helpers';
import { NavProps } from '../types';

export default function RedeemCodePage({ goBack, refresh, Colors, styles }: NavProps) {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const redeem = async () => {
    if (!code.trim()) return Alert.alert('Missing code', 'Enter the customer’s withdrawal code.');

    setSubmitting(true);
    try {
      const res = await agentCashOut({
        code: code.trim().toUpperCase(),
        idempotencyKey: newIdempotencyKey(),
      });
      const data = extractData(res);
      refresh();
      Alert.alert(
        'Pay the customer cash',
        `Hand over ${fmtAmount(data?.amount)} in cash.\nFee charged: ${fmtAmount(
          data?.fee,
        )}.\nYour float is now ${fmtAmount(data?.agentFloatBalance)}.`,
        [{ text: 'Done', onPress: goBack }],
      );
    } catch (e) {
      Alert.alert('Redeem failed', errorMessage(e));
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
        <Text style={styles.headerTitle}>Cash out</Text>
      </View>

      <Text style={styles.subtitle}>
        Ask the customer for their one-time withdrawal code, enter it below, then hand over the cash.
      </Text>

      <Text style={styles.inputLabel}>Withdrawal code</Text>
      <TextInput
        style={[styles.input, { letterSpacing: 2, fontWeight: '700' }]}
        placeholder="ABCDEFGHJK"
        placeholderTextColor={Colors.textSecondary}
        autoCapitalize="characters"
        autoCorrect={false}
        value={code}
        onChangeText={setCode}
      />

      <TouchableOpacity
        style={[styles.button, submitting && styles.buttonDisabled]}
        onPress={redeem}
        disabled={submitting}>
        <Text style={styles.buttonText}>{submitting ? 'Verifying…' : 'Redeem & pay cash'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
