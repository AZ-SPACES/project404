import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@react-native-vector-icons/feather';
import * as SecureStore from 'expo-secure-store';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';
import Button from '../../../components/ui/Button';
import { BackButton } from '../../../components/ui/BackButton';
import { RootStackParamList } from '../../../navigation/types';
import { redeemRecoveryCode, TOKEN_KEY, REFRESH_TOKEN_KEY } from '../../../services/api';
import { useAuth } from '../../../providers/AuthProvider';
import { useToast } from '../../../providers/ToastProvider';
import { usePreventScreenCapture } from '../../../hooks/usePreventScreenCapture';
import { extractErrorMessage, getErrorStatus } from '../../../utils/errorUtils';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'RecoveryCodeLogin'>;
type RoutePropType = RouteProp<RootStackParamList, 'RecoveryCodeLogin'>;

export default function RecoveryCodeLoginScreen() {
  usePreventScreenCapture();
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RoutePropType>();
  const { preAuthToken } = route.params;

  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { showToast } = useToast();

  const handleCodeChange = (text: string) => {
    // Auto-format as user types: insert dashes after every 4 chars
    const raw = text.replace(/[^a-fA-F0-9]/g, '').toLowerCase().slice(0, 12);
    let formatted = raw;
    if (raw.length > 8) formatted = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
    else if (raw.length > 4) formatted = `${raw.slice(0, 4)}-${raw.slice(4)}`;
    setCode(formatted);
  };

  const isValid = /^[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}$/.test(code);

  const handleSubmit = async () => {
    if (!isValid) return;
    setIsLoading(true);
    try {
      const res = await redeemRecoveryCode(preAuthToken, code);
      const payload = res.data?.data ?? res.data;
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
    } catch (err: unknown) {
      const status = getErrorStatus(err);
      if (status === 401 || status === 403) {
        showToast('Your session has expired. Please try logging in again.', 'error');
        navigation.goBack();
      } else {
        showToast(extractErrorMessage(err, 'Invalid or already-used recovery code.'), 'error');
      }
    } finally {
      setIsLoading(false);
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
            <Text style={styles.title}>Use a recovery code</Text>

            <View style={styles.iconContainer}>
              <Feather name="key" size={24} color={Colors.textSecondary} />
            </View>

            <Text style={styles.subtitle}>
              Enter one of the recovery codes you saved when you set up 2-step verification.
            </Text>

            <TextInput

              underlineColorAndroid="transparent"
              style={styles.input}
              value={code}
              onChangeText={handleCodeChange}
              placeholder="xxxx-xxxx-xxxx"
              placeholderTextColor={Colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              keyboardType="default"
            />

            <View style={styles.warningBox}>
              <Feather name="alert-triangle" size={16} color="#B45309" />
              <Text style={styles.warningText}>
                Each recovery code can only be used once and will be consumed immediately.
              </Text>
            </View>
          </View>

          <View style={styles.footer}>
            <Button
              title="Verify"
              onPress={handleSubmit}
              loading={isLoading}
              disabled={!isValid || isLoading}
              backgroundColor={Colors.primary}
              textColor={Colors.secondary}
              borderRadius={Radius.full}
              paddingVertical={16}
              fontSize={Typography.button.fontSize}
              fontWeight={Typography.button.fontWeight}
            />
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: Colors.background },
    container: { flex: 1, paddingHorizontal: Spacing.lg },
    header: { paddingTop: Spacing.sm, paddingBottom: Spacing.md },
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
    subtitle: {
      fontSize: 14,
      color: Colors.textSecondary,
      lineHeight: 20,
      marginBottom: Spacing.xl,
    },
    input: {
      fontSize: 28,
      fontWeight: '700',
      color: Colors.textPrimary,
      textAlign: 'center',
      letterSpacing: 4,
      borderBottomWidth: 2,
      borderBottomColor: Colors.primary,
      paddingVertical: 12,
      marginBottom: Spacing.xl,
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    warningBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      backgroundColor: '#FFFBEB',
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#FEF3C7',
    },
    warningText: {
      flex: 1,
      fontSize: 13,
      color: '#92400E',
      lineHeight: 18,
    },
    footer: { paddingVertical: Spacing.lg },
  });
}
