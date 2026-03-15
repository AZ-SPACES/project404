import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  TouchableOpacity,
  StyleSheet,
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import Button from '../../components/Button';

const OTPScreen: React.FC = () => {
  const navigation = useNavigation();
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const inputRefs = useRef<Array<TextInput | null>>([]);
  const [timeLeft, setTimeLeft] = useState(57);
  const phoneNumber = '+233 53 027 9917';

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
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

  const handleKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
    }
  };

  const handleVerify = () => {
    // TODO: Verify OTP
    console.log('OTP entered:', otp.join(''));
  };

  const handleClose = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView 
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.backButton}>
            <MaterialIcons name="chevron-left" size={28} color="black" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.title}>Enter Code</Text>
          
          <View style={styles.iconContainer}>
            <MaterialIcons name="phone-iphone" size={20} color={Colors.textSecondary} />
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
                  maxLength={6}
                  autoFocus={index === 0}
                  cursorColor={Colors.primary}
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
              fontSize={Number(Typography.button.fontSize)}
              fontWeight={Typography.button.fontWeight as any}
            />
        </View>
      </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingTop: Spacing.sm,
  },
  title: {
    fontSize: Typography.h1.fontSize,
    fontWeight: Typography.h1.fontWeight as any,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#FFFFFF',
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

export default OTPScreen;
