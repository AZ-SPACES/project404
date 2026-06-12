import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Animated,
  Image,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useAppTheme, ThemeColors, Typography, Spacing } from '../../../theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { BackButton } from '../../../components/ui/BackButton';
import Button from '../../../components/ui/Button';
import { usePreventScreenCapture } from '../../../hooks/usePreventScreenCapture';
import { getCheckoutSession, confirmCheckoutPayment } from '../../../services/api';
import { extractErrorMessage } from '../../../utils/errorUtils';

type Props = NativeStackScreenProps<RootStackParamList, 'MerchantCheckout'>;

interface CheckoutSession {
  id: string;
  merchantName: string | null;
  merchantHandle: string | null;
  merchantLogoUrl: string | null;
  merchantBrandColor: string | null;
  merchantCheckoutTagline: string | null;
  amount: number;
  currency: string;
  description: string | null;
  taxAmount: number | null;
  taxLabel: string | null;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED' | 'REFUNDED';
  expiresAt: string | null;
}

const PIN_LENGTH = 4;
const PIN_ARRAY = Array.from({ length: PIN_LENGTH });

function fmtAmount(amount: number, currency = 'GHS') {
  const sym = currency === 'GHS' ? 'GH¢' : currency;
  return `${sym} ${amount.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtExpiry(iso: string | null): string | null {
  if (!iso) return null;
  const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (mins <= 0) return 'Expired';
  if (mins < 60) return `Expires in ${mins} min`;
  return null;
}

export default function MerchantCheckoutScreen({ navigation, route }: Props) {
  const { sessionId } = route.params;
  const { colors: Colors } = useAppTheme();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  usePreventScreenCapture();

  const [session, setSession] = useState<CheckoutSession | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<'review' | 'pin' | 'success'>('review');
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const inputRef = useRef<TextInput>(null);
  const scaleAnims = useRef(PIN_ARRAY.map(() => new Animated.Value(1))).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      try {
        const res = await getCheckoutSession(sessionId);
        setSession(res.data.data ?? res.data);
      } catch (e: unknown) {
        setLoadError(extractErrorMessage(e, 'Payment link not found.'));
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId]);

  useEffect(() => {
    if (step !== 'pin') return;
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, [step]);

  const startShake = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const handleCompletePin = useCallback(async (enteredPin: string) => {
    setIsVerifying(true);
    setErrorMsg(null);
    try {
      await confirmCheckoutPayment(sessionId, enteredPin);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep('success');
    } catch (err: unknown) {
      startShake();
      setPin('');
      const msg = extractErrorMessage(err, 'Payment failed. Please try again.');
      const isWrongPin =
        msg.toLowerCase().includes('passcode') ||
        msg.toLowerCase().includes('pin') ||
        msg.toLowerCase().includes('incorrect') ||
        msg.toLowerCase().includes('invalid');
      setErrorMsg(isWrongPin ? 'Incorrect PIN. Try again.' : msg);
    } finally {
      setIsVerifying(false);
    }
  }, [sessionId, startShake]);

  useEffect(() => {
    if (pin.length !== PIN_LENGTH) return;
    const t = setTimeout(() => handleCompletePin(pin), 300);
    return () => clearTimeout(t);
  }, [pin, handleCompletePin]);

  const handlePinChange = useCallback((text: string) => {
    if (isVerifying) return;
    if (errorMsg) setErrorMsg(null);
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, PIN_LENGTH);
    if (cleaned.length > pin.length) {
      const index = cleaned.length - 1;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Animated.sequence([
        Animated.timing(scaleAnims[index]!, { toValue: 1.15, duration: 100, useNativeDriver: true }),
        Animated.timing(scaleAnims[index]!, { toValue: 1, duration: 100, useNativeDriver: true }),
      ]).start();
    }
    setPin(cleaned);
  }, [pin.length, scaleAnims, errorMsg, isVerifying]);

  // ── loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}><BackButton onPress={() => navigation.goBack()} /></View>
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (loadError || !session) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}><BackButton onPress={() => navigation.goBack()} /></View>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.textSecondary} />
          <Text style={styles.terminalTitle}>Link not found</Text>
          <Text style={styles.terminalSub}>{loadError ?? 'This payment link is invalid or has been removed.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── terminal states ────────────────────────────────────────────────────────

  if (session.status === 'EXPIRED') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}><BackButton onPress={() => navigation.goBack()} /></View>
        <View style={styles.centered}>
          <Ionicons name="time-outline" size={48} color={Colors.textSecondary} />
          <Text style={styles.terminalTitle}>Link expired</Text>
          <Text style={styles.terminalSub}>This payment link has expired. Ask the merchant for a new one.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (session.status === 'CANCELLED') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}><BackButton onPress={() => navigation.goBack()} /></View>
        <View style={styles.centered}>
          <Ionicons name="close-circle-outline" size={48} color={Colors.error} />
          <Text style={styles.terminalTitle}>Payment cancelled</Text>
          <Text style={styles.terminalSub}>This payment session was cancelled by the merchant.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (session.status === 'COMPLETED' && step !== 'success') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}><BackButton onPress={() => navigation.goBack()} /></View>
        <View style={styles.centered}>
          <Ionicons name="checkmark-circle-outline" size={48} color={Colors.primary} />
          <Text style={styles.terminalTitle}>Already paid</Text>
          <Text style={styles.terminalSub}>This payment link has already been completed.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const total = session.amount + (session.taxAmount ?? 0);
  const displayTotal = fmtAmount(total, session.currency);
  const merchantName = session.merchantName ?? (session.merchantHandle ? `@${session.merchantHandle}` : 'Merchant');

  // ── success ────────────────────────────────────────────────────────────────

  if (step === 'success') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <View style={styles.successIconWrap}>
            <Ionicons name="checkmark" size={40} color={Colors.background} />
          </View>
          <Text style={styles.successAmount}>{displayTotal}</Text>
          <Text style={styles.successLabel}>sent to {merchantName}</Text>
          <Button
            title="Done"
            onPress={() => navigation.popToTop()}
            backgroundColor={Colors.primary}
            textColor="#000"
            borderRadius={14}
            paddingVertical={14}
            paddingHorizontal={Spacing.xl * 2}
            width="auto"
            style={{ marginTop: Spacing.xl }}
          />
        </View>
      </SafeAreaView>
    );
  }

  // ── review step ────────────────────────────────────────────────────────────

  if (step === 'review') {
    const expiry = fmtExpiry(session.expiresAt);
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}><BackButton onPress={() => navigation.goBack()} /></View>
        <ScrollView contentContainerStyle={styles.reviewContent} keyboardShouldPersistTaps="handled">
          {/* Merchant card */}
          <View style={styles.merchantCard}>
            {session.merchantLogoUrl ? (
              <Image source={{ uri: session.merchantLogoUrl }} style={styles.merchantLogo} />
            ) : (
              <View style={[styles.merchantLogoFallback, { backgroundColor: session.merchantBrandColor ?? Colors.primary }]}>
                <Text style={styles.merchantLogoInitial}>
                  {(session.merchantName ?? 'M')[0]!.toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={styles.merchantName}>{merchantName}</Text>
            {session.merchantHandle && (
              <Text style={styles.merchantHandle}>@{session.merchantHandle}</Text>
            )}
            {session.merchantCheckoutTagline ? (
              <Text style={styles.tagline}>{session.merchantCheckoutTagline}</Text>
            ) : null}
          </View>

          {/* Amount breakdown */}
          <View style={styles.amountCard}>
            {session.description ? (
              <Text style={styles.description}>{session.description}</Text>
            ) : null}
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>Subtotal</Text>
              <Text style={styles.amountValue}>{fmtAmount(session.amount, session.currency)}</Text>
            </View>
            {(session.taxAmount ?? 0) > 0 && (
              <View style={styles.amountRow}>
                <Text style={styles.amountLabel}>{session.taxLabel ?? 'Tax'}</Text>
                <Text style={styles.amountValue}>{fmtAmount(session.taxAmount!, session.currency)}</Text>
              </View>
            )}
            <View style={[styles.amountRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={[styles.totalValue, { color: session.merchantBrandColor ?? Colors.primary }]}>
                {displayTotal}
              </Text>
            </View>
            {expiry && (
              <View style={styles.expiryRow}>
                <Ionicons name="time-outline" size={13} color={Colors.textSecondary} />
                <Text style={styles.expiryText}>{expiry}</Text>
              </View>
            )}
          </View>

          <Button
            title={`Pay ${displayTotal}`}
            onPress={() => setStep('pin')}
            backgroundColor={session.merchantBrandColor ?? Colors.primary}
            textColor="#000"
            borderRadius={14}
            activeOpacity={0.85}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── pin step ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.header}>
            <BackButton onPress={() => { setPin(''); setErrorMsg(null); setStep('review'); }} />
          </View>
          <View style={styles.pinContent}>
            <Image source={require('../../../assets/aza-z.png')} style={styles.logo} resizeMode="contain" />
            <Text style={styles.pinTitle}>Enter your PIN</Text>
            <Text style={styles.pinSubtitle}>
              To pay <Text style={styles.pinAmount}>{displayTotal}</Text> to {merchantName}
            </Text>

            <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
              <TextInput
                underlineColorAndroid="transparent"
                ref={inputRef}
                value={pin}
                onChangeText={handlePinChange}
                keyboardType="number-pad"
                maxLength={PIN_LENGTH}
                style={styles.hiddenInput}
                autoFocus
                secureTextEntry
                autoCorrect={false}
                autoComplete="off"
                textContentType="none"
                importantForAutofill="no"
                contextMenuHidden
              />
              <TouchableOpacity
                activeOpacity={1}
                style={styles.squaresContainer}
                onPress={() => inputRef.current?.focus()}
              >
                {PIN_ARRAY.map((_, index) => {
                  const isFilled = pin.length > index;
                  const isCurrent = pin.length === index;
                  return (
                    <Animated.View
                      key={index}
                      style={[
                        styles.square,
                        isFilled && styles.squareFilled,
                        isCurrent && styles.squareCurrent,
                        { transform: [{ scale: scaleAnims[index]! }] },
                      ]}
                    >
                      {isFilled ? <View style={styles.dot} /> : isCurrent ? <View style={styles.cursor} /> : null}
                    </Animated.View>
                  );
                })}
              </TouchableOpacity>
            </Animated.View>

            {isVerifying ? (
              <Text style={styles.verifyingText}>Verifying…</Text>
            ) : errorMsg ? (
              <Text style={styles.errorText}>{errorMsg}</Text>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    flex: { flex: 1 },
    header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.lg },

    terminalTitle: { ...Typography.h3, color: Colors.textPrimary, marginTop: Spacing.md, textAlign: 'center' },
    terminalSub: { ...Typography.body, color: Colors.textSecondary, marginTop: Spacing.xs, textAlign: 'center' },

    // review
    reviewContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.xl * 2 },
    merchantCard: { alignItems: 'center', marginBottom: Spacing.lg },
    merchantLogo: { width: 72, height: 72, borderRadius: 16, marginBottom: Spacing.sm },
    merchantLogoFallback: {
      width: 72, height: 72, borderRadius: 16, marginBottom: Spacing.sm,
      alignItems: 'center', justifyContent: 'center',
    },
    merchantLogoInitial: { fontSize: 28, fontWeight: '700', color: '#000' },
    merchantName: { ...Typography.h3, fontWeight: '700', color: Colors.textPrimary },
    merchantHandle: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
    tagline: { ...Typography.caption, color: Colors.textSecondary, marginTop: Spacing.xs, textAlign: 'center' },

    amountCard: {
      backgroundColor: Colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: Colors.border,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
    },
    description: { ...Typography.body, color: Colors.textSecondary, marginBottom: Spacing.md },
    amountRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.xs },
    amountLabel: { ...Typography.body, color: Colors.textSecondary },
    amountValue: { ...Typography.body, color: Colors.textPrimary },
    totalRow: { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: Spacing.xs, paddingTop: Spacing.sm, marginBottom: 0 },
    totalLabel: { ...Typography.body, fontWeight: '700', color: Colors.textPrimary },
    totalValue: { fontSize: 20, fontWeight: '700' },
    expiryRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: Spacing.sm },
    expiryText: { ...Typography.caption, color: Colors.textSecondary },


    // success
    successIconWrap: {
      width: 80, height: 80, borderRadius: 40,
      backgroundColor: Colors.primary,
      alignItems: 'center', justifyContent: 'center',
      marginBottom: Spacing.md,
    },
    successAmount: { ...Typography.h2, fontWeight: '700', color: Colors.textPrimary },
    successLabel: { ...Typography.body, color: Colors.textSecondary, marginTop: Spacing.xs },

    // pin
    pinContent: {
      flex: 1, alignItems: 'center', paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.xl, paddingBottom: Spacing.xl * 2,
    },
    logo: { width: 64, height: 64, marginBottom: Spacing.md },
    pinTitle: { ...Typography.h2, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.xs },
    pinSubtitle: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', marginBottom: 40 },
    pinAmount: { fontWeight: '700', color: Colors.textPrimary },
    hiddenInput: { position: 'absolute', width: 0, height: 0, opacity: 0 },
    squaresContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 16 },
    square: {
      width: 56, height: 56, borderRadius: 12,
      backgroundColor: Colors.surface,
      borderWidth: 1, borderColor: Colors.border,
      alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    },
    squareFilled: { borderColor: Colors.primary },
    squareCurrent: { borderColor: Colors.primary },
    cursor: { width: 2, height: 24, backgroundColor: Colors.primary },
    dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.textPrimary },
    verifyingText: { marginTop: 20, fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
    errorText: { marginTop: 20, fontSize: 14, color: Colors.error, textAlign: 'center' },
  });
}
