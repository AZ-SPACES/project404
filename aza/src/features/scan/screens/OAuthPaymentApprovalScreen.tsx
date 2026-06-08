import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, Animated, ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useAppTheme, Spacing, Radius, Typography } from '../../../theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { BackButton } from '../../../components/ui/BackButton';
import { usePreventScreenCapture } from '../../../hooks/usePreventScreenCapture';
import { getCheckoutSession, confirmCheckoutPayment } from '../../../services/api';
import { extractErrorMessage } from '../../../utils/errorUtils';

type Props = NativeStackScreenProps<RootStackParamList, 'OAuthPaymentApproval'>;

interface CheckoutSession {
  id: string;
  merchantName: string | null;
  merchantHandle: string | null;
  merchantLogoUrl: string | null;
  merchantBrandColor: string | null;
  amount: number;
  currency: string;
  description: string | null;
  taxAmount: number | null;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED' | 'REFUNDED';
  expiresAt: string | null;
}

const PIN_LENGTH = 4;
const PIN_ARRAY = Array.from({ length: PIN_LENGTH });

function fmtAmount(amount: number, currency = 'GHS') {
  const sym = currency === 'GHS' ? 'GH¢' : currency;
  return `${sym} ${amount.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function OAuthPaymentApprovalScreen({ navigation, route }: Props) {
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

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: Colors.background }]}>
        <View style={styles.header}><BackButton onPress={() => navigation.goBack()} /></View>
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (loadError || !session) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: Colors.background }]}>
        <View style={styles.header}><BackButton onPress={() => navigation.goBack()} /></View>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.textSecondary} />
          <Text style={[styles.errorTitle, { color: Colors.textPrimary }]}>Payment not found</Text>
          <Text style={[styles.errorMsg, { color: Colors.textSecondary }]}>{loadError}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const accent = session.merchantBrandColor ?? Colors.primary;
  const total = session.amount + (session.taxAmount ?? 0);

  if (step === 'success') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: Colors.background }]}>
        <View style={styles.centered}>
          <View style={[styles.successIcon, { backgroundColor: Colors.primary + '20' }]}>
            <Ionicons name="checkmark-circle" size={56} color={Colors.primary} />
          </View>
          <Text style={[styles.successTitle, { color: Colors.textPrimary }]}>Payment sent!</Text>
          <Text style={[styles.successAmount, { color: Colors.primary }]}>{fmtAmount(total, session.currency)}</Text>
          <Text style={[styles.successTo, { color: Colors.textSecondary }]}>
            to {session.merchantName ?? `@${session.merchantHandle}`}
          </Text>
          <TouchableOpacity
            style={[styles.doneBtn, { backgroundColor: Colors.primary }]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Text style={[styles.doneBtnText, { color: Colors.background }]}>Done</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <BackButton onPress={() => navigation.goBack()} />
        </View>

        <View style={styles.scrollContent}>
          {/* Merchant card */}
          <View style={[styles.merchantCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
            {session.merchantLogoUrl ? (
              <Image source={{ uri: session.merchantLogoUrl }} style={styles.merchantLogo} />
            ) : (
              <View style={[styles.merchantLogoPlaceholder, { backgroundColor: accent + '20' }]}>
                <Text style={[styles.merchantLogoLetter, { color: accent }]}>
                  {(session.merchantName ?? 'M').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.merchantInfo}>
              <Text style={[styles.merchantName, { color: Colors.textPrimary }]} numberOfLines={1}>
                {session.merchantName ?? `@${session.merchantHandle}`}
              </Text>
              {session.description ? (
                <Text style={[styles.merchantDesc, { color: Colors.textSecondary }]} numberOfLines={2}>
                  {session.description}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Amount */}
          <View style={styles.amountBlock}>
            <Text style={[styles.amountLabel, { color: Colors.textSecondary }]}>You're paying</Text>
            <Text style={[styles.amountValue, { color: accent }]}>{fmtAmount(total, session.currency)}</Text>
          </View>

          {step === 'review' && (
            <TouchableOpacity
              style={[styles.payBtn, { backgroundColor: accent }]}
              onPress={() => setStep('pin')}
              activeOpacity={0.85}
            >
              <Ionicons name="shield-checkmark-outline" size={18} color={Colors.background} />
              <Text style={[styles.payBtnText, { color: Colors.background }]}>Confirm with PIN</Text>
            </TouchableOpacity>
          )}

          {step === 'pin' && (
            <View style={styles.pinSection}>
              <Text style={[styles.pinLabel, { color: Colors.textSecondary }]}>Enter your wallet PIN</Text>

              {errorMsg ? (
                <View style={[styles.errorBanner, { backgroundColor: '#EF444420', borderColor: '#EF4444' }]}>
                  <Ionicons name="alert-circle-outline" size={15} color="#EF4444" />
                  <Text style={styles.errorBannerText}>{errorMsg}</Text>
                </View>
              ) : null}

              <Animated.View style={[styles.pinDotsRow, { transform: [{ translateX: shakeAnim }] }]}>
                {PIN_ARRAY.map((_, i) => (
                  <Animated.View
                    key={i}
                    style={[
                      styles.pinDot,
                      {
                        backgroundColor: i < pin.length ? accent : Colors.border,
                        borderColor: i < pin.length ? accent : Colors.border,
                        transform: [{ scale: scaleAnims[i]! }],
                      },
                    ]}
                  />
                ))}
              </Animated.View>

              <TextInput
                ref={inputRef}
                value={pin}
                onChangeText={handlePinChange}
                keyboardType="numeric"
                maxLength={PIN_LENGTH}
                secureTextEntry
                style={styles.hiddenInput}
                editable={!isVerifying}
              />

              {isVerifying && (
                <ActivityIndicator color={accent} style={{ marginTop: Spacing.md }} />
              )}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(Colors: any) {
  return StyleSheet.create({
    container:              { flex: 1 },
    header:                 { padding: Spacing.md },
    centered:               { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
    scrollContent:          { flex: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
    merchantCard:           { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1, marginBottom: Spacing.xl },
    merchantLogo:           { width: 52, height: 52, borderRadius: 14 },
    merchantLogoPlaceholder:{ width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    merchantLogoLetter:     { fontSize: 22, fontWeight: '700' },
    merchantInfo:           { flex: 1 },
    merchantName:           { fontSize: 16, fontWeight: '700', marginBottom: 2 },
    merchantDesc:           { fontSize: 13, lineHeight: 18 },
    amountBlock:            { alignItems: 'center', marginBottom: Spacing.xl * 1.5 },
    amountLabel:            { fontSize: 13, marginBottom: 4 },
    amountValue:            { fontSize: 40, fontWeight: '800', letterSpacing: -1 },
    payBtn:                 { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: Radius.lg },
    payBtnText:             { fontSize: 16, fontWeight: '700' },
    pinSection:             { alignItems: 'center', gap: Spacing.md },
    pinLabel:               { fontSize: 14, fontWeight: '600' },
    errorBanner:            { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 10, width: '100%' },
    errorBannerText:        { color: '#EF4444', fontSize: 13, flex: 1 },
    pinDotsRow:             { flexDirection: 'row', gap: 20, marginVertical: Spacing.md },
    pinDot:                 { width: 18, height: 18, borderRadius: 9, borderWidth: 2 },
    hiddenInput:            { position: 'absolute', opacity: 0, width: 1, height: 1 },
    successIcon:            { width: 88, height: 88, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
    successTitle:           { fontSize: 22, fontWeight: '800', marginBottom: 4 },
    successAmount:          { fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
    successTo:              { fontSize: 14, marginTop: 4, marginBottom: Spacing.xl },
    doneBtn:                { paddingHorizontal: 40, paddingVertical: 14, borderRadius: Radius.lg },
    doneBtnText:            { fontSize: 16, fontWeight: '700' },
    errorTitle:             { fontSize: 18, fontWeight: '700', marginTop: Spacing.md, marginBottom: 6 },
    errorMsg:               { fontSize: 14, textAlign: 'center' },
  });
}
