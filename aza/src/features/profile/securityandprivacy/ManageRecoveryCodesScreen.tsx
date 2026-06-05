import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TextInputKeyPressEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@react-native-vector-icons/feather';
import { MaterialDesignIcons as MaterialCommunityIcons } from '@react-native-vector-icons/material-design-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { useAppTheme, ThemeColors, Spacing, Radius } from '../../../theme';
import Button from '../../../components/ui/Button';
import { BackButton } from '../../../components/ui/BackButton';
import { useToast } from '../../../providers/ToastProvider';
import { useProfile } from '../../../providers/ProfileProvider';
import {
  getRecoveryCodeCount,
  regenerateRecoveryCodes,
  requestRecoveryRegenSms,
} from '../../../services/api';
import { extractErrorMessage } from '../../../utils/errorUtils';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'ManageRecoveryCodes'>;

export default function ManageRecoveryCodesScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavProp>();
  const { showToast } = useToast();
  const { totpEnabled, smsTwoFactorEnabled } = useProfile();

  const [count, setCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Which step: 'overview' | 'verify-totp' | 'verify-sms-request' | 'verify-sms-code'
  const [step, setStep] = useState<'overview' | 'verify-totp' | 'verify-sms-request' | 'verify-sms-code'>('overview');

  // TOTP entry
  const [totpCode, setTotpCode] = useState('');

  // SMS OTP boxes
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const [timeLeft, setTimeLeft] = useState(57);
  const [isSending, setIsSending] = useState(false);
  const inputRefs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    loadCount();
  }, []);

  useEffect(() => {
    if (step === 'verify-sms-code' && timeLeft > 0) {
      const t = setTimeout(() => setTimeLeft(n => n - 1), 1000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [step, timeLeft]);

  const loadCount = async () => {
    try {
      const res = await getRecoveryCodeCount();
      setCount(res.data?.data ?? res.data);
    } catch {
      setCount(null);
    }
  };

  const handleStartRegenerate = () => {
    if (totpEnabled) {
      setTotpCode('');
      setStep('verify-totp');
    } else if (smsTwoFactorEnabled) {
      setStep('verify-sms-request');
    } else {
      showToast('You need an authenticator app or text message 2FA to regenerate codes.', 'error');
    }
  };

  const handleTotpVerify = async () => {
    if (totpCode.length !== 6) return;
    setIsLoading(true);
    try {
      const res = await regenerateRecoveryCodes(totpCode, 'TOTP');
      const codes: string[] = res.data?.data?.codes ?? [];
      navigation.replace('RecoveryCodes', { codes });
    } catch (err: unknown) {
      showToast(extractErrorMessage(err, 'Invalid code. Please try again.'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestSms = async () => {
    setIsSending(true);
    try {
      await requestRecoveryRegenSms();
      setTimeLeft(57);
      setOtp(Array(6).fill(''));
      setStep('verify-sms-code');
    } catch (err: unknown) {
      showToast(extractErrorMessage(err, 'Failed to send code.'), 'error');
    } finally {
      setIsSending(false);
    }
  };

  const handleResendSms = async () => {
    if (timeLeft > 0) return;
    setIsSending(true);
    try {
      await requestRecoveryRegenSms();
      setTimeLeft(57);
      setOtp(Array(6).fill(''));
      showToast('New code sent.', 'success');
    } catch {
      showToast('Failed to resend code.', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const handleOtpChange = (text: string, index: number) => {
    const clean = text.replace(/[^0-9]/g, '');
    if (clean.length > 1) {
      const chars = clean.split('').slice(0, 6);
      const newOtp = [...otp];
      chars.forEach((c, i) => { if (index + i < 6) newOtp[index + i] = c; });
      setOtp(newOtp);
      inputRefs.current[Math.min(index + chars.length, 5)]?.focus();
      return;
    }
    if (!clean && text !== '') return;
    const newOtp = [...otp];
    newOtp[index] = clean;
    setOtp(newOtp);
    if (clean && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyPress = (e: TextInputKeyPressEvent, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
    }
  };

  const handleSmsVerify = async () => {
    const code = otp.join('');
    if (code.length < 6) return;
    setIsLoading(true);
    try {
      const res = await regenerateRecoveryCodes(code, 'SMS');
      const codes: string[] = res.data?.data?.codes ?? [];
      navigation.replace('RecoveryCodes', { codes });
    } catch (err: unknown) {
      showToast(extractErrorMessage(err, 'Invalid code. Please try again.'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (step !== 'overview') { setStep('overview'); return; }
    navigation.goBack();
  };

  const countColor = count === null ? Colors.textSecondary
    : count === 0 ? '#EF4444'
    : count <= 2 ? '#F59E0B'
    : Colors.primary;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <BackButton onPress={handleBack} />
          <Text style={styles.headerTitle}>Recovery codes</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {step === 'overview' && (
            <>
              <View style={styles.countCard}>
                <View style={styles.countIconWrap}>
                  <MaterialCommunityIcons name="shield-key-outline" size={32} color={countColor} />
                </View>
                <Text style={[styles.countNumber, { color: countColor }]}>
                  {count === null ? '—' : count}
                </Text>
                <Text style={styles.countLabel}>
                  {count === 1 ? 'code remaining' : 'codes remaining'}
                </Text>
              </View>

              {count !== null && count <= 2 && (
                <View style={[styles.alertBox, count === 0 ? styles.alertBoxDanger : styles.alertBoxWarn]}>
                  <Feather name="alert-triangle" size={16} color={count === 0 ? '#991B1B' : '#92400E'} />
                  <Text style={[styles.alertText, { color: count === 0 ? '#991B1B' : '#92400E' }]}>
                    {count === 0
                      ? 'You have no recovery codes left. Regenerate them now.'
                      : `Only ${count} code${count === 1 ? '' : 's'} left. Consider regenerating before you run out.`}
                  </Text>
                </View>
              )}

              <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                  <Feather name="key" size={16} color={Colors.textSecondary} />
                  <Text style={styles.infoText}>
                    Recovery codes let you sign in if you lose access to all your 2FA methods.
                  </Text>
                </View>
                <View style={[styles.infoRow, { marginTop: 10 }]}>
                  <Feather name="alert-circle" size={16} color={Colors.textSecondary} />
                  <Text style={styles.infoText}>
                    Each code can only be used once. Regenerating will permanently replace all existing codes.
                  </Text>
                </View>
              </View>

              <View style={styles.footer}>
                <Button
                  title="Regenerate codes"
                  onPress={handleStartRegenerate}
                  backgroundColor={Colors.primary}
                  textColor={Colors.secondary}
                  borderRadius={Radius.full}
                  paddingVertical={16}
                />
              </View>
            </>
          )}

          {step === 'verify-totp' && (
            <>
              <View style={styles.iconWrap}>
                <MaterialCommunityIcons name="shield-check-outline" size={40} color={Colors.primary} />
              </View>
              <Text style={styles.stepTitle}>Confirm with authenticator</Text>
              <Text style={styles.stepDesc}>
                Enter the 6-digit code from your authenticator app to regenerate your recovery codes.
              </Text>

              <TextInput

                underlineColorAndroid="transparent"
                style={[styles.totpInput, { borderBottomColor: Colors.primary, color: Colors.textPrimary }]}
                value={totpCode}
                onChangeText={t => setTotpCode(t.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                placeholder="000 000"
                placeholderTextColor={Colors.textSecondary}
                autoFocus
                maxLength={6}
              />

              <View style={styles.footer}>
                <Button
                  title="Verify & Regenerate"
                  onPress={handleTotpVerify}
                  loading={isLoading}
                  disabled={totpCode.length !== 6 || isLoading}
                  backgroundColor="#EF4444"
                  textColor="#FFFFFF"
                  borderRadius={Radius.full}
                  paddingVertical={16}
                />
              </View>
            </>
          )}

          {step === 'verify-sms-request' && (
            <>
              <View style={styles.iconWrap}>
                <Feather name="message-square" size={40} color={Colors.primary} />
              </View>
              <Text style={styles.stepTitle}>Confirm via text message</Text>
              <Text style={styles.stepDesc}>
                We'll send a verification code to your registered phone number to confirm this action.
              </Text>
              <View style={styles.footer}>
                <Button
                  title="Send Code"
                  onPress={handleRequestSms}
                  loading={isSending}
                  backgroundColor={Colors.primary}
                  textColor={Colors.secondary}
                  borderRadius={Radius.full}
                  paddingVertical={16}
                />
              </View>
            </>
          )}

          {step === 'verify-sms-code' && (
            <>
              <View style={styles.iconWrap}>
                <Feather name="smartphone" size={40} color={Colors.primary} />
              </View>
              <Text style={styles.stepTitle}>Enter verification code</Text>
              <Text style={styles.stepDesc}>
                Enter the 6-digit code sent to your phone.
              </Text>

              <View style={styles.otpWrapper}>
                {otp.map((digit, i) => (
                  <View key={i} style={styles.otpSlot}>
                    <TextInput
                      ref={r => { inputRefs.current[i] = r; }}
                      style={styles.otpInput}
                      value={digit}
                      onChangeText={t => handleOtpChange(t, i)}
                      onKeyPress={e => handleKeyPress(e, i)}
                      keyboardType="number-pad"
                      maxLength={i === 0 ? 6 : 1}
                      autoFocus={i === 0}
                      cursorColor={Colors.primary}
                      textContentType="oneTimeCode"
                      autoComplete="one-time-code"
                    />
                    {!digit && <View style={styles.dash} pointerEvents="none" />}
                  </View>
                ))}
              </View>

              <TouchableOpacity
                onPress={handleResendSms}
                disabled={timeLeft > 0 || isSending}
                style={styles.resendRow}
              >
                <Text style={[styles.resendText, timeLeft > 0 && { color: Colors.textSecondary }]}>
                  {timeLeft > 0 ? `Resend in ${timeLeft}s` : "Didn't get a code? Resend"}
                </Text>
              </TouchableOpacity>

              <View style={styles.footer}>
                <Button
                  title="Verify & Regenerate"
                  onPress={handleSmsVerify}
                  loading={isLoading}
                  disabled={otp.join('').length < 6 || isLoading}
                  backgroundColor="#EF4444"
                  textColor="#FFFFFF"
                  borderRadius={Radius.full}
                  paddingVertical={16}
                />
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: Colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: Spacing.lg, height: 56,
    },
    headerTitle: {
      fontSize: 18, fontWeight: '600',
      color: Colors.textPrimary, marginLeft: Spacing.md,
    },
    scroll: { flexGrow: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: 40 },
    countCard: {
      alignItems: 'center',
      backgroundColor: isDark ? Colors.surface : '#F9FAFB',
      borderRadius: 20, padding: 28,
      borderWidth: 1, borderColor: Colors.border,
      marginBottom: Spacing.lg,
    },
    countIconWrap: {
      width: 64, height: 64, borderRadius: 32,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(22,51,0,0.06)',
      justifyContent: 'center', alignItems: 'center',
      marginBottom: Spacing.md,
    },
    countNumber: { fontSize: 52, fontWeight: '800', lineHeight: 60 },
    countLabel: { fontSize: 15, color: Colors.textSecondary, marginTop: 4 },
    alertBox: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 10,
      padding: 14, borderRadius: 12,
      marginBottom: Spacing.lg, borderWidth: 1,
    },
    alertBoxWarn: { backgroundColor: '#FFFBEB', borderColor: '#FEF3C7' },
    alertBoxDanger: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
    alertText: { flex: 1, fontSize: 13, lineHeight: 18 },
    infoCard: {
      backgroundColor: isDark ? Colors.surface : '#F9FAFB',
      borderRadius: 14, padding: 16,
      borderWidth: 1, borderColor: Colors.border,
      marginBottom: Spacing.xl,
    },
    infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    infoText: { flex: 1, fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
    iconWrap: {
      width: 72, height: 72, borderRadius: 36,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(22,51,0,0.06)',
      justifyContent: 'center', alignItems: 'center',
      marginBottom: Spacing.lg, alignSelf: 'center',
    },
    stepTitle: { fontSize: 26, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.sm },
    stepDesc: { fontSize: 15, color: Colors.textSecondary, lineHeight: 22, marginBottom: Spacing.xl },
    totpInput: {
      fontSize: 36, fontWeight: '700', textAlign: 'center',
      letterSpacing: 8, borderBottomWidth: 2, paddingVertical: 8,
      marginBottom: Spacing.xl,
    },
    otpWrapper: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly',
      backgroundColor: isDark ? Colors.surface : '#FFFFFF',
      borderWidth: 1, borderColor: Colors.border,
      borderRadius: 8, height: 56, paddingHorizontal: Spacing.xs,
      marginBottom: Spacing.sm,
    },
    otpSlot: { width: 40, height: '100%', alignItems: 'center', justifyContent: 'center', position: 'relative' },
    otpInput: { fontSize: 24, color: Colors.textPrimary, fontWeight: '600', textAlign: 'center', width: '100%', height: '100%' },
    dash: { position: 'absolute', bottom: 12, width: 16, height: 2, backgroundColor: Colors.textSecondary, borderRadius: 1 },
    resendRow: { alignItems: 'center', paddingVertical: Spacing.sm, marginBottom: Spacing.lg },
    resendText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
    footer: { marginTop: 'auto' },
  });
}
