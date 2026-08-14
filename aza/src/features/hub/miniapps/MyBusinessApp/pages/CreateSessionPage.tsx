import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, Alert, Clipboard, KeyboardAvoidingView, Platform, Modal, Share } from 'react-native';
import { Feather } from '@react-native-vector-icons/feather';
import { Spacing } from '../../../../../theme';
import { NavProps } from '../types';
import { extractData, fmtAmount } from '../helpers';
import { createMerchantSession, getMerchantSession } from '../../../../../services/api';
import InternalHeader from '../components/InternalHeader';
import FieldInput from '../components/FieldInput';
import PrimaryButton from '../components/PrimaryButton';
import Button from '../../../../../components/ui/Button';
import QrCode from '../../../../../components/ui/QrCode';
import { extractErrorMessage } from '../../../../../utils/errorUtils';
import { sharePoster } from '../../../../../utils/sharePoster';

const TILL_MAX = 40;
/** How often the till re-checks whether the customer has paid, while POS mode is open. */
const POLL_MS = 3000;

export default function CreateSessionPage({ goBack, Colors, styles }: NavProps) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [terminalId, setTerminalId] = useState('');
  const [successUrl, setSuccessUrl] = useState('');
  const [cancelUrl, setCancelUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);

  const [copied, setCopied] = useState(false);
  const [posMode, setPosMode] = useState(false);
  const [paid, setPaid] = useState(false);
  const posterRef = useRef<View>(null);

  const canSubmit = parseFloat(amount) > 0;

  // A cashier holding the phone out to a customer needs to see the sale land — the
  // scan happens on the customer's device, so nothing else here would ever say so.
  // Only runs while POS mode is on screen, and stops as soon as the sale completes.
  useEffect(() => {
    if (!posMode || paid || !result?.id) return;
    let cancelled = false;

    const timer = setInterval(async () => {
      try {
        const session = extractData(await getMerchantSession(result.id));
        if (!cancelled && session?.status === 'COMPLETED') {
          setPaid(true);
        }
      } catch {
        // Offline or a flaky connection at the till — keep polling rather than
        // telling the merchant the sale failed when we simply cannot see it yet.
      }
    }, POLL_MS);

    return () => { cancelled = true; clearInterval(timer); };
  }, [posMode, paid, result?.id]);

  const submit = async () => {
    setLoading(true);
    try {
      const res = await createMerchantSession({
        amount: parseFloat(amount),
        ...(description.trim() && { description: description.trim() }),
        ...(terminalId.trim() && { terminalId: terminalId.trim() }),
        ...(successUrl.trim() && { successUrl: successUrl.trim() }),
        ...(cancelUrl.trim() && { cancelUrl: cancelUrl.trim() }),
      });
      const session = extractData(res);
      if (session) {
        setPaid(false);
        setResult(session);
      }
    } catch (e: unknown) {
      const msg = extractErrorMessage(e, 'Failed to create payment link.');
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

  // Captures the poster rendered above instead of pulling artwork off a third-party
  // image service, so this keeps working when that service does not.
  const handlePrint = () => {
    const link = result?.checkoutUrl || `https://pay.aza.systems/c/${result?.id}`;
    const amountStr = result?.amount ? `GH₵ ${Number(result.amount).toFixed(2)}` : '';
    sharePoster(posterRef, `Pay ${result?.merchantName || 'Merchant'} ${amountStr} on Aza Pay: ${link}`);
  };

  if (result) {
    const checkoutUrl = result.checkoutUrl || `https://pay.aza.systems/c/${result.id}`;

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
          <View ref={posterRef} collapsable={false} style={{
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
              <QrCode
                value={checkoutUrl}
                size={180}
                logo={require('../../../../../assets/aza-z.png')}
                logoSize={36}
              />
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
            <Button
              title="Show POS Mode"
              onPress={() => setPosMode(true)}
              leftIcon={<Feather name="maximize-2" size={16} color={Colors.secondary} />}
              backgroundColor={Colors.primary}
              textColor={Colors.secondary}
              borderRadius={8}
              paddingVertical={15}
            />

            <View style={{ flexDirection: 'row', gap: Spacing.xs }}>
              <Button
                title={copied ? 'Copied!' : 'Copy Link'}
                onPress={handleCopy}
                leftIcon={<Feather name={copied ? "check" : "copy"} size={16} color={Colors.textPrimary} />}
                backgroundColor="transparent"
                textColor={Colors.textPrimary}
                borderRadius={8}
                paddingVertical={15}
                fontWeight="600"
                width="auto"
                style={{ flex: 1, borderWidth: 1, borderColor: Colors.border }}
              />
              <Button
                title="Share"
                onPress={handleShare}
                leftIcon={<Feather name="share-2" size={16} color={Colors.textPrimary} />}
                backgroundColor="transparent"
                textColor={Colors.textPrimary}
                borderRadius={8}
                paddingVertical={15}
                fontWeight="600"
                width="auto"
                style={{ flex: 1, borderWidth: 1, borderColor: Colors.border }}
              />
            </View>

            <Button
              title="Save / Print Poster"
              onPress={handlePrint}
              leftIcon={<Feather name="printer" size={16} color={Colors.textPrimary} />}
              backgroundColor="transparent"
              textColor={Colors.textPrimary}
              borderRadius={8}
              paddingVertical={15}
              fontWeight="600"
              style={{ borderWidth: 1, borderColor: Colors.border }}
            />
          </View>

          <TouchableOpacity style={{ padding: Spacing.sm }} onPress={() => setResult(null)}>
            <Text style={{ color: Colors.primary, fontWeight: '600' }}>Create Another</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* POS Mode Fullscreen Modal */}
        <Modal visible={posMode} animationType="slide" onRequestClose={() => setPosMode(false)}>
          <View style={{ flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center', padding: Spacing.xl }}>
            <Text style={{ fontSize: 13, color: '#9CA3AF', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
              {paid ? 'Payment Received' : 'POS Scanning Mode'}
            </Text>
            <Text style={{ fontSize: 20, color: '#FFFFFF', fontWeight: '800', marginBottom: 24, textAlign: 'center' }}>
              {result.merchantName || 'Aza Merchant'}
            </Text>

            {/* Poster Card — swaps to a confirmation the moment the sale lands, so the
                cashier can hand over the goods without checking anywhere else. */}
            <View style={{
              backgroundColor: '#FFFFFF',
              padding: 24,
              borderRadius: 16,
              alignItems: 'center',
              width: '100%',
              maxWidth: 320,
              marginBottom: Spacing.xl,
            }}>
              {paid ? (
                <View style={{
                  width: 220,
                  height: 220,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <View style={{
                    width: 96,
                    height: 96,
                    borderRadius: 48,
                    backgroundColor: '#DCFCE7',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Feather name="check" size={52} color="#16A34A" />
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#16A34A', marginTop: 16 }}>
                    Paid in full
                  </Text>
                </View>
              ) : (
                <QrCode value={checkoutUrl} size={220} />
              )}
              <Text style={{ fontSize: 26, fontWeight: '800', color: '#111827', marginTop: 16 }}>
                {fmtAmount(result.amount, result.currency)}
              </Text>
              {result.description ? (
                <Text style={{ fontSize: 13, color: '#4B5563', marginTop: 4, textAlign: 'center' }}>
                  {result.description}
                </Text>
              ) : null}
              {!paid && (
                <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 8, textAlign: 'center' }}>
                  Waiting for the customer to scan…
                </Text>
              )}
            </View>

            <Button
              title={paid ? 'Next customer' : 'Close POS'}
              onPress={() => {
                setPosMode(false);
                // A completed sale cannot be paid again, so send the cashier back to
                // a fresh amount rather than leaving a spent code on screen.
                if (paid) { setResult(null); setPaid(false); setAmount(''); setDescription(''); }
              }}
              backgroundColor="#FFFFFF"
              textColor="#000000"
              borderRadius={8}
              paddingVertical={14}
              paddingHorizontal={36}
              fontSize={15}
              width="auto"
            />
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
        <FieldInput
          label="Till / branch"
          hint="Optional. Tags the sale so a shop with several counters can tell them apart."
          value={terminalId}
          onChangeText={(t: string) => setTerminalId(t.slice(0, TILL_MAX))}
          placeholder="Counter 1"
          Colors={Colors}
          styles={styles}
        />
        <FieldInput label="Success URL" value={successUrl} onChangeText={setSuccessUrl} placeholder="https://yoursite.com/thanks" keyboardType="url" Colors={Colors} styles={styles} />
        <FieldInput label="Cancel URL" value={cancelUrl} onChangeText={setCancelUrl} placeholder="https://yoursite.com/cancel" keyboardType="url" Colors={Colors} styles={styles} />

        <PrimaryButton label="Generate Link" onPress={submit} disabled={!canSubmit} loading={loading} Colors={Colors} styles={styles} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
