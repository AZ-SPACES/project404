import React, { useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, Alert, Clipboard, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Spacing } from '../../../../../theme';
import { NavProps } from '../types';
import { extractData } from '../helpers';
import { createMerchantSession } from '../../../../../services/api';
import InternalHeader from '../components/InternalHeader';
import FieldInput from '../components/FieldInput';
import PrimaryButton from '../components/PrimaryButton';

export default function CreateSessionPage({ goBack, Colors, styles }: NavProps) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [successUrl, setSuccessUrl] = useState('');
  const [cancelUrl, setCancelUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ id: string; link: string } | null>(null);

  const canSubmit = parseFloat(amount) > 0;

  const submit = async () => {
    setLoading(true);
    try {
      const res = await createMerchantSession({
        amount: parseFloat(amount),
        ...(description.trim() && { description: description.trim() }),
        ...(successUrl.trim() && { successUrl: successUrl.trim() }),
        ...(cancelUrl.trim() && { cancelUrl: cancelUrl.trim() }),
      });
      const session = extractData(res);
      if (session?.id) {
        setResult({ id: session.id, link: `https://pay.aza.app/c/${session.id}` });
      }
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message ?? 'Failed to create payment link.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <ScrollView contentContainerStyle={[styles.pageContent, { alignItems: 'center' }]}>
        <InternalHeader title="Payment Link" onBack={goBack} Colors={Colors} styles={styles} />
        <View style={[styles.bigIcon, { backgroundColor: Colors.success + '18' }]}>
          <Feather name="check-circle" size={48} color={Colors.success} />
        </View>
        <Text style={[styles.introTitle, { color: Colors.textPrimary }]}>Link Created!</Text>
        <Text style={[styles.introSubtitle, { color: Colors.textSecondary }]}>
          Share this link with your customer to collect payment.
        </Text>
        <View style={[styles.linkBox, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
          <Text style={[styles.linkText, { color: Colors.primary }]} selectable numberOfLines={2}>
            {result.link}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.primaryBtn, { width: '100%', marginTop: Spacing.md }]}
          onPress={() => {
            Clipboard.setString(result.link);
            Alert.alert('Copied', 'Payment link copied to clipboard.');
          }}
        >
          <Feather name="copy" size={18} color={Colors.secondary} />
          <Text style={[styles.primaryBtnText, { color: Colors.secondary, marginLeft: Spacing.sm }]}>Copy Link</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ marginTop: Spacing.md }} onPress={() => setResult(null)}>
          <Text style={{ color: Colors.primary, fontWeight: '600' }}>Create Another</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled">
        <InternalHeader title="Create Payment Link" onBack={goBack} Colors={Colors} styles={styles} />

        <FieldInput label="Amount (GHS) *" value={amount} onChangeText={setAmount} placeholder="0.00" keyboardType="decimal-pad" Colors={Colors} styles={styles} />
        <FieldInput label="Description" value={description} onChangeText={setDescription} placeholder="What is this payment for?" Colors={Colors} styles={styles} />
        <FieldInput label="Success URL" value={successUrl} onChangeText={setSuccessUrl} placeholder="https://yoursite.com/thanks" keyboardType="url" Colors={Colors} styles={styles} />
        <FieldInput label="Cancel URL" value={cancelUrl} onChangeText={setCancelUrl} placeholder="https://yoursite.com/cancel" keyboardType="url" Colors={Colors} styles={styles} />

        <PrimaryButton label="Generate Link" onPress={submit} disabled={!canSubmit} loading={loading} Colors={Colors} styles={styles} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
