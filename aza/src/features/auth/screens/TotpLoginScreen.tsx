import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, TouchableOpacity, StyleSheet, TextInputKeyPressEvent, StatusBar, ScrollView,} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import { MaterialDesignIcons as MaterialCommunityIcons } from '@react-native-vector-icons/material-design-icons';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';
import Button from '../../../components/ui/Button';
import { RootStackParamList } from '../../../navigation/types';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../../../providers/AuthProvider';
import { useToast } from '../../../providers/ToastProvider';
import { usePreventScreenCapture } from '../../../hooks/usePreventScreenCapture';
import { BackButton } from '../../../components/ui/BackButton';
import { api, totpLogin, verify2faOtp, verifyPasskeys2fa, requestApp2faApproval, checkApp2faStatus, getDeviceId, TOKEN_KEY, REFRESH_TOKEN_KEY, BIOMETRIC_TOKEN_KEY, } from '../../../services/api';
import * as LocalAuthentication from 'expo-local-authentication';
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
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { login } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  useEffect(() => {
    if (!isLoginOtpMode) return;
    if (loginOtpCountdown <= 0) return;
    const t = setTimeout(() => setLoginOtpCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [isLoginOtpMode, loginOtpCountdown]);

  const triggerPasskeyAuth = async () => {
    setIsLoading(true);
    try {
      const biometricToken = await SecureStore.getItemAsync(BIOMETRIC_TOKEN_KEY);
      if (!biometricToken) {
        showToast('No passkey found on this device. Please use another method.', 'error');
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
      const response = await verifyPasskeys2fa(preAuthToken!, biometricToken, deviceId);
      const payload = response.data?.data ?? response.data;
      handleLoginSuccess(payload);
    } catch (error: unknown) {
      showToast(extractErrorMessage(error, 'Passkey verification failed. Please try again.'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const triggerAppApproval = async () => {
    setIsLoading(true);
    try {
      const response = await requestApp2faApproval(preAuthToken!);
      const payload = response.data?.data ?? response.data;
      const requestId = payload.requestId || payload;
      startPolling(requestId);
    } catch (error: unknown) {
      showToast(extractErrorMessage(error, 'Failed to send approval request.'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const startPolling = (reqId: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await checkApp2faStatus(preAuthToken!, reqId);
        const data = res.data?.data ?? res.data;
        if (data.status === 'APPROVED') {
          stopPolling();
          handleLoginSuccess(data);
        } else if (data.status === 'REJECTED' || data.status === 'EXPIRED') {
          stopPolling();
          showToast(data.status === 'REJECTED' ? 'Sign-in request was rejected.' : 'Approval request expired.', 'error');
        }
      } catch {
      }
    }, 2000);
  };

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const handleLoginSuccess = async (payload: any) => {
    const { accessToken, refreshToken, user } = payload;
    await SecureStore.setItemAsync(TOKEN_KEY, accessToken);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    const existingBiometricToken = await SecureStore.getItemAsync(BIOMETRIC_TOKEN_KEY);

    login({
      token: accessToken,
      hasPasscode: user?.passcodeSet ?? false,
      isKYCVerified: user?.kycStatus === 'VERIFIED',
      forcePasswordReset: user?.forcePasswordReset ?? false,
      requireSelfieVerification: user?.requireSelfieVerification ?? false,
      isBiometricsEnabled: !!existingBiometricToken,
    });
  };

  const handleOtpChange = (text: string, index: number) => {
    const cleanText = text.replace(/[^0-9]/g, '');

    if (cleanText.length > 1) {
      const chars = cleanText.split('').slice(0, 6);
      const newOtp = [...otp];
      chars.forEach((char, i) => {
        if (index + i < 6) {
          newOtp[index + i] = char;
        }
      });
      setOtp(newOtp);
      const nextFocus = Math.min(index + chars.length, 5);
      inputRefs.current[nextFocus]?.focus();

      if (newOtp.every((digit) => digit.length === 1)) {
        verifyCode(newOtp.join(''));
      }
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = cleanText;
    setOtp(newOtp);

    if (cleanText !== '' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newOtp.every((digit) => digit.length === 1)) {
      verifyCode(newOtp.join(''));
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

  const verifyCode = async (codeToVerify: string) => {
    setIsLoading(true);
    try {
      let response;
      if (isLoginOtpMode) {
        response = await api.post('/api/v1/auth/login/verify-otp', {
          identifier: loginIdentifier,
          otp: codeToVerify,
        });
      } else if (currentMethod === 'TOTP') {
        response = await totpLogin(preAuthToken!, codeToVerify);
      } else {
        response = await verify2faOtp(preAuthToken!, codeToVerify, currentMethod as 'SMS' | 'EMAIL');
      }

      const payload = response.data?.data ?? response.data;
      handleLoginSuccess(payload);
    } catch (error: unknown) {
      const err = error as Record<string, unknown>;
      if (err?.isRateLimited) {
        const seconds = (err.retryAfterSeconds as number) ?? 60;
        showToast(`Too many attempts. Please try again in ${seconds}s.`, 'error');
      } else {
        showToast(extractErrorMessage(error, 'Verification failed. Please try again.'), 'error');
      }
      setOtp(Array(6).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = () => {
    const code = otp.join('');
    if (code.length === 6) {
      verifyCode(code);
    }
  };

  const isAppMethod = currentMethod === 'APP';
  const isPasskeyMethod = currentMethod === 'PASSKEY';

  const renderMethodSelector = () => {
    if (!showMethodSelector) return null;

    const methodDetails: Record<VerificationMethod, { title: string; subtitle: string; icon: any; isMatComm?: boolean }> = {
      APP: {
        title: 'App Approval',
        subtitle: 'Approve from another signed-in device',
        icon: 'cellphone-check',
        isMatComm: true,
      },
      PASSKEY: {
        title: 'Passkey / Biometrics',
        subtitle: 'Use Face ID, Touch ID, or device lock',
        icon: 'fingerprint',
        isMatComm: true,
      },
      TOTP: {
        title: 'Authenticator App',
        subtitle: 'Enter a code from your authenticator app',
        icon: 'security',
      },
      SMS: {
        title: 'SMS Message',
        subtitle: 'Receive a text message with a verification code',
        icon: 'smartphone',
      },
      EMAIL: {
        title: 'Email',
        subtitle: 'Receive an email with a verification code',
        icon: 'mail-outline',
      },
    };

    return (
      <View style={[styles.selectorOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.4)' }]}>
        <View style={[styles.selectorContent, { backgroundColor: isDark ? Colors.surface : Colors.background }]}>
          <Text style={[styles.title, { marginBottom: Spacing.md }]}>Choose another way</Text>
          <Text style={[styles.subTitle, { marginBottom: Spacing.xl }]}>
            Select an alternative method to verify your identity.
          </Text>

          {methods.map((method) => (
            <TouchableOpacity
              key={method}
              style={[
                styles.methodItem,
                {
                  borderColor: currentMethod === method ? Colors.primary : Colors.border,
                  backgroundColor: currentMethod === method ? (isDark ? Colors.white10 : '#F4FBF4') : 'transparent',
                },
              ]}
              onPress={() => {
                setCurrentMethod(method as VerificationMethod);
                setShowMethodSelector(false);
                setOtp(Array(6).fill(''));
              }}
            >
              <View style={styles.methodIconBox}>
                {methodDetails[method as VerificationMethod]?.isMatComm ? (
                  <MaterialCommunityIcons name={methodDetails[method as VerificationMethod].icon} size={24} color={Colors.primary} />
                ) : (
                  <MaterialIcons name={methodDetails[method as VerificationMethod]?.icon ?? 'security'} size={24} color={Colors.primary} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[Typography.bodyLg, { fontWeight: '600', color: Colors.textPrimary }]}>
                  {methodDetails[method as VerificationMethod]?.title ?? method}
                </Text>
                <Text style={[Typography.caption, { color: Colors.textSecondary, marginTop: 2 }]}>
                  {methodDetails[method as VerificationMethod]?.subtitle}
                </Text>
              </View>
              {currentMethod === method && (
                <MaterialIcons name="check" size={20} color={Colors.primary} />
              )}
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
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
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
                              underlineColorAndroid="transparent"
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

              {!!preAuthToken && (
                <>
                  <TouchableOpacity
                    style={styles.recoveryButton}
                    onPress={() => navigation.navigate('RecoveryCodeLogin', { preAuthToken })}
                  >
                    <Text style={styles.recoveryText}>Use a recovery code</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.recoveryButton, { marginTop: 2 }]}
                    onPress={() => navigation.navigate('ContactRecoveryLogin', { preAuthToken })}
                  >
                    <Text style={styles.recoveryText}>Contact a recovery person</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
        
        {renderMethodSelector()}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: Colors.background },
    container: { flex: 1 },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: Spacing.lg,
      justifyContent: 'space-between',
      paddingBottom: Spacing.lg,
    },
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
    verifyButtonContainer: {
      paddingTop: Spacing.xl,
      paddingBottom: Spacing.lg,
    },
    
    // Selector
    selectorOverlay: {
      ...StyleSheet.absoluteFill,
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
