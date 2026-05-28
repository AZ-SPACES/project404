import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  Alert,
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
import { enablePasskeys, BIOMETRIC_TOKEN_KEY } from '../../../services/api';
import { useToast } from '../../../providers/ToastProvider';
import { useProfile } from '../../../providers/ProfileProvider';
import { BackButton } from '../../../components/ui/BackButton';

export default function PasskeySetupScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { showToast } = useToast();
  const { fetchProfile } = useProfile();

  const [isLoading, setIsLoading] = useState(false);

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

      // Check if biometric token already stored — re-enroll if not
      const existing = await SecureStore.getItemAsync(BIOMETRIC_TOKEN_KEY);
      if (!existing) {
        Alert.alert(
          'Passcode required',
          'To enable passkeys, enter your Aza passcode to register this device.',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setIsLoading(false) },
            {
              text: 'Continue',
              onPress: async () => {
                navigation.navigate('VerifyPasscode', {
                  onSuccessScreen: 'PasskeySetup',
                });
                setIsLoading(false);
              },
            },
          ]
        );
        return;
      }

      // Mark passkeys enabled in backend
      await enablePasskeys();
      fetchProfile();
      showToast('Passkeys enabled', 'success');
      navigation.navigate('TwoStepVerification');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to enable passkeys. Please try again.';
      showToast(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

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
  });
}
