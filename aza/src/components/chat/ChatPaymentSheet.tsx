import React, { memo, useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Pressable,
  Image, Platform, TextInput, Animated,
} from 'react-native';
import { Feather } from '@react-native-vector-icons/feather';
import * as Haptics from 'expo-haptics';
import { useAppTheme, Spacing, Radius, Typography } from '../../theme';
import { useTransferStore } from '../../store/transferStore';
import { extractErrorMessage } from '../../utils/errorUtils';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------
type Step = 'amount' | 'pin' | 'success';

type ChatPaymentSheetProps = {
  visible: boolean;
  mode: 'send' | 'request';
  recipientName: string;
  recipientAvatar?: string;
  recipientIdentifier: string;
  onClose: () => void;
  onSuccess?: (amount: number, mode: 'send' | 'request') => void;
};

const PIN_LENGTH = 4;
const PIN_ARRAY = Array.from({ length: PIN_LENGTH });

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------
export const ChatPaymentSheet = memo(function ChatPaymentSheet({
  visible,
  mode,
  recipientName,
  recipientAvatar,
  recipientIdentifier,
  onClose,
  onSuccess,
}: ChatPaymentSheetProps) {
  const { colors: Colors } = useAppTheme();

  // Amount step
  const [amount, setAmount] = useState(0);
  const [showKeypad, setShowKeypad] = useState(false);
  const [keypadInput, setKeypadInput] = useState('0');

  // Step
  const [step, setStep] = useState<Step>('amount');

  // PIN step
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const pinInputRef = useRef<TextInput>(null);
  const scaleAnims = useRef(PIN_ARRAY.map(() => new Animated.Value(1))).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Captured at the moment we leave the amount step
  const finalAmountRef = useRef(0);

  const { initiateTransfer, confirmTransfer, cancelPendingTransfer, requestMoney, pendingTransactionId } =
    useTransferStore();

  const displayAmount = showKeypad ? (parseFloat(keypadInput) || 0) : amount;
  const formattedDisplay = showKeypad ? keypadInput : (amount === 0 ? '0' : String(amount));
  const canConfirm = displayAmount > 0;

  // Reset when sheet opens
  useEffect(() => {
    if (!visible) return;
    setStep('amount');
    setAmount(0);
    setKeypadInput('0');
    setShowKeypad(false);
    setPin('');
    setErrorMsg(null);
    setIsLoading(false);
  }, [visible]);

  // Focus PIN input when step becomes 'pin'
  useEffect(() => {
    if (step !== 'pin') return;
    const t = setTimeout(() => pinInputRef.current?.focus(), 150);
    return () => clearTimeout(t);
  }, [step]);

  // Auto-submit when all 4 PIN digits are entered
  useEffect(() => {
    if (step !== 'pin' || pin.length !== PIN_LENGTH || isLoading) return;
    const t = setTimeout(async () => {
      if (!pendingTransactionId) return;
      setIsLoading(true);
      setErrorMsg(null);
      try {
        await confirmTransfer(pendingTransactionId, pin);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setStep('success');
      } catch (err) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Animated.sequence([
          Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
        ]).start();
        setPin('');
        const msg = extractErrorMessage(err, 'Transfer failed. Please try again.');
        setErrorMsg(/passcode|pin|incorrect|invalid/i.test(msg) ? 'Incorrect PIN. Try again.' : msg);
      } finally {
        setIsLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [pin, step, isLoading, pendingTransactionId, confirmTransfer, shakeAnim]);

  // Auto-close 2 s after success and fire callback
  useEffect(() => {
    if (step !== 'success') return;
    const t = setTimeout(() => {
      onSuccess?.(finalAmountRef.current, mode);
      onClose();
    }, 2000);
    return () => clearTimeout(t);
  // intentionally exclude onSuccess/onClose/mode from deps — they never change mid-flight
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  // UUID pattern — the transfer API won't accept a raw UUID as recipientIdentifier
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(recipientIdentifier);

  const handleAmountConfirm = useCallback(async () => {
    if (!canConfirm || isLoading) return;
    if (isUUID) {
      setErrorMsg("Recipient identifier unavailable. Please try again later.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    finalAmountRef.current = displayAmount;
    setErrorMsg(null);
    setIsLoading(true);
    try {
      if (mode === 'request') {
        await requestMoney({ fromIdentifier: recipientIdentifier, amount: displayAmount, note: '' });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setStep('success');
      } else {
        await initiateTransfer({ recipientIdentifier, amount: displayAmount, note: '' });
        setStep('pin');
      }
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMsg(extractErrorMessage(err, 'Something went wrong. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  }, [canConfirm, isLoading, displayAmount, mode, recipientIdentifier, requestMoney, initiateTransfer]);

  const handlePinChange = useCallback((text: string) => {
    if (isLoading) return;
    if (errorMsg) setErrorMsg(null);
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, PIN_LENGTH);
    if (cleaned.length > pin.length) {
      const idx = cleaned.length - 1;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Animated.sequence([
        Animated.timing(scaleAnims[idx]!, { toValue: 1.15, duration: 100, useNativeDriver: true }),
        Animated.timing(scaleAnims[idx]!, { toValue: 1, duration: 100, useNativeDriver: true }),
      ]).start();
    }
    setPin(cleaned);
  }, [isLoading, errorMsg, pin.length, scaleAnims]);

  const handleClose = useCallback(() => {
    if (step === 'pin') cancelPendingTransfer();
    onClose();
  }, [step, cancelPendingTransfer, onClose]);

  const handleDecrement = useCallback(() => setAmount(p => Math.max(0, p - 1)), []);
  const handleIncrement = useCallback(() => setAmount(p => p + 1), []);

  const handleKeypadPress = useCallback((key: string) => {
    setKeypadInput(prev => {
      if (key === '⌫') return prev.length > 1 ? prev.slice(0, -1) : '0';
      if (key === '.') return prev.includes('.') ? prev : prev + '.';
      const parts = prev.split('.');
      if (parts[1] && parts[1].length >= 2) return prev;
      return prev === '0' ? key : prev + key;
    });
  }, []);

  const handleToggleKeypad = useCallback(() => {
    setShowKeypad(prev => {
      if (!prev) setKeypadInput(amount > 0 ? String(amount) : '0');
      else setAmount(Math.floor(parseFloat(keypadInput) || 0));
      return !prev;
    });
  }, [amount, keypadInput]);

  const ctaLabel = isLoading
    ? mode === 'send' ? 'Initiating…' : 'Sending…'
    : mode === 'send' ? `Pay ${recipientName}` : `Request from ${recipientName}`;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose} statusBarTranslucent>
      <Pressable style={styles.overlay} onPress={step !== 'success' ? handleClose : undefined} />
      <View style={styles.sheet}>
        <View style={styles.handle} />

        {/* ── AMOUNT ──────────────────────────────────────────────── */}
        {step === 'amount' && (
          <>
            <View style={styles.recipientRow}>
              {recipientAvatar ? (
                <Image source={{ uri: recipientAvatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Feather name="user" size={18} color="#888" />
                </View>
              )}
              <Text style={styles.recipientName}>{recipientName}</Text>
            </View>

            {showKeypad ? (
              <View style={styles.amountDisplay}>
                <Text style={styles.amountText} numberOfLines={1} adjustsFontSizeToFit>
                  ₵{formattedDisplay}
                </Text>
              </View>
            ) : (
              <View style={styles.stepperRow}>
                <TouchableOpacity style={styles.stepperBtn} onPress={handleDecrement} activeOpacity={0.7}>
                  <Feather name="minus" size={22} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.amountText} numberOfLines={1} adjustsFontSizeToFit>
                  ₵{formattedDisplay}
                </Text>
                <TouchableOpacity style={styles.stepperBtn} onPress={handleIncrement} activeOpacity={0.7}>
                  <Feather name="plus" size={22} color="#fff" />
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity style={styles.keypadToggleRow} onPress={handleToggleKeypad} activeOpacity={0.7}>
              <Text style={styles.keypadToggleText}>{showKeypad ? 'Hide Keypad' : 'Show Keypad'}</Text>
            </TouchableOpacity>

            {showKeypad && (
              <View style={styles.keypad}>
                {(['1','2','3','4','5','6','7','8','9','.','0','⌫'] as const).map(key => (
                  <TouchableOpacity key={key} style={styles.keypadKey} onPress={() => handleKeypadPress(key)} activeOpacity={0.5}>
                    {key === '⌫' ? (
                      <Feather name="delete" size={22} color="#fff" />
                    ) : (
                      <Text style={styles.keypadKeyText}>{key}</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

            <TouchableOpacity
              style={[styles.ctaBtn, { backgroundColor: canConfirm && !isLoading ? Colors.primary : '#2C2C2E' }]}
              onPress={handleAmountConfirm}
              activeOpacity={0.85}
              disabled={!canConfirm || isLoading}
            >
              <Text style={styles.ctaBtnText}>{ctaLabel}</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── PIN ─────────────────────────────────────────────────── */}
        {step === 'pin' && (
          <>
            <View style={styles.pinHeader}>
              <Image source={require('../../assets/aza-z.png')} style={styles.pinLogo} resizeMode="contain" />
              <Text style={styles.pinTitle}>Enter your PIN</Text>
              <Text style={styles.pinSubtitle}>
                To send{' '}
                <Text style={{ color: '#fff', fontWeight: '700' }}>
                  GH¢ {finalAmountRef.current.toFixed(2)}
                </Text>{' '}
                to {recipientName}
              </Text>
            </View>

            <TextInput

              underlineColorAndroid="transparent"
              ref={pinInputRef}
              value={pin}
              onChangeText={handlePinChange}
              keyboardType="number-pad"
              maxLength={PIN_LENGTH}
              style={styles.hiddenInput}
              secureTextEntry
              autoCorrect={false}
              autoComplete="off"
              textContentType="none"
              importantForAutofill="no"
              contextMenuHidden
            />

            <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
              <TouchableOpacity
                activeOpacity={1}
                style={styles.pinSquaresRow}
                onPress={() => pinInputRef.current?.focus()}
              >
                {PIN_ARRAY.map((_, i) => {
                  const isFilled = pin.length > i;
                  const isCurrent = pin.length === i;
                  return (
                    <Animated.View
                      key={i}
                      style={[
                        styles.pinSquare,
                        isFilled && styles.pinSquareFilled,
                        isCurrent && styles.pinSquareCurrent,
                        { transform: [{ scale: scaleAnims[i]! }] },
                      ]}
                    >
                      {isFilled ? (
                        <View style={styles.pinDot} />
                      ) : isCurrent ? (
                        <View style={styles.pinCursor} />
                      ) : null}
                    </Animated.View>
                  );
                })}
              </TouchableOpacity>
            </Animated.View>

            {isLoading ? (
              <Text style={styles.verifyingText}>Verifying…</Text>
            ) : errorMsg ? (
              <Text style={styles.errorText}>{errorMsg}</Text>
            ) : null}

            <TouchableOpacity style={styles.cancelBtn} onPress={handleClose} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── SUCCESS ─────────────────────────────────────────────── */}
        {step === 'success' && (
          <View style={styles.successContent}>
            <View style={[styles.successIcon, { borderColor: Colors.primary }]}>
              <Feather name="check" size={36} color={Colors.primary} />
            </View>
            <Text style={styles.successTitle}>
              {mode === 'send' ? 'Payment Sent!' : 'Request Sent!'}
            </Text>
            <Text style={styles.successSubtitle}>
              {mode === 'send'
                ? `GH¢ ${finalAmountRef.current.toFixed(2)} sent to ${recipientName}`
                : `Requested GH¢ ${finalAmountRef.current.toFixed(2)} from ${recipientName}`}
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
});

// ----------------------------------------------------------------------------
// Styles — always dark, Apple Cash aesthetic
// ----------------------------------------------------------------------------
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    backgroundColor: '#111111',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingHorizontal: Spacing.xl,
    paddingTop: 12,
    alignItems: 'center',
  },
  handle: { width: 40, height: 4, backgroundColor: '#3A3A3C', borderRadius: 2, marginBottom: Spacing.xl },

  // Amount
  recipientRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xl },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarFallback: { backgroundColor: '#2C2C2E', alignItems: 'center', justifyContent: 'center' },
  recipientName: { color: '#fff', ...Typography.body, fontWeight: '600', fontSize: 16 },
  stepperRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.xl, width: '100%', marginBottom: Spacing.sm,
  },
  amountDisplay: { width: '100%', alignItems: 'center', marginBottom: Spacing.sm },
  amountText: { color: '#fff', fontSize: 68, fontWeight: '700', letterSpacing: -2, lineHeight: 76, flexShrink: 1 },
  stepperBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#2C2C2E', alignItems: 'center', justifyContent: 'center' },
  keypadToggleRow: { paddingVertical: 8, marginBottom: Spacing.md },
  keypadToggleText: { color: '#8E8E93', ...Typography.body, fontSize: 15 },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', width: '100%', marginBottom: Spacing.md },
  keypadKey: { width: '33.33%', height: 64, alignItems: 'center', justifyContent: 'center' },
  keypadKeyText: { color: '#fff', fontSize: 28, fontWeight: '300' },
  ctaBtn: { width: '100%', borderRadius: Radius.full, paddingVertical: 16, alignItems: 'center', marginTop: Spacing.sm },
  ctaBtnText: { color: '#fff', ...Typography.body, fontWeight: '700', fontSize: 17 },
  errorText: { color: '#FF453A', ...Typography.caption, fontSize: 13, marginBottom: Spacing.sm, textAlign: 'center' },

  // PIN
  pinHeader: { alignItems: 'center', marginBottom: 36 },
  pinLogo: { width: 52, height: 52, marginBottom: Spacing.md },
  pinTitle: { color: '#fff', ...Typography.h3, fontWeight: '700', marginBottom: 6 },
  pinSubtitle: { color: '#8E8E93', ...Typography.body, fontSize: 14, textAlign: 'center' },
  hiddenInput: { position: 'absolute', width: 0, height: 0, opacity: 0 },
  pinSquaresRow: { flexDirection: 'row', gap: 16, marginBottom: 24 },
  pinSquare: {
    width: 56, height: 56, borderRadius: 12,
    backgroundColor: '#1C1C1E', borderWidth: 1, borderColor: '#3A3A3C',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  pinSquareFilled: { borderColor: '#30D158' },
  pinSquareCurrent: { borderColor: '#30D158' },
  pinDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#fff' },
  pinCursor: { width: 2, height: 24, backgroundColor: '#30D158' },
  verifyingText: { color: '#8E8E93', ...Typography.body, fontSize: 14, marginBottom: Spacing.md },
  cancelBtn: { paddingVertical: 12, paddingHorizontal: Spacing.xl },
  cancelBtnText: { color: '#8E8E93', ...Typography.body, fontSize: 15 },

  // Success
  successContent: { alignItems: 'center', paddingVertical: Spacing.xl * 2 },
  successIcon: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
  successTitle: { color: '#fff', ...Typography.h2, fontWeight: '700', marginBottom: 8 },
  successSubtitle: { color: '#8E8E93', ...Typography.body, fontSize: 15, textAlign: 'center' },
});
