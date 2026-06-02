import React, { useState, useRef, useEffect } from 'react';
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
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';
import Button from '../../../components/ui/Button';
import { initiateSms2faSetup, confirmSms2faSetup } from '../../../services/api';
import { useToast } from '../../../providers/ToastProvider';
import { useProfile } from '../../../providers/ProfileProvider';
import { BackButton } from '../../../components/ui/BackButton';
import { extractErrorMessage } from '../../../utils/errorUtils';

export default function SmsSetupScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { showToast } = useToast();
  const { phone, fetchProfile } = useProfile();

  const [step, setStep] = useState<1 | 2>(1);
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const [timeLeft, setTimeLeft] = useState(57);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const inputRefs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    if (step === 2 && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(t => t - 1), 1000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [step, timeLeft]);

  const handleSendCode = async () => {
    setIsSending(true);
    try {
      await initiateSms2faSetup();
      setStep(2);
      setTimeLeft(57);
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, 'Failed to send code. Please try again.');
      showToast(msg, 'error');
    } finally {
      setIsSending(false);
    }
  };

  const handleResend = async () => {
    if (timeLeft > 0) return;
    setIsSending(true);
    try {
      await initiateSms2faSetup();
      setTimeLeft(57);
      setOtp(Array(6).fill(''));
      showToast('A new code was sent to your phone.', 'success');
    } catch (err: unknown) {
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

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length < 6) return;
    setIsLoading(true);
    try {
      const res = await confirmSms2faSetup(code);
      await fetchProfile();
      const codes: string[] = res.data?.data?.codes ?? [];
      if (codes.length > 0) {
        navigation.replace('RecoveryCodes', { codes });
      } else {
        showToast('Text message verification enabled', 'success');
        navigation.navigate('TwoStepVerification');
      }
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, 'Invalid code. Please try again.');
      showToast(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const maskedPhone = phone
    ? phone.replace(/(\+?\d{1,4})\d+(\d{4})$/, '$1••••••$2')
    : 'your phone';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <BackButton onPress={() => (step === 2 ? setStep(1) : navigation.goBack())} />
          <Text style={styles.headerTitle}>Text message</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {step === 1 ? (
            <View style={styles.content}>
              <View style={styles.iconWrap}>
                <Ionicons name="chatbubble-ellipses-outline" size={40} color={Colors.primary} />
              </View>
              <Text style={styles.title}>Add text message verification</Text>
              <Text style={styles.description}>
                We'll send a 6-digit verification code to {maskedPhone} each time you log in.
              </Text>

              <View style={styles.infoBox}>
                <View style={styles.infoRow}>
                  <Ionicons name="checkmark-circle-outline" size={18} color={Colors.primary} />
                  <Text style={styles.infoText}>Works without internet, only requires phone signal</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="checkmark-circle-outline" size={18} color={Colors.primary} />
                  <Text style={styles.infoText}>Codes expire after a few minutes</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="alert-circle-outline" size={18} color={Colors.textSecondary} />
                  <Text style={[styles.infoText, { color: Colors.textSecondary }]}>Keep your phone number up to date</Text>
                </View>
              </View>

              <View style={styles.footer}>
                <Button
                  title="Send Verification Code"
                  onPress={handleSendCode}
                  loading={isSending}
                  backgroundColor={Colors.primary}
                  textColor={Colors.secondary}
                  borderRadius={Radius.full}
                  paddingVertical={16}
                />
              </View>
            </View>
          ) : (
            <View style={styles.content}>
              <View style={styles.iconWrap}>
                <Ionicons name="phone-portrait-outline" size={40} color={Colors.primary} />
              </View>
              <Text style={styles.title}>Enter verification code</Text>
              <Text style={styles.description}>
                We sent a 6-digit code to {maskedPhone}. Enter it below to enable text message verification.
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

              <TouchableOpacity onPress={handleResend} disabled={timeLeft > 0 || isSending} style={styles.resendRow}>
                <Text style={[styles.resendText, timeLeft > 0 && styles.resendDisabled]}>
                  {timeLeft > 0 ? `Resend code in ${timeLeft}s` : "Didn't get a code? Resend"}
                </Text>
              </TouchableOpacity>

              <View style={styles.footer}>
                <Button
                  title="Verify & Enable"
                  onPress={handleVerify}
                  loading={isLoading}
                  disabled={otp.join('').length < 6 || isLoading}
                  backgroundColor={Colors.primary}
                  textColor={Colors.secondary}
                  borderRadius={Radius.full}
                  paddingVertical={16}
                />
              </View>
            </View>
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
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      height: 56,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: Colors.textPrimary,
      marginLeft: Spacing.md,
    },
    scroll: { flexGrow: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: 40 },
    content: { flex: 1 },
    iconWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(22,51,0,0.06)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: Colors.textPrimary,
      marginBottom: Spacing.sm,
    },
    description: {
      fontSize: 16,
      color: Colors.textSecondary,
      lineHeight: 24,
      marginBottom: Spacing.xl,
    },
    infoBox: {
      backgroundColor: isDark ? Colors.surface : '#F9FAFB',
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: Colors.border,
      gap: 12,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    infoText: {
      flex: 1,
      fontSize: 14,
      color: Colors.textPrimary,
      lineHeight: 20,
    },
    otpWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-evenly',
      backgroundColor: isDark ? Colors.surface : '#FFFFFF',
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: Radius.sm,
      height: 56,
      paddingHorizontal: Spacing.xs,
      marginBottom: Spacing.sm,
    },
    otpSlot: {
      width: 40,
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    otpInput: {
      fontSize: 24,
      color: Colors.textPrimary,
      fontWeight: '600',
      textAlign: 'center',
      width: '100%',
      height: '100%',
    },
    dash: {
      position: 'absolute',
      bottom: 12,
      width: 16,
      height: 2,
      backgroundColor: Colors.textSecondary,
      borderRadius: 1,
    },
    resendRow: {
      alignItems: 'center',
      paddingVertical: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    resendText: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.primary,
    },
    resendDisabled: {
      color: Colors.textSecondary,
    },
    footer: {
      marginTop: 'auto',
      paddingTop: Spacing.xl,
    },
  });
}
