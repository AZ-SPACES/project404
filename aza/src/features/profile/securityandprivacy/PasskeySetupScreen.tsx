import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialDesignIcons as MaterialCommunityIcons } from '@react-native-vector-icons/material-design-icons';
import { Feather } from '@react-native-vector-icons/feather';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { RootStackParamList } from '../../../navigation/types';
import { useAppTheme, ThemeColors, Spacing, Radius } from '../../../theme';
import Button from '../../../components/ui/Button';
import { enablePasskeys, biometricEnroll, getDeviceId, BIOMETRIC_TOKEN_KEY } from '../../../services/api';
import * as Device from 'expo-device';
import { useToast } from '../../../providers/ToastProvider';
import { useProfile } from '../../../providers/ProfileProvider';
import { BackButton } from '../../../components/ui/BackButton';
import { extractErrorMessage } from '../../../utils/errorUtils';

export default function PasskeySetupScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { showToast } = useToast();
  const { fetchProfile } = useProfile();

  const [isLoading, setIsLoading] = useState(false);
  const [needsEnrollment, setNeedsEnrollment] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [isEnrolling, setIsEnrolling] = useState(false);

  const handleEnrollAndEnable = async () => {
    if (passcode.length !== 4) return;
    setIsEnrolling(true);
    try {
      const deviceId = await getDeviceId();
      const deviceName = Device.modelName ?? 'Unknown Device';
      const deviceOs = Device.osName ?? 'Unknown OS';
      const res = await biometricEnroll(passcode, deviceId, deviceName, deviceOs);
      const token: string = res.data?.data?.biometricToken ?? res.data?.biometricToken;
      await SecureStore.setItemAsync(BIOMETRIC_TOKEN_KEY, token);
      await enablePasskeys();
      await fetchProfile();
      showToast('Passkeys enabled', 'success');
      navigation.navigate('TwoStepVerification');
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, 'Failed to register this device. Please try again.');
      showToast(msg, 'error');
      setPasscode('');
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleEnable = async () => {
    setIsLoading(true);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) {
        Alert.alert('Not supported', 'This device does not support biometric authentication.');
        return;
      }

      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!isEnrolled) {
        Alert.alert(
          'No biometrics set up',
          'Please set up Face ID, Touch ID, or fingerprint in your device settings first.',
        );
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to enable passkeys',
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use passcode',
        disableDeviceFallback: false,
      });

      if (!result.success) {
        showToast('Authentication cancelled', 'error');
        return;
      }

      // Check if biometric token already stored
      const existing = await SecureStore.getItemAsync(BIOMETRIC_TOKEN_KEY);
      if (!existing) {
        // No biometric token — need to enroll this device first via passcode
        setIsLoading(false);
        setNeedsEnrollment(true);
        return;
      }

      // Mark passkeys enabled in backend
      await enablePasskeys();
      await fetchProfile();
      showToast('Passkeys enabled', 'success');
      navigation.navigate('TwoStepVerification');
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, 'Failed to enable passkeys. Please try again.');
      showToast(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (needsEnrollment) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.header}>
            <BackButton onPress={() => { setNeedsEnrollment(false); setPasscode(''); }} />
            <Text style={styles.headerTitle}>Register device</Text>
          </View>
          <View style={{ flex: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl }}>
            <Text style={[styles.title, { marginBottom: Spacing.sm }]}>Enter your passcode</Text>
            <Text style={{ fontSize: 15, color: Colors.textSecondary, lineHeight: 22, marginBottom: Spacing.xl }}>
              Your passcode is needed to register this device as a trusted passkey.
            </Text>
            <TextInput
              underlineColorAndroid="transparent"
              style={[styles.passcodeInput, { borderBottomColor: Colors.primary, color: Colors.textPrimary }]}
              value={passcode}
              onChangeText={t => setPasscode(t.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              secureTextEntry
              autoFocus
              maxLength={4}
              placeholder="••••"
              placeholderTextColor={Colors.textSecondary}
            />
          </View>
          <View style={{ paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl }}>
            <Button
              title="Register & Enable"
              onPress={handleEnrollAndEnable}
              loading={isEnrolling}
              disabled={passcode.length !== 4 || isEnrolling}
              backgroundColor={Colors.primary}
              textColor={Colors.secondary}
              borderRadius={Radius.full}
              paddingVertical={16}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" />
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Passkeys</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons name="fingerprint" size={56} color={Colors.primary} />
        </View>

        <Text style={styles.title}>Use passkeys to verify your identity</Text>
        <Text style={styles.description}>
          Passkeys let you verify your identity using your device's biometrics — Face ID, fingerprint, or device PIN — instead of entering a code.
        </Text>

        <View style={styles.featureList}>
          <FeatureRow
            icon="shield"
            title="Stronger security"
            subtitle="Tied to your device — can't be phished or intercepted"
            Colors={Colors}
            isDark={isDark}
          />
          <FeatureRow
            icon="zap"
            title="Faster sign-in"
            subtitle="No codes to type — just a quick biometric check"
            Colors={Colors}
            isDark={isDark}
          />
          <FeatureRow
            icon="lock"
            title="Private by design"
            subtitle="Your biometric data never leaves your device"
            Colors={Colors}
            isDark={isDark}
          />
        </View>

        <View style={styles.footer}>
          <Button
            title="Enable Passkeys"
            onPress={handleEnable}
            loading={isLoading}
            backgroundColor={Colors.primary}
            textColor={Colors.secondary}
            borderRadius={Radius.full}
            paddingVertical={16}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function FeatureRow({ icon, title, subtitle, Colors, isDark }: {
  icon: string; title: string; subtitle: string;
  Colors: ThemeColors; isDark: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 }}>
      <View style={{
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(22,51,0,0.06)',
        justifyContent: 'center', alignItems: 'center', marginRight: 14,
      }}>
        <Feather name={icon as any} size={20} color={Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: Colors.textPrimary, marginBottom: 2 }}>{title}</Text>
        <Text style={{ fontSize: 13, color: Colors.textSecondary, lineHeight: 18 }}>{subtitle}</Text>
      </View>
    </View>
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
    scroll: {
      flexGrow: 1,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.xl,
      paddingBottom: 40,
    },
    iconWrap: {
      width: 80,
      height: 80,
      borderRadius: 40,
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
    featureList: {
      backgroundColor: isDark ? Colors.surface : '#F9FAFB',
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: Colors.border,
      marginBottom: Spacing.xl,
    },
    footer: {
      marginTop: 'auto',
    },
    passcodeInput: {
      fontSize: 32,
      fontWeight: '700',
      textAlign: 'center',
      letterSpacing: 12,
      borderBottomWidth: 2,
      paddingVertical: 8,
    },
  });
}
