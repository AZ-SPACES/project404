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
  Alert,
  TextInputKeyPressEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@react-native-vector-icons/feather';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { useAppTheme, ThemeColors, Spacing, Radius } from '../../../theme';
import Button from '../../../components/ui/Button';
import { requestDisableSms2fa, disableSms2fa } from '../../../services/api';
import { useToast } from '../../../providers/ToastProvider';
import { useProfile } from '../../../providers/ProfileProvider';
import { BackButton } from '../../../components/ui/BackButton';
import { extractErrorMessage } from '../../../utils/errorUtils';

export default function DisableSmsScreen() {
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
      await requestDisableSms2fa();
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
      await requestDisableSms2fa();
      setTimeLeft(57);
      setOtp(Array(6).fill(''));
      showToast('A new code was sent to your phone.', 'success');
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

  const handleDisable = async () => {
    const code = otp.join('');
    if (code.length < 6) return;

    Alert.alert(
      'Turn off text message verification?',
      "You'll no longer receive verification codes by text when you log in. This reduces your account security.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Turn off',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              await disableSms2fa(code);
              await fetchProfile();
              showToast('Text message verification disabled', 'success');
              navigation.navigate('TwoStepVerification');
            } catch (err: unknown) {
              const msg = extractErrorMessage(err, 'Invalid code. Please try again.');
              showToast(msg, 'error');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
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

        <ScrollView contentContainerStyle={styles.scroll}>
          {step === 1 ? (
            <View style={styles.content}>
              <Text style={styles.title}>Turn off text message verification</Text>
              <Text style={styles.description}>
                To confirm, we'll send a verification code to {maskedPhone}.
              </Text>

              <View style={styles.warningBox}>
                <Feather name="alert-triangle" size={20} color="#991B1B" />
                <Text style={styles.warningText}>
                  Turning this off will remove an extra layer of protection from your account.
                </Text>
              </View>

              <View style={styles.footer}>
                <Button
                  title="Send Verification Code"
                  onPress={handleSendCode}
                  loading={isSending}
                  backgroundColor="#EF4444"
                  textColor="#FFFFFF"
                  borderRadius={Radius.full}
                  paddingVertical={16}
                />
              </View>
            </View>
          ) : (
            <View style={styles.content}>
              <Text style={styles.title}>Enter verification code</Text>
              <Text style={styles.description}>
                Enter the 6-digit code sent to {maskedPhone}.
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
                  title="Verify & Turn Off"
                  onPress={handleDisable}
                  loading={isLoading}
                  disabled={otp.join('').length < 6 || isLoading}
                  backgroundColor="#EF4444"
                  textColor="#FFFFFF"
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
    warningBox: {
      flexDirection: 'row',
      backgroundColor: '#FEF2F2',
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
      gap: 12,
    },
    warningText: {
      flex: 1,
      color: '#991B1B',
      fontSize: 14,
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
