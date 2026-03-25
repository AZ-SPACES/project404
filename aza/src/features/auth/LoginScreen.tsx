import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import {  useAppTheme, ThemeColors, Typography, Spacing, Radius  } from '../../theme';
import Button from '../../components/ui/Button';
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as LocalAuthentication from 'expo-local-authentication';
import { useAuth } from '../../providers/AuthProvider';
import { Alert } from 'react-native';

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
  const { login, isBiometricsEnabled } = useAuth();

  const handleLogin = () => {
    navigation.navigate('OTP', { isLogin: true });
    // TODO: implement login logic
  };

  const handleBiometricAuth = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      
      if (!hasHardware || !isEnrolled) {
        Alert.alert('Not Available', 'Biometric authentication is not set up on this device');
        return;
      }
      
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Login to aza',
        fallbackLabel: 'Use Passcode',
      });
      
      if (result.success) {
        // Biometric successful, bypass OTP and setup/KYC flows directly
        login('biometric-token', true, true);
      }
    } catch (e) {
      console.error(e);
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
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <MaterialIcons style={styles.closeIcon} name="close" />
          </TouchableOpacity>
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
              style={styles.input}
              placeholder={useEmail ? 'Email Address' : 'Phone Number'}
              placeholderTextColor={Colors.textSecondary}
              value={useEmail ? email : phoneNumber}
              onChangeText={useEmail ? setEmail : setPhoneNumber}
              keyboardType={useEmail ? 'email-address' : 'phone-pad'}
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity 
            onPress={toggleInputMode} 
            style={styles.toggleRow}
            activeOpacity={0.7}
          >
            <Text style={styles.toggleText}>
              {useEmail ? 'Use phone instead' : 'Use email instead'}
            </Text>
          </TouchableOpacity>

          {useEmail && (
            <View style={styles.passwordSection}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputContainer}>
                <MaterialIcons name="fingerprint" color={Colors.primary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="********"
                  placeholderTextColor={Colors.textSecondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!isPasswordVisible}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setIsPasswordVisible(!isPasswordVisible)}>
                  <MaterialIcons
                    name={isPasswordVisible ? "visibility" : "visibility-off"}
                    size={20}
                    color={Colors.primary}
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}
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
          />

          {isBiometricsEnabled && (
            <TouchableOpacity style={styles.biometricButton} onPress={handleBiometricAuth}>
              <MaterialIcons name="fingerprint" size={40} color={Colors.primary} />
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
  const isDark = Colors.background === '#121212';
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
