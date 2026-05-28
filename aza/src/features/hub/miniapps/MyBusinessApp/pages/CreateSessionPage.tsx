import React, { useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, Alert, Clipboard, KeyboardAvoidingView, Platform, Modal, Image, Share, Linking, Dimensions } from 'react-native';
import { Feather } from '@react-native-vector-icons/feather';
import { Spacing } from '../../../../../theme';
import { NavProps } from '../types';
import { extractData, fmtAmount } from '../helpers';
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
  const [result, setResult] = useState<any | null>(null);

  const [copied, setCopied] = useState(false);
  const [posMode, setPosMode] = useState(false);

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
      if (session) {
        setResult(session);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message ?? 'Failed to create payment link.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    const link = result?.checkoutUrl || `https://pay.aza.systems/c/${result?.id}`;
    Clipboard.setString(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    const link = result?.checkoutUrl || `https://pay.aza.systems/c/${result?.id}`;
    const amountStr = result?.amount ? `GH₵ ${Number(result.amount).toFixed(2)}` : '';
    const descStr = result?.description ? ` (${result.description})` : '';
    try {
      await Share.share({
        message: `Pay ${result?.merchantName || 'Merchant'} ${amountStr}${descStr} on Aza Pay: ${link}`,
        url: link,
      });
    } catch (e) {
      // Ignore
    }
  };

  const handlePrint = () => {
    const link = result?.checkoutUrl || `https://pay.aza.systems/c/${result?.id}`;
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(link)}`;
    Linking.openURL(qrImageUrl).catch(() => {
      Alert.alert('Error', 'Unable to open printable QR code.');
    });
  };

  if (result) {
    const checkoutUrl = result.checkoutUrl || `https://pay.aza.systems/c/${result.id}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(checkoutUrl)}`;

    return (
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[styles.pageContent, { alignItems: 'center' }]}>
          <InternalHeader title="Payment Link" onBack={goBack} Colors={Colors} styles={styles} />
          
          <View style={[styles.bigIcon, { backgroundColor: Colors.success + '18', marginBottom: Spacing.md }]}>
            <Feather name="check-circle" size={48} color={Colors.success} />
          </View>
          
          <Text style={[styles.introTitle, { color: Colors.textPrimary, marginBottom: 4 }]}>Payment Link Created!</Text>
          <Text style={[styles.introSubtitle, { color: Colors.textSecondary, marginBottom: Spacing.md }]}>
            Scan the QR code or share the payment link to receive payments.
          </Text>

          {/* Printable Poster Card */}
          <View style={{
            backgroundColor: '#FFFFFF',
            borderWidth: 1,
            borderColor: Colors.border,
            borderRadius: 12,
            padding: 24,
            width: '100%',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 2,
            marginBottom: Spacing.md
          }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
              Pay Merchant
            </Text>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 16 }}>
              {result.merchantName || 'Aza Merchant'}
            </Text>

            {/* QR Frame */}
            <View style={{
              position: 'relative',
              padding: 8,
              backgroundColor: '#FFFFFF',
              borderWidth: 1,
              borderColor: '#E5E7EB',
              borderRadius: 8,
              marginBottom: 16
            }}>
              <Image source={{ uri: qrUrl }} style={{ width: 180, height: 180 }} />
              <View style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                marginTop: -18,
                marginLeft: -15,
                backgroundColor: '#FFFFFF',
                padding: 4,
                borderRadius: 6,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 2,
                elevation: 1
              }}>
                <Image source={require('../../../../../assets/aza-z.png')} style={{ width: 20, height: 26 }} />
              </View>
            </View>

            <Text style={{ fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 4 }}>
              {fmtAmount(result.amount, result.currency)}
            </Text>
            
            {result.description ? (
              <Text style={{ fontSize: 13, color: '#4B5563', textAlign: 'center', marginBottom: 12 }}>
                {result.description}
              </Text>
            ) : null}

            <View style={{ borderTopWidth: 1, borderTopColor: '#F3F4F6', width: '100%', paddingTop: 12, alignItems: 'center' }}>
              <Text style={{ fontSize: 11, color: '#9CA3AF', fontWeight: '500' }}>
                Scan with Aza App to Pay
              </Text>
              <Text style={{ fontSize: 9, color: '#D1D5DB', marginTop: 2 }}>
                Powered by Aza Systems
              </Text>
            </View>
          </View>

          {/* Action Row */}
          <View style={{ width: '100%', gap: Spacing.xs, marginBottom: Spacing.md }}>
            <TouchableOpacity
              style={[styles.primaryBtn, { width: '100%', borderRadius: 8 }]}
              onPress={() => setPosMode(true)}
            >
              <Feather name="maximize-2" size={16} color={Colors.secondary} />
              <Text style={[styles.primaryBtnText, { color: Colors.secondary, marginLeft: Spacing.xs }]}>Show POS Mode</Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', gap: Spacing.xs }}>
              <TouchableOpacity
                style={[styles.secondaryBtn, { flex: 1, borderColor: Colors.border, borderRadius: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }]}
                onPress={handleCopy}
              >
                <Feather name={copied ? "check" : "copy"} size={16} color={Colors.textPrimary} />
                <Text style={[styles.secondaryBtnText, { color: Colors.textPrimary }]}>{copied ? 'Copied!' : 'Copy Link'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryBtn, { flex: 1, borderColor: Colors.border, borderRadius: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }]}
                onPress={handleShare}
              >
                <Feather name="share-2" size={16} color={Colors.textPrimary} />
                <Text style={[styles.secondaryBtnText, { color: Colors.textPrimary }]}>Share</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.secondaryBtn, { width: '100%', borderColor: Colors.border, borderRadius: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }]}
              onPress={handlePrint}
            >
              <Feather name="printer" size={16} color={Colors.textPrimary} />
              <Text style={[styles.secondaryBtnText, { color: Colors.textPrimary }]}>Save / Print Poster</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={{ padding: Spacing.sm }} onPress={() => setResult(null)}>
            <Text style={{ color: Colors.primary, fontWeight: '600' }}>Create Another</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* POS Mode Fullscreen Modal */}
        <Modal visible={posMode} animationType="slide" onRequestClose={() => setPosMode(false)}>
          <View style={{ flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center', padding: Spacing.xl }}>
            <Text style={{ fontSize: 13, color: '#9CA3AF', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
              POS Scanning Mode
            </Text>
            <Text style={{ fontSize: 20, color: '#FFFFFF', fontWeight: '800', marginBottom: 24, textAlign: 'center' }}>
              {result.merchantName || 'Aza Merchant'}
            </Text>

            {/* Poster Card */}
            <View style={{
              backgroundColor: '#FFFFFF',
              padding: 24,
              borderRadius: 16,
              alignItems: 'center',
              width: '100%',
              maxWidth: 320,
              marginBottom: Spacing.xl,
            }}>
              <Image source={{ uri: qrUrl }} style={{ width: 220, height: 220 }} />
              <Text style={{ fontSize: 26, fontWeight: '800', color: '#111827', marginTop: 16 }}>
                {fmtAmount(result.amount, result.currency)}
              </Text>
              {result.description ? (
                <Text style={{ fontSize: 13, color: '#4B5563', marginTop: 4, textAlign: 'center' }}>
                  {result.description}
                </Text>
              ) : null}
            </View>

            <TouchableOpacity
              style={{
                paddingVertical: 14,
                paddingHorizontal: 36,
                backgroundColor: '#FFFFFF',
                borderRadius: 8,
              }}
              onPress={() => setPosMode(false)}
            >
              <Text style={{ color: '#000000', fontWeight: '700', fontSize: 15 }}>Close POS</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      </View>
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
