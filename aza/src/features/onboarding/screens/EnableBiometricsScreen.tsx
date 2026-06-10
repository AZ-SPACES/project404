import React, { useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  StatusBar,
  Alert,
  Animated,
  TextInput,
  TouchableWithoutFeedback,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AntDesign } from '@react-native-vector-icons/ant-design';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import Button from '../../../components/ui/Button';
import { useAuth } from '../../../providers/AuthProvider';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import * as Device from 'expo-device';
import * as Haptics from 'expo-haptics';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';
import { biometricEnroll, getDeviceId, BIOMETRIC_TOKEN_KEY } from '../../../services/api';
import { extractErrorMessage } from '../../../utils/errorUtils';
import { CloseButton } from '../../../components/ui/CloseButton';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'EnableBiometrics'>;

type Step = 'intro' | 'pin';

type EnableBiometricsProps = {
  onComplete?: () => void;
};

export default function EnableBiometricsScreen({ onComplete }: EnableBiometricsProps) {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();
  const { toggleBiometrics } = useAuth();

  const [isBiometricAvailable, setIsBiometricAvailable] = React.useState<boolean | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [step, setStep] = React.useState<Step>('intro');
  const [pin, setPin] = React.useState('');
  const [pinError, setPinError] = React.useState(false);

  const inputRef = useRef<TextInput>(null);
  const scaleAnims = useRef([
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
  ]).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const handleFinish = React.useCallback(() => {
    if (onComplete) {
      onComplete();
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation, onComplete]);

  React.useEffect(() => {
    async function checkAvailability() {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        setIsBiometricAvailable(hasHardware && isEnrolled);
      } catch {
        setIsBiometricAvailable(false);
      }
    }
    checkAvailability();
  }, []);

  // Focus PIN input whenever the pin step becomes active
  React.useEffect(() => {
    if (step === 'pin') {
      const t = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
    return;
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

  // Step 1 — trigger Face ID / Touch ID
  const handleSetup = async () => {
    if (isBiometricAvailable === null) return;

    if (isBiometricAvailable === false) {
      handleFinish();
      return;
    }

    setIsLoading(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Enable biometric login for aza',
        disableDeviceFallback: false,
        fallbackLabel: 'Use passcode',
      });

      if (!result.success) {
        if (result.error !== 'user_cancel' && result.error !== 'system_cancel') {
          Alert.alert(
            'Biometrics unavailable',
            `Could not authenticate: ${result.error ?? 'unknown error'}. Please ensure Face ID / Touch ID is enabled in your device settings.`,
          );
        }
        return;
      }

      // Face ID passed — now ask for the in-app PIN to enroll with the backend
      setStep('pin');
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2 — enroll with backend using the PIN the user typed
  const handlePinSubmit = useCallback(async (code: string) => {
    if (code.length !== 4) return;
    setIsLoading(true);
    try {
      const deviceId = await getDeviceId();
      const deviceName = Device.modelName ?? 'Unknown Device';
      const deviceOs = Device.osName ?? 'Unknown OS';
      const response = await biometricEnroll(code, deviceId, deviceName, deviceOs);
      const payload = response.data?.data ?? response.data;
      await SecureStore.setItemAsync(BIOMETRIC_TOKEN_KEY, payload.biometricToken);
      toggleBiometrics(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      handleFinish();
    } catch (e: unknown) {
      const msg: string = extractErrorMessage(e);
      const isWrongPin =
        msg.toLowerCase().includes('invalid passcode') ||
        msg.toLowerCase().includes('passcode');
      if (isWrongPin) {
        setPinError(true);
        startShake();
        setPin('');
      } else {
        Alert.alert('Error', msg || 'Failed to enable biometrics. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [handleFinish, startShake, toggleBiometrics]);

  const handlePinChange = (text: string) => {
    if (pinError) setPinError(false);
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, 4);

    if (cleaned.length > pin.length) {
      const index = cleaned.length - 1;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Animated.sequence([
        Animated.timing(scaleAnims[index]!, { toValue: 1.15, duration: 100, useNativeDriver: true }),
        Animated.timing(scaleAnims[index]!, { toValue: 1, duration: 100, useNativeDriver: true }),
      ]).start();
    }

    setPin(cleaned);

    if (cleaned.length === 4) {
      setTimeout(() => handlePinSubmit(cleaned), 300);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (step === 'pin') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={{ flex: 1 }}>
              <View style={styles.header}>
                <CloseButton onPress={() => { setStep('intro'); setPin(''); setPinError(false); }} />
              </View>

              <View style={styles.pinContent}>
                <Text style={styles.title}>Confirm your PIN</Text>
                <Text style={styles.description}>Enter your 4-digit app passcode to activate biometric login</Text>

                {/* Hidden input */}
                <TextInput
                  underlineColorAndroid="transparent"
                  ref={inputRef}
                  value={pin}
                  onChangeText={handlePinChange}
                  keyboardType="number-pad"
                  maxLength={4}
                  style={styles.hiddenInput}
                  secureTextEntry
                />

                {/* 4-dot visualiser */}
                <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
                  <TouchableOpacity
                    activeOpacity={1}
                    style={styles.passcodeContainer}
                    onPress={() => inputRef.current?.focus()}
                  >
                    {[0, 1, 2, 3].map((i) => (
                      <Animated.View
                        key={i}
                        style={[
                          styles.passcodeBox,
                          pin.length > i && styles.passcodeBoxActive,
                          pinError && styles.passcodeBoxError,
                          { transform: [{ scale: scaleAnims[i]! }] },
                        ]}
                      >
                        {pin.length > i && (
                          <View style={[styles.dot, pinError && styles.dotError]} />
                        )}
                      </Animated.View>
                    ))}
                  </TouchableOpacity>
                </Animated.View>

                {pinError && (
                  <Text style={styles.errorText}>Incorrect passcode. Please try again.</Text>
                )}
              </View>

              <View style={styles.footer}>
                <Button
                  title="Confirm"
                  onPress={() => handlePinSubmit(pin)}
                  backgroundColor={pin.length === 4 ? Colors.primary : (isDark ? Colors.white10 : '#E5E7EB')}
                  textColor={pin.length === 4 ? Colors.secondary : (isDark ? Colors.textSecondary : '#9CA3AF')}
                  disabled={pin.length !== 4 || isLoading}
                  loading={isLoading}
                  style={styles.button}
                />
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" />
      <View style={styles.header}>
        <CloseButton onPress={handleFinish} size={24} />
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Make logging in faster with biometrics</Text>
        <Text style={styles.description}>
          Add an extra layer of security to your aza app
        </Text>

        <View style={styles.imageContainer}>
          <Image
            source={require('../../../assets/biometric.png')}
            style={styles.image}
            resizeMode="contain"
          />
        </View>
      </View>

      <View style={styles.footer}>
        <Button
          title={isBiometricAvailable === false ? 'Continue' : 'Set up biometrics'}
          onPress={handleSetup}
          backgroundColor={Colors.primary}
          textColor={Colors.secondary}
          style={styles.button}
          loading={isLoading}
          disabled={isLoading || isBiometricAvailable === null}
        />

        {isBiometricAvailable !== false && (
          <>
            <View style={styles.spacer} />
            <Button
              title="Not now"
              onPress={handleFinish}
              backgroundColor={Colors.secondary}
              textColor={Colors.primary}
              style={styles.button}
            />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    header: {
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.sm,
    },
    closeButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: isDark ? Colors.white10 : 'rgba(22, 51, 0, 0.04)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      flex: 1,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
    },
    pinContent: {
      flex: 1,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.xl,
      alignItems: 'center',
    },
    title: {
      ...Typography.h1,
      color: Colors.textPrimary,
      marginBottom: Spacing.md,
      textAlign: 'center',
    },
    description: {
      ...Typography.bodyLg,
      color: Colors.textSecondary,
      lineHeight: 24,
      textAlign: 'center',
      marginBottom: Spacing.xl * 2,
    },
    imageContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    image: {
      width: '80%',
      height: '60%',
    },
    hiddenInput: {
      position: 'absolute',
      width: 0,
      height: 0,
      opacity: 0,
    },
    passcodeContainer: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: Spacing.md,
    },
    passcodeBox: {
      width: 60,
      height: 60,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: Colors.surface,
    },
    passcodeBoxActive: {
      borderColor: Colors.primary,
    },
    passcodeBoxError: {
      borderColor: Colors.error,
    },
    dot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: Colors.textPrimary,
    },
    dotError: {
      backgroundColor: Colors.error,
    },
    errorText: {
      color: Colors.error,
      marginTop: Spacing.sm,
      fontSize: 14,
      fontWeight: '500',
      textAlign: 'center',
    },
    footer: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.lg,
    },
    button: {
      borderRadius: Radius.md,
    },
    spacer: {
      height: Spacing.md,
    },
  });
}
