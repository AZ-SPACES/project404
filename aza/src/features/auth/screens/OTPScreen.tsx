import React, { useState, useEffect, useRef } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {  useAppTheme, ThemeColors, Typography, Spacing, Radius  } from '../../../theme';
import Button from '../../../components/ui/Button';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { RouteProp, useRoute } from '@react-navigation/native';
import { usePreventScreenCapture } from '../../../hooks/usePreventScreenCapture';
import { api, TOKEN_KEY, REFRESH_TOKEN_KEY } from '../../../services/api';
import { useAuth } from '../../../providers/AuthProvider';
import { useToast } from '../../../providers/ToastProvider';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "OTP">;
type OTPRouteProp = RouteProp<RootStackParamList, "OTP">;

const OTPScreen: React.FC = () => {
  usePreventScreenCapture();
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<OTPRouteProp>();
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const inputRefs = useRef<Array<TextInput | null>>([]);
  const [timeLeft, setTimeLeft] = useState(57);
  const [isLoading, setIsLoading] = useState(false);
  const phoneNumber = route.params?.phoneNumber ?? '';
  const { login } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [timeLeft]);

  const handleOtpChange = (text: string, index: number) => {
    const cleanText = text.replace(/[^0-9]/g, '');
    
    // Support pasting multiple digits
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
      return;
    }

    if (!cleanText && text !== '') return;

    const newOtp = [...otp];
    newOtp[index] = cleanText;
    setOtp(newOtp);

    // Auto advance focus
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
      const { data } = await api.post('/api/v1/auth/verify-otp', {
        identifier: phoneNumber,
        code,
        purpose: 'login',
        deviceName: Device.modelName ?? undefined,
        deviceOs: Device.osName ?? undefined,
      });

      if (data.data?.preAuthToken) {
        navigation.navigate('TotpLogin', { preAuthToken: data.data.preAuthToken });
      } else if (data.data?.accessToken && data.data?.refreshToken) {
        await SecureStore.setItemAsync(TOKEN_KEY, data.data.accessToken);
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, data.data.refreshToken);
        login(
          data.data.accessToken,
          data.data.user?.passcodeSet ?? false,
          data.data.user?.kycStatus === 'VERIFIED',
        );
      }
    } catch (error: any) {
      console.error('OTP verification failed', error);
      let errorMsg = 'An unexpected error occurred. Please try again.';
      
      if (error.response) {
        errorMsg = error.response.data?.message || 'Invalid code. Please try again.';
      } else if (error.request) {
        errorMsg = 'Network error. Please check your connection and ensure the server is running.';
      } else {
        errorMsg = error.message || 'Verification failed. Please try again.';
      }
      
      showToast(errorMsg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView 
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.backButton}>
            <MaterialIcons name="chevron-left" style={styles.backicon} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.title}>Enter Code</Text>
          
          <View style={styles.iconContainer}>
            <MaterialIcons name="smartphone" size={24} color={Colors.textSecondary} />
          </View>

          <Text style={styles.subTitle}>
            We sent a verification code to your phone{'\n'}number <Text style={styles.boldText}>{phoneNumber}</Text>
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
                  maxLength={index === 0 ? 6 : 1}
                  autoFocus={index === 0}
                  cursorColor={Colors.primary}
                  textContentType="oneTimeCode"
                  autoComplete="one-time-code"
                />
                {!digit && <View style={styles.dash} pointerEvents="none" />}
              </View>
            ))}
          </View>
          
          <View style={styles.countdownContainer}>
            <Text style={styles.countdownText}>
              The code should arrive within <Text style={styles.boldText}>{timeLeft}s</Text>
            </Text>
          </View>
          
        </View>

        <View style={styles.verifyButtonContainer}>
           <Button
              title="Verify"
              onPress={handleVerify}
              backgroundColor={Colors.primary}
              textColor={Colors.secondary}
              borderRadius={30} // completely rounded
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
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 50,
    backgroundColor: isDark ? Colors.white10 : "rgba(22, 51, 0, 0.04)",
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backicon: {
    fontSize: 28,
    color: Colors.textPrimary,
  },
  content: {
    flex: 1,
    paddingTop: Spacing.sm,
  },
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
  boldText: {
    fontWeight: '700',
    color: Colors.textPrimary,
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
  countdownContainer: {
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  countdownText: {
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  verifyButtonContainer: {
    paddingVertical: Spacing.lg,
  },
});
}

export default OTPScreen;
