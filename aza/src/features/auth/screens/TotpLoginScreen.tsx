import React, { useState, useRef } from 'react';
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
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';
import Button from '../../../components/ui/Button';
import { RootStackParamList } from '../../../navigation/types';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../../../providers/AuthProvider';
import { useToast } from '../../../providers/ToastProvider';
import { usePreventScreenCapture } from '../../../hooks/usePreventScreenCapture';
import { totpLogin, TOKEN_KEY, REFRESH_TOKEN_KEY } from '../../../services/api';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'TotpLogin'>;
type TotpLoginRouteProp = RouteProp<RootStackParamList, 'TotpLogin'>;

const TotpLoginScreen: React.FC = () => {
  usePreventScreenCapture();
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<TotpLoginRouteProp>();
  const { preAuthToken } = route.params;
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const inputRefs = useRef<Array<TextInput | null>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { showToast } = useToast();

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
      const { data } = await totpLogin(preAuthToken, code);
      const payload = data?.data ?? data;
      await SecureStore.setItemAsync(TOKEN_KEY, payload.accessToken);
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, payload.refreshToken);
      login(
        payload.accessToken,
        payload.hasPasscode ?? true,
        payload.kycVerified ?? true,
      );
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || 'Invalid code. Please try again.';
      showToast(errorMsg, 'error');
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
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <MaterialIcons name="chevron-left" style={styles.backIcon} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <Text style={styles.title}>Two-Step Verification</Text>

            <View style={styles.iconContainer}>
              <MaterialIcons name="security" size={24} color={Colors.textSecondary} />
            </View>

            <Text style={styles.subTitle}>
              Enter the 6-digit code from your{'\n'}authenticator app.
            </Text>

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
                  />
                  {!digit && <View style={styles.dash} pointerEvents="none" />}
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={styles.issueButton}
              onPress={() => navigation.navigate('TwoStepVerificationIssue')}
            >
              <Text style={styles.issueText}>Having trouble?</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.verifyButtonContainer}>
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
          </View>
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
    issueButton: { paddingVertical: Spacing.sm, alignSelf: 'center', marginTop: Spacing.sm },
    issueText: {
      fontSize: Typography.body.fontSize,
      fontWeight: '600',
      color: Colors.primary,
      textDecorationLine: 'underline',
    },
    verifyButtonContainer: { paddingVertical: Spacing.lg },
  });
}

export default TotpLoginScreen;
