import React, { useState, useCallback } from "react";
import { debounce } from "lodash";
import { View, Text, TextInput, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, TouchableOpacity, Keyboard, StyleSheet, StatusBar, ActivityIndicator, ScrollView,} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import {  useAppTheme, ThemeColors, Typography, Spacing, Radius  } from "../../../theme";
import Button from "../../../components/ui/Button";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";
import { isValidEmail, sanitizeEmail } from "../../../utils/validation";
import { getErrorStatus } from "../../../utils/errorUtils";
import { useSignUp } from "../../../providers/SignUpProvider";
import { validateEmail, EmailCheck } from "../../../services/api";
import { BackButton } from '../../../components/ui/BackButton';
import SignUpProgressBar from '../../../components/ui/SignUpProgressBar';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "SignUpEmail">;

const REJECTION_COPY: Record<NonNullable<EmailCheck["reason"]>, string> = {
  ALREADY_REGISTERED: "This email address is already linked to an account.",
  DISPOSABLE_DOMAIN: "Temporary email addresses aren't supported. Please use a permanent address.",
  UNRESOLVABLE_DOMAIN: "We can't find that email provider. Check the address for typos.",
  INVALID_FORMAT: "Enter a valid email address",
};

const rejectionCopy = (check: EmailCheck) =>
  REJECTION_COPY[check.reason ?? "INVALID_FORMAT"];

export default function SignUpEmailScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();
  const { data, update } = useSignUp();
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [check, setCheck] = useState<EmailCheck | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The address the user last typed. Responses for anything else are stale — the
  // checks are debounced and network-bound, so a slow early one can otherwise land
  // after a fast later one and label the wrong address.
  const pendingEmail = React.useRef("");

  const accepted = check?.valid === true && check?.available === true;
  const rejected = check !== null && !accepted;

  const emailError = (touched && data.email.trim().length > 0 && !isValidEmail(data.email))
    ? "Enter a valid email address"
    : error;

  const applyCheck = (email: string, result: EmailCheck) => {
    if (pendingEmail.current !== email) return false;
    setCheck(result);
    setError(result.valid && result.available ? null : rejectionCopy(result));
    return true;
  };

  const runCheck = useCallback(
    debounce(async (email: string) => {
      if (!isValidEmail(email)) {
        setCheck(null);
        setIsValidating(false);
        return;
      }

      try {
        const response = await validateEmail(email);
        const result = response.data?.data;
        if (result) applyCheck(email, result);
      } catch (err: unknown) {
        // A failed check shouldn't block the user — the server validates again at
        // signup, so leave the field neutral and let them continue.
        console.error("Email check failed", err);
      } finally {
        if (pendingEmail.current === email) setIsValidating(false);
      }
    }, 600),
    []
  );

  // Cancel in-flight debounce when the component unmounts.
  React.useEffect(() => () => runCheck.cancel(), [runCheck]);

  const handleNext = async () => {
    if (!isValidEmail(data.email)) return;
    if (rejected) return;

    // The debounced check already cleared this address — skip the redundant call.
    if (accepted) {
      navigation.navigate("SignUpPassword");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await validateEmail(data.email);
      const result = response.data?.data;
      if (result?.valid && result.available) {
        applyCheck(data.email, result);
        navigation.navigate("SignUpPassword");
      } else if (result) {
        applyCheck(data.email, result);
      }
    } catch (err: unknown) {
      if (getErrorStatus(err) === 409) {
        setCheck({ valid: true, available: false, reason: "ALREADY_REGISTERED" });
        setError(REJECTION_COPY.ALREADY_REGISTERED);
      } else {
        console.error("Email check failed", err);
        setError("Unable to verify email. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTextChange = (t: string) => {
    const sanitized = sanitizeEmail(t);
    update({ email: sanitized });
    setError(null);
    setCheck(null);
    pendingEmail.current = sanitized;

    if (isValidEmail(sanitized)) {
      setIsValidating(true);
      runCheck(sanitized);
    } else {
      setIsValidating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.header}>
              <BackButton onPress={() => navigation.goBack()} size={28} />
            </View>

            <SignUpProgressBar step={2} total={10} />

            {/* Content */}
            <View style={styles.content}>
              <Text style={styles.title}>What's your email?</Text>
              <Text style={styles.subtitle}>
                We'll send you a code to verify this email when you sign in.
              </Text>
              <Text style={styles.label}>Your Email</Text>
              <View style={[
                styles.inputContainer,
                accepted && styles.inputSuccess,
                rejected && styles.inputError
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
                {!isValidating && accepted && (
                  <MaterialIcons name="check-circle" size={20} color={Colors.success} />
                )}
                {!isValidating && rejected && (
                  <MaterialIcons name="error" size={20} color={Colors.error} />
                )}
              </View>
              {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
              {/* Advisory: the address may be perfectly fine, so this is a tap to correct,
                  never an automatic change. */}
              {check?.suggestion ? (
                <TouchableOpacity
                  onPress={() => handleTextChange(check.suggestion!)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Use ${check.suggestion} instead`}
                  style={styles.suggestionRow}
                >
                  <MaterialIcons name="lightbulb-outline" size={16} color={Colors.textSecondary} />
                  <Text style={styles.suggestionText}>
                    Did you mean <Text style={styles.suggestionEmail}>{check.suggestion}</Text>?
                  </Text>
                </TouchableOpacity>
              ) : null}
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
                disabled={!isValidEmail(data.email) || rejected || isValidating}
                loading={loading}
              />
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
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
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingBottom: Spacing.lg,
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
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  suggestionText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginLeft: 6,
  },
  suggestionEmail: {
    color: Colors.primary,
    fontWeight: "600",
  },
  buttonContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    marginBottom: Spacing.lg,
  },
});
}


