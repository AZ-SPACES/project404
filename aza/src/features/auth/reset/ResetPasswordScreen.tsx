import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  StatusBar,
  Alert,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";
import {  useAppTheme, ThemeColors, Typography, Spacing, Radius  } from "../../../theme";
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import Button from "../../../components/ui/Button";
import { isValidEmail, sanitizeEmail } from "../../../utils/validation";
import { forgotPassword, initAccountRecovery } from "../../../services/api";
import { BackButton } from '../../../components/ui/BackButton';
import { Feather } from '@react-native-vector-icons/feather';
import { extractErrorMessage } from '../../../utils/errorUtils';

export default function ResetPasswordScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState<'code' | 'contact' | null>(null);

  const handleRecovery = async (dest: 'RecoveryCodeLogin' | 'ContactRecoveryLogin') => {
    if (!isValidEmail(email)) { setTouched(true); return; }
    setRecoveryLoading(dest === 'RecoveryCodeLogin' ? 'code' : 'contact');
    try {
      const res = await initAccountRecovery(email);
      const preAuthToken: string = res.data?.data ?? res.data;
      navigation.navigate(dest, { preAuthToken });
    } catch (err: unknown) {
      Alert.alert("Error", extractErrorMessage(err, "Could not start account recovery. Please try again."));
    } finally {
      setRecoveryLoading(null);
    }
  };

  const emailError = touched && email.length > 0 && !isValidEmail(email)
    ? "Enter a valid email address"
    : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.header}>
            <BackButton onPress={() => navigation.goBack()} size={28} />
          </View>

          <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Reset password</Text>
            <Text style={styles.subtitle}>
              Enter the email address you registered with We'll send you an
              email in order to let you choose a new password.
            </Text>

            <Text style={styles.label}>Your Email</Text>

            <View style={styles.inputContainer}>
              <MaterialIcons
                name="mail-outline"
                size={24}
                color={Colors.primary}
                style={styles.inputIcon}
              />
              <TextInput
                underlineColorAndroid="transparent"
                style={styles.input}
                placeholder="Email Address"
                placeholderTextColor={Colors.textSecondary}
                value={email}
                onChangeText={(t) => setEmail(sanitizeEmail(t))}
                onBlur={() => setTouched(true)}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}

            <View style={styles.buttonContainer}>
              <Button
                title="Reset password"
                onPress={async () => {
                  if (!isValidEmail(email)) { setTouched(true); return; }
                  setIsLoading(true);
                  try {
                    await forgotPassword(email);
                    navigation.navigate("ResetOTP", { email });
                  } catch (err: unknown) {
                    const msg = extractErrorMessage(err, "Failed to send reset code");
                    Alert.alert("Error", msg);
                  } finally {
                    setIsLoading(false);
                  }
                }}
                backgroundColor={Colors.primary}
                textColor={Colors.secondary}
                borderRadius={30}
                paddingVertical={16}
                fontSize={Typography.button.fontSize}
                fontWeight={Typography.button.fontWeight}
                loading={isLoading}
                disabled={isLoading || recoveryLoading != null}
              />
            </View>

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>or recover your account</Text>
              <View style={styles.divider} />
            </View>

            <TouchableOpacity
              style={styles.recoveryOption}
              onPress={() => handleRecovery('RecoveryCodeLogin')}
              disabled={recoveryLoading != null || isLoading}
            >
              <View style={styles.recoveryIcon}>
                <Feather name="key" size={20} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.recoveryTitle}>Use a recovery code</Text>
                <Text style={styles.recoverySubtitle}>Enter one of your saved backup codes</Text>
              </View>
              {recoveryLoading === 'code'
                ? <Feather name="loader" size={18} color={Colors.textSecondary} />
                : <Feather name="chevron-right" size={18} color={Colors.textSecondary} />
              }
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.recoveryOption}
              onPress={() => handleRecovery('ContactRecoveryLogin')}
              disabled={recoveryLoading != null || isLoading}
            >
              <View style={styles.recoveryIcon}>
                <Feather name="users" size={20} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.recoveryTitle}>Contact a recovery person</Text>
                <Text style={styles.recoverySubtitle}>Ask someone you've set as a recovery contact</Text>
              </View>
              {recoveryLoading === 'contact'
                ? <Feather name="loader" size={18} color={Colors.textSecondary} />
                : <Feather name="chevron-right" size={18} color={Colors.textSecondary} />
              }
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: isDark ? Colors.surface : '#FFFFFF',
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    backgroundColor: isDark ? Colors.white10 : "rgba(22,51,0,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.xl,
  },
  label: {
    fontSize: Typography.body.fontSize,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    height: 48,
    backgroundColor: isDark ? Colors.surface : 'white',
    marginBottom: Spacing.xl,
  },
  inputIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: Typography.bodyLg.fontSize,
    color: Colors.textPrimary,
    height: "100%",
  },
  errorText: {
    fontSize: 12,
    color: '#D1222E',
    marginTop: 4,
    marginBottom: 8,
  },
  buttonContainer: {
    marginBottom: Spacing.lg,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    gap: 10,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  recoveryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: 16,
    marginBottom: Spacing.md,
    backgroundColor: isDark ? Colors.surface : '#FAFAFA',
  },
  recoveryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(22,51,0,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recoveryTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  recoverySubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
});
}


