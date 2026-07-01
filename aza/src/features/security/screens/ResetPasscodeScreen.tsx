import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAppTheme, ThemeColors, Spacing, Typography, Radius } from "../../../theme";
import { usePreventScreenCapture } from "../../../hooks/usePreventScreenCapture";
import { RootStackParamList } from "../../../navigation/types";
import { api } from "../../../services/api";
import Button from "../../../components/ui/Button";
import { BackButton } from "../../../components/ui/BackButton";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "ResetPasscode">;

/**
 * Forgot-passcode reset. Re-authenticates with the account password, sends a one-time
 * code, then hands off to CreatePasscode → ConfirmPasscode (mode: "reset"), which verifies
 * the code server-side as it sets the new passcode.
 */
export default function ResetPasscodeScreen() {
  usePreventScreenCapture();
  const navigation = useNavigation<NavigationProp>();
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);

  const [step, setStep] = useState<"password" | "otp">("password");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [channelMsg, setChannelMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCode = useCallback(async () => {
    if (!password.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post("/api/v1/auth/passcode/reset/request", { password });
      const msg = res?.data?.data as string | undefined;
      setChannelMsg(msg ?? "We sent a verification code to your email.");
      setStep("otp");
    } catch (e: unknown) {
      const anyErr = e as { response?: { data?: { message?: string } } };
      setError(anyErr?.response?.data?.message ?? "Password is incorrect. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [password, loading]);

  const continueToNewPasscode = useCallback(() => {
    if (code.trim().length < 4) {
      setError("Enter the code we sent you.");
      return;
    }
    // The code is verified when the new passcode is confirmed.
    navigation.navigate("CreatePasscode", { mode: "reset", resetCode: code.trim() });
  }, [code, navigation]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.container}>
            <View style={styles.header}>
              <BackButton onPress={() => (step === "otp" ? setStep("password") : navigation.goBack())} />
            </View>

            <View style={styles.content}>
              <Text style={styles.title}>Reset passcode</Text>

              {step === "password" ? (
                <>
                  <Text style={styles.subtitle}>
                    For your security, confirm your account password. We&apos;ll send a verification
                    code before you set a new passcode.
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Account password"
                    placeholderTextColor={Colors.textSecondary}
                    secureTextEntry
                    autoCapitalize="none"
                    value={password}
                    onChangeText={(t) => { setPassword(t); setError(null); }}
                    returnKeyType="go"
                    onSubmitEditing={sendCode}
                  />
                  {error && <Text style={styles.errorText}>{error}</Text>}
                  <Button title="Send code" onPress={sendCode} loading={loading} disabled={!password.trim()} style={styles.button} />
                </>
              ) : (
                <>
                  <Text style={styles.subtitle}>{channelMsg}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Verification code"
                    placeholderTextColor={Colors.textSecondary}
                    keyboardType="number-pad"
                    value={code}
                    onChangeText={(t) => { setCode(t.replace(/[^0-9]/g, "")); setError(null); }}
                    returnKeyType="next"
                    onSubmitEditing={continueToNewPasscode}
                  />
                  {error && <Text style={styles.errorText}>{error}</Text>}
                  <Button title="Continue" onPress={continueToNewPasscode} disabled={code.trim().length < 4} style={styles.button} />
                  <Text style={styles.resend} onPress={sendCode}>Didn&apos;t get it? Resend code</Text>
                </>
              )}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: Colors.background },
    flex: { flex: 1 },
    container: { flex: 1 },
    header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
    content: { flex: 1, paddingHorizontal: Spacing.xl, paddingTop: 40 },
    title: { ...Typography.h2, color: Colors.textPrimary, marginBottom: 12 },
    subtitle: { ...Typography.body, color: Colors.textSecondary, marginBottom: 32 },
    input: {
      ...Typography.body,
      color: Colors.textPrimary,
      backgroundColor: Colors.surface,
      borderRadius: Radius.md,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    errorText: { ...Typography.caption, color: Colors.error ?? "#e5484d", marginTop: 10 },
    button: { marginTop: 24 },
    resend: { ...Typography.body, color: Colors.textPrimary, fontWeight: "600", textAlign: "center", marginTop: 24 },
  });
}
