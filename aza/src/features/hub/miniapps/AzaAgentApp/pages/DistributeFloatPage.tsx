import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import { distributeFloat } from '../../../../../services/api';
import { errorMessage, extractData, fmtAmount, newIdempotencyKey } from '../helpers';
import { NavProps } from '../types';

/** A scanned agent code may arrive wrapped in a URL; pull out the AZA-xxxxx code. */
function parseAgentCode(raw: string): string {
  const m = raw.match(/(AZA-[A-Z0-9]{6})/i);
  if (m?.[1]) return m[1].toUpperCase();
  return raw.trim().toUpperCase();
}

export default function DistributeFloatPage({ goBack, refresh, Colors, styles }: NavProps) {
  const [code, setCode] = useState('');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const distribute = async () => {
    const value = Number(amount);
    if (!code.trim()) return Alert.alert('Missing agent', 'Enter the agent’s till code (e.g. AZA-7K4PQM).');
    if (!value || value <= 0) return Alert.alert('Invalid amount', 'Enter an amount greater than zero.');

    setSubmitting(true);
    try {
      const res = await distributeFloat({
        targetAgentCode: parseAgentCode(code),
        amount: value,
        idempotencyKey: newIdempotencyKey(),
      });
      const data = extractData(res);
      refresh();
      Alert.alert(
        'Float distributed',
        `${fmtAmount(value)} sent to ${data?.targetAgentName ?? data?.targetAgentCode ?? 'the agent'}.\n` +
          `Your float is now ${fmtAmount(data?.superAgentFloatBalance)}.`,
        [{ text: 'Done', onPress: goBack }],
      );
    } catch (e) {
      Alert.alert('Distribution failed', errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={goBack}>
            <MaterialIcons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Distribute float</Text>
        </View>

        <Text style={styles.subtitle}>
          Hand e-float down to an agent against the cash they’ve given you. The amount moves from your float to theirs.
        </Text>

        <Text style={styles.inputLabel}>Agent till code</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. AZA-7K4PQM"
          placeholderTextColor={Colors.textSecondary}
          autoCapitalize="characters"
          value={code}
          onChangeText={setCode}
        />

        <Text style={styles.inputLabel}>Float to send (GH₵)</Text>
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
          onPress={distribute}
          disabled={submitting}>
          <Text style={styles.buttonText}>{submitting ? 'Sending…' : 'Send float'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
