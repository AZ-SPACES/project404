import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  TouchableOpacity,
  StyleSheet,
  TextInputKeyPressEvent,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import { MaterialDesignIcons as MaterialCommunityIcons } from '@react-native-vector-icons/material-design-icons';
import { Feather } from '@react-native-vector-icons/feather';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';
import Button from '../../../components/ui/Button';
import { RootStackParamList } from '../../../navigation/types';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../../../providers/AuthProvider';
import { useToast } from '../../../providers/ToastProvider';
import { usePreventScreenCapture } from '../../../hooks/usePreventScreenCapture';
import { BackButton } from '../../../components/ui/BackButton';
import {
  api,
  totpLogin,
  requestSms2fa,
  requestEmail2fa,
  verify2faOtp,
  verifyPasskeys2fa,
  requestApp2faApproval,
  checkApp2faStatus,
  getDeviceId,
  TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  BIOMETRIC_TOKEN_KEY,
} from '../../../services/api';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Device from 'expo-device';
import { extractErrorMessage } from '../../../utils/errorUtils';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'TotpLogin'>;
type TotpLoginRouteProp = RouteProp<RootStackParamList, 'TotpLogin'>;

type VerificationMethod = 'APP' | 'TOTP' | 'SMS' | 'EMAIL' | 'PASSKEY';

const TotpLoginScreen: React.FC = () => {
  usePreventScreenCapture();
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<TotpLoginRouteProp>();
  const { preAuthToken, loginIdentifier, methods = ['TOTP'], defaultMethod = 'TOTP' } = route.params ?? {};
  const isLoginOtpMode = !preAuthToken && !!loginIdentifier;

  const [currentMethod, setCurrentMethod] = useState<VerificationMethod>(
    defaultMethod as VerificationMethod
  );
  const [loginOtpCountdown, setLoginOtpCountdown] = useState(57);
  const [showMethodSelector, setShowMethodSelector] = useState(false);
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const inputRefs = useRef<Array<TextInput | null>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [appRequestId, setAppRequestId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { login } = useAuth();
  const { showToast } = useToast();


  // Stop polling on unmount
  useEffect(() => {
    return () => { stopPolling(); };
  }, []);

  // Countdown timer for login-OTP mode
  useEffect(() => {
    if (!isLoginOtpMode) return;
    if (loginOtpCountdown <= 0) return;
    const t = setTimeout(() => setLoginOtpCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [isLoginOtpMode, loginOtpCountdown]);

  useEffect(() => {
    // When method changes away from APP, stop any active poll
    if (currentMethod !== 'APP') stopPolling();

    // In login-OTP mode, the SMS was already sent by /auth/login — don't re-trigger
    if (isLoginOtpMode) return;

    if (currentMethod === 'SMS') triggerSms2fa();
    else if (currentMethod === 'EMAIL') triggerEmail2fa();
    else if (currentMethod === 'PASSKEY') triggerPasskeyAuth();
    else if (currentMethod === 'APP') triggerAppApproval();
  }, [currentMethod]);

  const triggerSms2fa = async () => {
    setIsLoading(true);
    try {
      await requestSms2fa(preAuthToken!);
      showToast('A verification code has been sent to your phone.', 'success');
    } catch (error: unknown) {
      showToast('Failed to send SMS. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const triggerEmail2fa = async () => {
    setIsLoading(true);
    try {
      await requestEmail2fa(preAuthToken!);
      showToast('A verification code has been sent to your email.', 'success');
    } catch (error: unknown) {
      showToast('Failed to send email. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const triggerPasskeyAuth = async () => {
    setIsLoading(true);
    try {
      const biometricToken = await SecureStore.getItemAsync(BIOMETRIC_TOKEN_KEY);
      if (!biometricToken) {
        showToast('No passkey found on this device. Please use another method.', 'error');
        setCurrentMethod(methods.find(m => m !== 'PASSKEY') as VerificationMethod ?? 'TOTP');
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Verify your identity to sign in',
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use passcode',
        disableDeviceFallback: false,
      });

      if (!result.success) {
        showToast('Authentication cancelled', 'error');
        return;
      }

      const deviceId = await getDeviceId();
      const res = await verifyPasskeys2fa(preAuthToken!, biometricToken, deviceId);
      await finalizeLogin(res.data?.data ?? res.data);
    } catch (error: unknown) {
      const msg = extractErrorMessage(error, 'Passkey verification failed. Please try another method.');
      showToast(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const startPolling = (pToken: string, rId: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await checkApp2faStatus(pToken, rId);
        const payload = res.data?.data;
        if (payload?.accessToken) {
          stopPolling();
          await finalizeLogin(payload);
        }
        // null means still PENDING — keep polling
      } catch (err: unknown) {
        stopPolling();
        const msg = extractErrorMessage(err, 'Login request expired or was denied.');
        showToast(msg, 'error');
        const fallback = (methods.find(m => m !== 'APP') ?? 'TOTP') as VerificationMethod;
        setCurrentMethod(fallback);
        setOtp(Array(6).fill(''));
      }
    }, 3000);
  };

  const triggerAppApproval = async () => {
    setIsLoading(true);
    setAppRequestId(null);
    try {
      const res = await requestApp2faApproval(preAuthToken!);
      const requestId: string = res.data?.data ?? res.data;
      setAppRequestId(requestId);
      startPolling(preAuthToken!, requestId);
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, 'Failed to send approval request. Please try another method.');
      showToast(msg, 'error');
      const fallback = (methods.find(m => m !== 'APP') ?? 'TOTP') as VerificationMethod;
      setCurrentMethod(fallback);
    } finally {
      setIsLoading(false);
    }
  };

  type AuthPayload = {
    accessToken: string;
    refreshToken: string;
    user?: { passcodeSet?: boolean; kycStatus?: string; forcePasswordReset?: boolean; requireSelfieVerification?: boolean };
  };

  const finalizeLogin = async (payload: AuthPayload) => {
    await SecureStore.setItemAsync(TOKEN_KEY, payload.accessToken);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, payload.refreshToken);
    login({
      token: payload.accessToken,
      hasPasscode: payload.user?.passcodeSet ?? false,
      isKYCVerified: payload.user?.kycStatus === 'VERIFIED',
      forcePasswordReset: payload.user?.forcePasswordReset ?? false,
      requireSelfieVerification: payload.user?.requireSelfieVerification ?? false,
      isBiometricsEnabled: false,
    });
  };

  const handleOtpChange = (text: string, index: number) => {
    const cleanText = text.replace(/[^0-9]/g, '');

    if (cleanText.length > 1) {
      const chars = cleanText.split('').slice(0, 6);
      const newOtp = [...otp];
      chars.forEach((char, i) => {
        if (index + i < 6) newOtp[index + i] = char;
      });
      setOtp(newOtp);
      inputRefs.current[Math.min(index + chars.length, 5)]?.focus();
      return;
    }

    if (!cleanText && text !== '') return;

    const newOtp = [...otp];
    newOtp[index] = cleanText;
    setOtp(newOtp);
    if (cleanText !== '' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
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
      if (isLoginOtpMode) {
        const { data } = await api.post('/api/v1/auth/verify-otp', {
          identifier: loginIdentifier,
          code,
          purpose: 'login',
          deviceName: Device.modelName ?? undefined,
          deviceOs: Device.osName ?? undefined,
          deviceId: await getDeviceId(),
        });
        const payload = data?.data ?? data;
        if (payload?.preAuthToken) {
          // 2FA is required — replace this screen with the 2FA step
          navigation.replace('TotpLogin', {
            preAuthToken: payload.preAuthToken,
            methods: payload.methods,
            defaultMethod: payload.defaultMethod,
          });
        } else {
          await finalizeLogin(payload);
        }
        return;
      }

      let data;
      if (currentMethod === 'TOTP') {
        const res = await totpLogin(preAuthToken!, code);
        data = res.data;
      } else {
        const res = await verify2faOtp(preAuthToken!, code, currentMethod);
        data = res.data;
      }
      await finalizeLogin(data?.data ?? data);
    } catch (error: unknown) {
      const errorMsg = extractErrorMessage(error, 'Invalid code. Please try again.');
      showToast(errorMsg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const switchMethod = (method: VerificationMethod) => {
    setCurrentMethod(method);
    setShowMethodSelector(false);
    setOtp(Array(6).fill(''));
  };

  const isPasskeyMethod = currentMethod === 'PASSKEY';
  const isAppMethod = currentMethod === 'APP';

  const renderMethodSelector = () => {
    if (!showMethodSelector) return null;
    
    return (
      <View style={[styles.selectorOverlay, { backgroundColor: Colors.background + 'F0' }]}>
        <View style={styles.selectorContent}>
          <Text style={[Typography.h3, { color: Colors.textPrimary, marginBottom: 16 }]}>Choose a verification method</Text>
          
          {methods.map((m) => (
            <TouchableOpacity 
              key={m} 
              style={[styles.methodItem, { borderColor: Colors.border }]}
              onPress={() => switchMethod(m as VerificationMethod)}
            >
              <View style={styles.methodIconBox}>
                {m === 'APP' && <MaterialCommunityIcons name="cellphone-check" size={24} color={Colors.primary} />}
                {m === 'TOTP' && <MaterialIcons name="security" size={24} color={Colors.primary} />}
                {m === 'SMS' && <Feather name="message-square" size={24} color={Colors.primary} />}
                {m === 'EMAIL' && <Feather name="mail" size={24} color={Colors.primary} />}
                {m === 'PASSKEY' && <MaterialCommunityIcons name="fingerprint" size={24} color={Colors.primary} />}
              </View>
              <View>
                <Text style={[Typography.body, { color: Colors.textPrimary, fontWeight: '600' }]}>
                  {m === 'APP' ? 'Aza App' : m === 'TOTP' ? 'Authenticator App' : m === 'SMS' ? 'Text Message' : m === 'EMAIL' ? 'Email' : 'Passkey'}
                </Text>
                <Text style={[Typography.caption, { color: Colors.textSecondary }]}>
                  {m === 'APP' ? 'Approve from another device' : m === 'TOTP' ? 'Use a 6-digit code' : m === 'SMS' ? 'Receive code via SMS' : m === 'EMAIL' ? 'Receive code via Email' : 'Use Face ID or fingerprint'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
          
          <Button 
            title="Cancel" 
            onPress={() => setShowMethodSelector(false)}
            backgroundColor="transparent"
            textColor={Colors.primary}
            style={{ marginTop: 16, borderWidth: 1, borderColor: Colors.primary }}
          />
        </View>
      </View>
    );
  };

  const getSubTitleText = () => {
    if (isLoginOtpMode) {
      return `Enter the 6-digit code we sent to\n${loginIdentifier}`;
    }
    switch (currentMethod) {
      case 'TOTP': return 'Enter the 6-digit code from your\nauthenticator app.';
      case 'SMS': return 'Enter the 6-digit code we sent to\nyour phone number.';
      case 'EMAIL': return 'Enter the 6-digit code we sent to\nyour email address.';
      default: return '';
    }
  };

  const getIconName = () => {
    switch (currentMethod) {
      case 'TOTP': return 'security';
      case 'SMS': return 'smartphone';
      case 'EMAIL': return 'mail-outline';
      default: return 'security';
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.header}>
            <BackButton onPress={() => navigation.goBack()} />
          </View>

          <View style={styles.content}>
            <Text style={styles.title}>Two-Step Verification</Text>

            <View style={styles.iconContainer}>
              {isPasskeyMethod
                ? <MaterialCommunityIcons name="fingerprint" size={24} color={Colors.textSecondary} />
                : isAppMethod
                ? <MaterialCommunityIcons name="cellphone-check" size={24} color={Colors.textSecondary} />
                : <MaterialIcons name={getIconName() as any} size={24} color={Colors.textSecondary} />
              }
            </View>

            {isAppMethod ? (
              <View style={styles.appWaitContainer}>
                <Text style={styles.subTitle}>
                  A notification has been sent to your other signed-in devices. Open the Aza app and tap <Text style={{ fontWeight: '700', color: Colors.textPrimary }}>Approve</Text> to complete sign-in.
                </Text>
                <View style={styles.appWaitIndicator}>
                  <MaterialCommunityIcons name="bell-ring-outline" size={28} color={Colors.primary} />
                  <Text style={styles.appWaitText}>Waiting for approval...</Text>
                </View>
                <TouchableOpacity
                  style={styles.issueButton}
                  onPress={triggerAppApproval}
                  disabled={isLoading}
                >
                  <Text style={styles.issueText}>Resend notification</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={styles.subTitle}>
                  {isPasskeyMethod
                    ? 'Use your device biometrics (Face ID, fingerprint) to verify your identity.'
                    : getSubTitleText()
                  }
                </Text>

                {!isPasskeyMethod && (
                  <>
                    <View style={styles.otpInputWrapper}>
                      {otp.map((digit, index) => (
                        <View key={index} style={styles.otpSlot}>
                          <TextInput
                            ref={(ref) => { inputRefs.current[index] = ref; }}
                            style={styles.otpInput}
                            value={digit}
                            onChangeText={(text) => handleOtpChange(text, index)}
                            onKeyPress={(e) => handleKeyPress(e, index)}
                            keyboardType="number-pad"
                            maxLength={1}
                            autoFocus={index === 0}
                            cursorColor={Colors.primary}
                            textContentType="oneTimeCode"
                            autoComplete="one-time-code"
                          />
                          {!digit && <View style={styles.dash} pointerEvents="none" />}
                        </View>
                      ))}
                    </View>

                    {isLoginOtpMode && (
                      <View style={styles.countdownContainer}>
                        {loginOtpCountdown > 0 ? (
                          <Text style={styles.countdownText}>
                            The code should arrive within <Text style={{ fontWeight: '600', color: Colors.textPrimary }}>{loginOtpCountdown}s</Text>
                          </Text>
                        ) : (
                          <TouchableOpacity
                            style={styles.issueButton}
                            onPress={() => navigation.goBack()}
                          >
                            <Text style={styles.issueText}>Resend Code</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </>
                )}
              </>
            )}

            {!isLoginOtpMode && methods.length > 1 && !isAppMethod && (
              <TouchableOpacity
                style={styles.issueButton}
                onPress={() => setShowMethodSelector(true)}
              >
                <Text style={styles.issueText}>Try another way</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.verifyButtonContainer}>
            {isPasskeyMethod ? (
              <Button
                title="Verify with Biometrics"
                onPress={triggerPasskeyAuth}
                backgroundColor={Colors.primary}
                textColor={Colors.secondary}
                borderRadius={30}
                paddingVertical={16}
                fontSize={Typography.button.fontSize}
                fontWeight={Typography.button.fontWeight}
                loading={isLoading}
                disabled={isLoading}
              />
            ) : isAppMethod ? (
              <>
                {methods.length > 1 && (
                  <TouchableOpacity
                    style={[styles.issueButton, { marginBottom: Spacing.sm }]}
                    onPress={() => setShowMethodSelector(true)}
                  >
                    <Text style={styles.issueText}>Try another way</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <Button
                title="Verify"
                onPress={handleVerify}
                backgroundColor={Colors.primary}
                textColor={Colors.secondary}
                borderRadius={30}
                paddingVertical={16}
                fontSize={Typography.button.fontSize}
                fontWeight={Typography.button.fontWeight}
                loading={isLoading}
                disabled={isLoading || otp.join('').length < 6}
              />
            )}

            <TouchableOpacity
              style={styles.recoveryButton}
              onPress={() => navigation.navigate('RecoveryCodeLogin', { preAuthToken: preAuthToken! })}
            >
              <Text style={styles.recoveryText}>Use a recovery code</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.recoveryButton, { marginTop: 2 }]}
              onPress={() => navigation.navigate('ContactRecoveryLogin', { preAuthToken: preAuthToken! })}
            >
              <Text style={styles.recoveryText}>Contact a recovery person</Text>
            </TouchableOpacity>
          </View>
          
          {renderMethodSelector()}
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
};

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: Colors.background },
    container: { flex: 1, paddingHorizontal: Spacing.lg },
    header: { paddingTop: Spacing.sm, paddingBottom: Spacing.md },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 50,
      backgroundColor: isDark ? Colors.white10 : 'rgba(22, 51, 0, 0.04)',
      borderWidth: 1,
      borderColor: Colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backIcon: { fontSize: 28, color: Colors.textPrimary },
    content: { flex: 1, paddingTop: Spacing.sm },
    title: {
      fontSize: Typography.h1.fontSize,
      fontWeight: Typography.h1.fontWeight,
      color: Colors.textPrimary,
      marginBottom: Spacing.md,
    },
    iconContainer: {
      width: 44,
      height: 44,
      borderRadius: 18,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F0F0F0',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.md,
    },
    subTitle: {
      fontSize: 14,
      color: Colors.textSecondary,
      lineHeight: 20,
      marginBottom: Spacing.lg,
    },
    otpInputWrapper: {
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
    issueButton: { paddingVertical: Spacing.sm, alignSelf: 'center', marginTop: Spacing.xl },
    issueText: {
      fontSize: Typography.body.fontSize,
      fontWeight: '600',
      color: Colors.primary,
      textDecorationLine: 'underline',
    },
    appWaitContainer: { flex: 1 },
    appWaitIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: isDark ? Colors.surface : '#F0FDF4',
      borderWidth: 1,
      borderColor: isDark ? Colors.border : '#BBF7D0',
      borderRadius: 14,
      padding: 16,
      marginBottom: Spacing.sm,
    },
    appWaitText: {
      fontSize: 15,
      fontWeight: '600',
      color: Colors.textPrimary,
    },
    countdownContainer: {
      alignItems: 'center',
      marginTop: Spacing.lg,
    },
    countdownText: {
      fontSize: 13,
      color: Colors.textSecondary,
      fontWeight: '500',
    },
    recoveryButton: {
      paddingVertical: Spacing.md,
      alignItems: 'center',
      marginTop: Spacing.xs,
    },
    recoveryText: {
      fontSize: Typography.body.fontSize,
      color: Colors.textSecondary,
      fontWeight: '500',
    },
    verifyButtonContainer: { paddingVertical: Spacing.lg },
    
    // Selector
    selectorOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'flex-end',
      paddingBottom: 40,
    },
    selectorContent: {
      padding: 24,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
    },
    methodItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderWidth: 1,
      borderRadius: 12,
      marginBottom: 12,
    },
    methodIconBox: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: 'rgba(22, 51, 0, 0.05)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    }
  });
}

export default TotpLoginScreen;
