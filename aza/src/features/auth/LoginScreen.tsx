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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import Button from '../../components/Button';
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

const LoginScreen: React.FC = () => {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [useEmail, setUseEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const handleLogin = () => {
    navigation.navigate('OTP');
    // TODO: implement login logic
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

          <TouchableOpacity onPress={toggleInputMode} style={styles.toggleRow}>
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
            fontSize={Number(Typography.button.fontSize)}
            fontWeight={Typography.button.fontWeight as any}
          />

          <TouchableOpacity style={styles.troubleButton} onPress={handleTrouble}>
            <Text style={styles.troubleText}>Trouble logging in?</Text>
          </TouchableOpacity>
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
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 50,
    backgroundColor: "rgba(22,51,0,0.07)",
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
    fontWeight: Typography.h1.fontWeight as any,
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
    backgroundColor: "white",
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
    alignItems: 'flex-end',
    marginTop: Spacing.sm,
  },
  toggleText: {
    fontSize: Typography.body.fontSize,
    fontWeight: '600',
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
  footer: {
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
    alignItems: 'center',
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

export default LoginScreen;
