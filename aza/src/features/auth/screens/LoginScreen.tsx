import React, { useState } from 'react';
import {View,Text,TextInput,TouchableOpacity,StyleSheet,KeyboardAvoidingView,Platform,TouchableWithoutFeedback,Keyboard,StatusBar,} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import {  useAppTheme, ThemeColors, Typography, Spacing, Radius  } from '../../../theme';
import Button from '../../../components/ui/Button';
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAuth } from '../../../providers/AuthProvider';
import { Alert } from 'react-native';
import { usePreventScreenCapture } from '../../../hooks/usePreventScreenCapture';
import { useToast } from '../../../providers/ToastProvider';
import { isValidEmail, isValidPhone, sanitizeEmail } from '../../../utils/validation';
import { api, biometricLogin, getDeviceId, BIOMETRIC_TOKEN_KEY } from '../../../services/api';
import * as SecureStore from 'expo-secure-store';
import * as Device from 'expo-device';
import { CloseButton } from '../../../components/ui/CloseButton';
import { extractErrorMessage } from '../../../utils/errorUtils';

type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

const LoginScreen: React.FC = () => {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [useEmail, setUseEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [touched, setTouched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isBiometricLoading, setIsBiometricLoading] = useState(false);
  const [hasBiometricToken, setHasBiometricToken] = useState(false);
  const { login } = useAuth();
  const { showToast } = useToast();
  usePreventScreenCapture();

  React.useEffect(() => {
    SecureStore.getItemAsync(BIOMETRIC_TOKEN_KEY).then((token) => {
      setHasBiometricToken(!!token);
    });
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      setPhoneNumber('');
      setEmail('');
      setPassword('');
      setTouched(false);
    }, [])
  );

  const credentialValid = useEmail ? isValidEmail(email) : isValidPhone(phoneNumber);
  const credentialError = touched && !credentialValid
    ? useEmail ? 'Enter a valid email address' : 'Enter a valid phone number'
    : null;
  const passwordError = touched && password.trim().length === 0 ? 'Password is required' : null;
  const isFormValid = credentialValid && password.trim().length > 0;

  const handleLogin = async () => {
    setTouched(true);
    if (!isFormValid) return;
    setIsLoading(true);
    try {
      const identifier = useEmail ? email : phoneNumber;
      const response = await api.post('/api/v1/auth/login', { 
        identifier, 
        password,
        deviceName: Device.modelName ?? undefined,
        deviceOs: Device.osName ?? undefined,
        deviceId: await getDeviceId(),
      });
      
      const payload = response.data?.data ?? response.data;
      if (payload?.preAuthToken) {
        navigation.navigate('TotpLogin', {
          preAuthToken: payload.preAuthToken,
          methods: payload.methods,
          defaultMethod: payload.defaultMethod,
        });
      } else if (payload?.accessToken) {
        await SecureStore.setItemAsync('aza_access_token', payload.accessToken);
        await SecureStore.setItemAsync('aza_refresh_token', payload.refreshToken);
        login({
          token: payload.accessToken,
          hasPasscode: payload.user?.passcodeSet ?? false,
          isKYCVerified: payload.user?.kycStatus === 'VERIFIED',
          forcePasswordReset: payload.user?.forcePasswordReset ?? false,
          requireSelfieVerification: payload.user?.requireSelfieVerification ?? false,
          isBiometricsEnabled: false,
        });
      } else {
        navigation.navigate('TotpLogin', { loginIdentifier: identifier, methods: ['SMS'], defaultMethod: 'SMS' });
      }
    } catch (error: unknown) {
      console.error('Login failed', error);
      const errorMsg = extractErrorMessage(error, 'Invalid credentials. Please try again.');
      showToast(errorMsg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricAuth = async () => {
    setIsBiometricLoading(true);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        Alert.alert('Not Available', 'Biometric authentication is not set up on this device');
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Login to aza',
        disableDeviceFallback: false,
        fallbackLabel: 'Use passcode',
      });

      if (!result.success) {
        if (result.error !== 'user_cancel' && result.error !== 'system_cancel') {
          showToast(
            result.error === 'not_enrolled'
              ? 'Biometrics not set up on this device.'
              : `Authentication failed: ${result.error ?? 'unknown error'}`,
            'error',
          );
        }
        return;
      }

      const storedToken = await SecureStore.getItemAsync(BIOMETRIC_TOKEN_KEY);
      if (!storedToken) {
        showToast('Biometric login not set up. Please log in with your credentials first.', 'error');
        return;
      }
      const deviceId = await getDeviceId();
      const response = await biometricLogin(storedToken, deviceId);
      const payload = response.data?.data ?? response.data;
      const { accessToken, refreshToken } = payload;
      await SecureStore.setItemAsync('aza_access_token', accessToken);
      await SecureStore.setItemAsync('aza_refresh_token', refreshToken);
      login({
        token: accessToken,
        hasPasscode: payload.user?.passcodeSet ?? true,
        isKYCVerified: payload.user?.kycStatus === 'VERIFIED',
        forcePasswordReset: payload.user?.forcePasswordReset ?? false,
        requireSelfieVerification: payload.user?.requireSelfieVerification ?? false,
        isBiometricsEnabled: true,
      });
    } catch (e: unknown) {
      showToast(extractErrorMessage(e, 'Biometric authentication failed. Please try again.'), 'error');
    } finally {
      setIsBiometricLoading(false);
    }
  };

  const handleClose = () => {
    navigation.goBack();
  };

  const handleTrouble = () => {
    navigation.navigate('TroubleLogin');
  };

  const toggleInputMode = () => {
    setUseEmail((prev) => !prev);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
        {/* Header */}
        <View style={styles.header}>
          <CloseButton onPress={handleClose} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.title}>Login</Text>

          <Text style={styles.label}>
            {useEmail ? 'Your Email' : 'Your Phone Number'}
          </Text>

          <View style={styles.inputContainer}>
            {!useEmail ? (
              <MaterialIcons name="smartphone" color={Colors.primary} style={styles.inputIcon}/>
            ) : (
              <MaterialIcons name="mail-outline" color={Colors.primary} style={styles.inputIcon}/>
            )}
            <TextInput
              underlineColorAndroid="transparent"
              key={useEmail ? 'email' : 'phone'}
              style={styles.input}
              placeholder={useEmail ? 'Email Address' : 'Phone Number'}
              placeholderTextColor={Colors.textSecondary}
              value={useEmail ? email : phoneNumber}
              onChangeText={useEmail
                ? (t) => setEmail(sanitizeEmail(t))
                : (text) => setPhoneNumber(text.replace(/[^0-9]/g, '').slice(0, 10))}
              onBlur={() => setTouched(true)}
              keyboardType={useEmail ? 'email-address' : 'phone-pad'}
              autoComplete={useEmail ? 'email' : 'tel'}
              textContentType={useEmail ? 'emailAddress' : 'telephoneNumber'}
              autoCapitalize="none"
              accessibilityLabel={useEmail ? 'Email address' : 'Phone number'}
              maxLength={useEmail ? undefined : 10}
            />
          </View>
          {credentialError ? <Text style={styles.errorText}>{credentialError}</Text> : null}

          <TouchableOpacity 
            onPress={toggleInputMode} 
            style={styles.toggleRow}
            activeOpacity={0.7}
          >
            <Text style={styles.toggleText}>
              {useEmail ? 'Use phone instead' : 'Use email instead'}
            </Text>
          </TouchableOpacity>

          <View style={styles.passwordSection}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputContainer}>
              <MaterialIcons name="lock-outline" color={Colors.primary} style={styles.inputIcon} />
              <TextInput
                underlineColorAndroid="transparent"
                style={styles.input}
                placeholder="********"
                placeholderTextColor={Colors.textSecondary}
                value={password}
                onChangeText={setPassword}
                onBlur={() => setTouched(true)}
                secureTextEntry={!isPasswordVisible}
                autoCapitalize="none"
                accessibilityLabel="Password"
              />
              <TouchableOpacity onPress={() => setIsPasswordVisible(!isPasswordVisible)}>
                <MaterialIcons
                  name={isPasswordVisible ? "visibility" : "visibility-off"}
                  size={20}
                  color={Colors.primary}
                />
              </TouchableOpacity>
            </View>
            {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Button
            title="Login"
            onPress={handleLogin}
            backgroundColor={Colors.primary}
            textColor={Colors.secondary}
            borderRadius={Radius.md}
            paddingVertical={16}
            fontSize={Typography.button.fontSize}
            fontWeight={Typography.button.fontWeight}
            loading={isLoading}
            disabled={isLoading}
          />

          {hasBiometricToken && (
            <TouchableOpacity
              style={styles.biometricButton}
              onPress={handleBiometricAuth}
              disabled={isBiometricLoading}
              accessibilityLabel="Login with biometrics"
            >
              <MaterialIcons name="fingerprint" size={40} color={isBiometricLoading ? Colors.textSecondary : Colors.primary} />
              <Text style={styles.biometricText}>Login with Biometrics</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.troubleButton} onPress={handleTrouble}>
            <Text style={styles.troubleText}>Trouble logging in?</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
};

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  header: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 50,
    backgroundColor: isDark ? Colors.white10 : "rgba(22, 51, 0, 0.04)",
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: 28,
    color: Colors.textPrimary,
  },
  content: {
    flex: 1,
    paddingTop: Spacing.md,
  },
  title: {
    fontSize: Typography.h1.fontSize,
    fontWeight: Typography.h1.fontWeight,
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: Typography.body.fontSize,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  passwordSection: {
    marginTop: Spacing.lg,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    height: 48,
    backgroundColor: isDark ? Colors.surface : 'white',
  },
  inputIcon: {
    fontSize: 24,
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: Typography.bodyLg.fontSize,
    color: Colors.textPrimary,
    height: '100%',
  },
  toggleRow: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    alignSelf: 'flex-end',
    marginTop: Spacing.xs,
    marginRight: -Spacing.sm,
  },
  toggleText: {
    fontSize: Typography.body.fontSize,
    fontWeight: '600',
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
  errorText: {
    fontSize: 12,
    color: '#D1222E',
    marginTop: 4,
  },
  footer: {
    paddingBottom: Spacing.lg,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  biometricButton: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  biometricText: {
    fontSize: Typography.body.fontSize,
    fontWeight: '600',
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
  troubleButton: {
    paddingVertical: Spacing.sm,
  },
  troubleText: {
    fontSize: Typography.body.fontSize,
    fontWeight: '600',
    color: Colors.textPrimary,
    textDecorationLine: 'underline',
  },
});
}

export default LoginScreen;
