import React, { useState, useCallback } from "react";
import { debounce } from "lodash";
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
  StatusBar,
  Alert,
  ActivityIndicator
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import {  useAppTheme, ThemeColors, Typography, Spacing, Radius  } from "../../../theme";
import Button from "../../../components/ui/Button";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";
import { isValidEmail, sanitizeText } from "../../../utils/validation";
import { getErrorStatus } from "../../../utils/errorUtils";
import { useSignUp } from "../../../providers/SignUpProvider";
import { checkEmailAvailability } from "../../../services/api";
import { BackButton } from '../../../components/ui/BackButton';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "SignUpEmail">;

export default function SignUpEmailScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();
  const { data, update } = useSignUp();
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const emailError = (touched && data.email.trim().length > 0 && !isValidEmail(data.email))
    ? "Enter a valid email address"
    : error;

  const validateEmail = useCallback(
    debounce(async (email: string) => {
      if (!isValidEmail(email)) {
        setIsAvailable(null);
        setIsValidating(false);
        return;
      }

      try {
        const response = await checkEmailAvailability(email);
        const available = response.data?.success && response.data?.data === true;
        setIsAvailable(available);
        if (!available) {
          setError("This email address is already linked to an account.");
        } else {
          setError(null);
        }
      } catch (err: unknown) {
        if (getErrorStatus(err) === 409) {
          setIsAvailable(false);
          setError("This email address is already linked to an account.");
        } else {
          console.error("Availability check failed", err);
        }
      } finally {
        setIsValidating(false);
      }
    }, 600),
    []
  );

  const handleNext = async () => {
    if (!isValidEmail(data.email)) return;
    
    if (isAvailable === false) return;

    setLoading(true);
    setError(null);
    try {
      const response = await checkEmailAvailability(data.email);
      if (response.data?.success && response.data?.data === true) {
        navigation.navigate("SignUpPassword");
      } else {
        setIsAvailable(false);
        setError("This email address is already linked to an account.");
      }
    } catch (err: unknown) {
      if (getErrorStatus(err) === 409) {
        setIsAvailable(false);
        setError("This email address is already linked to an account.");
      } else {
        console.error("Availability check failed", err);
        setError("Unable to verify email. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTextChange = (t: string) => {
    const sanitized = sanitizeText(t);
    update({ email: sanitized });
    setError(null);
    setIsAvailable(null);
    
    if (isValidEmail(sanitized)) {
      setIsValidating(true);
      validateEmail(sanitized);
    } else {
      setIsValidating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* Header */}
          <View style={styles.header}>
            <BackButton onPress={() => navigation.goBack()} size={28} />
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={styles.title}>What's your email?</Text>
            <Text style={styles.subtitle}>
              We'll send you a code to verify this email when you sign in.
            </Text>
            <Text style={styles.label}>Your Email</Text>
            <View style={[
              styles.inputContainer,
              isAvailable === true && styles.inputSuccess,
              isAvailable === false && styles.inputError
            ]}>
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
                value={data.email}
                onChangeText={handleTextChange}
                onBlur={() => setTouched(true)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoFocus
                cursorColor={Colors.primary}
                selectionColor={Colors.primary}
              />
              {isValidating && <ActivityIndicator size="small" color={Colors.primary} />}
              {!isValidating && isAvailable === true && (
                <MaterialIcons name="check-circle" size={20} color={Colors.success} />
              )}
              {!isValidating && isAvailable === false && (
                <MaterialIcons name="error" size={20} color={Colors.error} />
              )}
            </View>
            {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
          </View>

          {/* Footer */}
          <View style={styles.buttonContainer}>
            <Button
              title="Continue"
              onPress={handleNext}
              backgroundColor={Colors.primary}
              textColor={Colors.secondary}
              borderRadius={Radius.sm}
              paddingVertical={16}
              fontSize={Typography.button.fontSize}
              fontWeight={Typography.button.fontWeight}
              disabled={!isValidEmail(data.email) || isAvailable === false || isValidating}
              loading={loading}
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
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
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
    borderRadius: 50,
    backgroundColor: isDark ? Colors.white10 : "rgba(22,51,0,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  label: {
    fontSize: Typography.bodyLg.fontSize,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    marginTop: Spacing.xl,
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
  inputSuccess: {
    borderColor: Colors.success,
  },
  inputError: {
    borderColor: Colors.error,
  },
  errorText: {
    fontSize: 12,
    color: '#D1222E',
    marginTop: 4,
  },
  buttonContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
});
}


