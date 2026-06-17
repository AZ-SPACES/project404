import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import { agentCashOut } from '../../../../../services/api';
import { errorMessage, extractData, fmtAmount, newIdempotencyKey } from '../helpers';
import { NavProps } from '../types';
import InlineScanner from '../components/InlineScanner';

export default function RedeemCodePage({ goBack, refresh, Colors, styles }: NavProps) {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [scanning, setScanning] = useState(false);

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
    <View style={{ flex: 1 }}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <TextInput
          style={[styles.input, { flex: 1, letterSpacing: 2, fontWeight: '700' }]}
          placeholder="ABCDEFGHJK"
          placeholderTextColor={Colors.textSecondary}
          autoCapitalize="characters"
          autoCorrect={false}
          value={code}
          onChangeText={setCode}
        />
        <TouchableOpacity
          onPress={() => setScanning(true)}
          style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' }}
          accessibilityLabel="Scan withdrawal code">
          <MaterialIcons name="qr-code-scanner" size={26} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.button, submitting && styles.buttonDisabled]}
        onPress={redeem}
        disabled={submitting}>
        <Text style={styles.buttonText}>{submitting ? 'Verifying…' : 'Redeem & pay cash'}</Text>
      </TouchableOpacity>
    </ScrollView>

      {scanning && (
        <InlineScanner
          title="Scan code"
          prompt="Point at the customer’s withdrawal QR code"
          Colors={Colors}
          onClose={() => setScanning(false)}
          onScan={(value) => {
            // The withdrawal-code QR encodes the raw code; tolerate a wrapping URL too.
            const m = value.match(/[A-Za-z0-9]{6,}/);
            setCode((m?.[0] ?? value).trim().toUpperCase());
            setScanning(false);
          }}
        />
      )}
    </View>
  );
}
