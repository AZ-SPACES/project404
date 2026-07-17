import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  TextInput,
  TouchableWithoutFeedback,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from "react-native";
import * as Haptics from "expo-haptics";
import { usePreventScreenCapture } from "../../../hooks/usePreventScreenCapture";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useAppTheme, ThemeColors, Typography, Radius } from "../../../theme";
import { useAuth } from "../../../providers/AuthProvider";
import { useSecurity } from "../../../providers/SecurityProvider";
import { api } from "../../../services/api";
import Button from "../../../components/ui/Button";

export default function AppLockScreen() {
  usePreventScreenCapture();
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const { verifyPasscode, isBiometricsEnabled, logout, savePasscodeValue } = useAuth();
  const { unlock, unlockWithPasscode } = useSecurity();

  const [passcode, setPasscode] = useState("");
  const [errorStatus, setErrorStatus] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const inputRef = useRef<TextInput>(null);

  // Inline forgot-passcode recovery — the lock screen replaces the navigator, so the
  // reset (account password → OTP → new passcode) has to live here to avoid a lockout loop.
  const [view, setView] = useState<"lock" | "reset">("lock");
  const [resetStep, setResetStep] = useState<"password" | "set">("password");
  const [rPassword, setRPassword] = useState("");
  const [rCode, setRCode] = useState("");
  const [rNewPass, setRNewPass] = useState("");
  const [rConfirm, setRConfirm] = useState("");
  const [rChannel, setRChannel] = useState<string | null>(null);
  const [rLoading, setRLoading] = useState(false);
  const [rError, setRError] = useState<string | null>(null);

  const MAX_ATTEMPTS = 5;

  const backToLock = useCallback(() => {
    setView("lock");
    setResetStep("password");
    setRPassword(""); setRCode(""); setRNewPass(""); setRConfirm("");
    setRError(null); setRChannel(null);
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  const sendResetCode = useCallback(async () => {
    if (!rPassword.trim() || rLoading) return;
    setRLoading(true);
    setRError(null);
    try {
      const res = await api.post("/api/v1/auth/passcode/reset/request", { password: rPassword });
      setRChannel((res?.data?.data as string | undefined) ?? "We sent a verification code to your email.");
      setResetStep("set");
    } catch (e: unknown) {
      const anyErr = e as { response?: { data?: { message?: string } } };
      setRError(anyErr?.response?.data?.message ?? "Password is incorrect. Please try again.");
    } finally {
      setRLoading(false);
    }
  }, [rPassword, rLoading]);

  const submitReset = useCallback(async () => {
    if (rLoading) return;
    if (rCode.trim().length < 4) { setRError("Enter the code we sent you."); return; }
    if (rNewPass.length !== 4) { setRError("Passcode must be 4 digits."); return; }
    if (rNewPass !== rConfirm) { setRError("Passcodes do not match."); return; }
    setRLoading(true);
    setRError(null);
    try {
      await api.post("/api/v1/auth/passcode/reset/confirm", { code: rCode.trim(), newPasscode: rNewPass });
      await savePasscodeValue(rNewPass);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      unlockWithPasscode();
    } catch (e: unknown) {
      const anyErr = e as { response?: { data?: { message?: string } } };
      setRError(anyErr?.response?.data?.message ?? "That code was incorrect or expired. Please try again.");
    } finally {
      setRLoading(false);
    }
  }, [rLoading, rCode, rNewPass, rConfirm, savePasscodeValue, unlockWithPasscode]);

  const scaleAnims = useRef([
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
  ]).current;

  const shakeAnim = useRef(new Animated.Value(0)).current;

  const startShake = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const handleUnlock = useCallback(async () => {
    const isCorrect = await verifyPasscode(passcode);
    if (isCorrect) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      unlockWithPasscode();
    } else {
      const newCount = attemptCount + 1;
      setAttemptCount(newCount);
      setErrorStatus(true);
      startShake();
      setPasscode("");
      if (newCount >= MAX_ATTEMPTS) {
        logout();
      }
    }
  }, [passcode, verifyPasscode, unlockWithPasscode, logout, startShake, attemptCount]);

  // Attempt biometric on mount
  useEffect(() => {
    if (isBiometricsEnabled) {
      const triggerBio = async () => {
        const success = await unlock();
        if (!success) {
           inputRef.current?.focus();
        }
      };
      triggerBio();
    } else {
      setTimeout(() => inputRef.current?.focus(), 500);
    }
  }, [isBiometricsEnabled, unlock]);

  useEffect(() => {
    if (passcode.length === 4) {
      handleUnlock();
    }
  }, [passcode, handleUnlock]);

  const handleTextChange = (text: string) => {
    if (errorStatus) setErrorStatus(false);
    const cleaned = text.replace(/[^0-9]/g, "").slice(0, 4);
    
    if (cleaned.length > passcode.length) {
      const index = cleaned.length - 1;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Animated.sequence([
        Animated.timing(scaleAnims[index]!, { toValue: 1.15, duration: 100, useNativeDriver: true }),
        Animated.timing(scaleAnims[index]!, { toValue: 1, duration: 100, useNativeDriver: true }),
      ]).start();
    }
    setPasscode(cleaned);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.container}>
            {view === "lock" ? (
            <View style={styles.content}>
              <View style={styles.logoContainer}>
                 <Ionicons name="lock-closed" size={40} color={Colors.primary} />
              </View>

              <Text style={styles.title}>AZA is locked</Text>
              <Text style={styles.subtitle}>Enter your passcode to continue</Text>

              <TextInput

                underlineColorAndroid="transparent"
                ref={inputRef}
                value={passcode}
                onChangeText={handleTextChange}
                keyboardType="number-pad"
                maxLength={4}
                style={styles.hiddenInput}
              />

              <Animated.View style={[{ transform: [{ translateX: shakeAnim }] }]}>
                <TouchableOpacity
                  activeOpacity={1}
                  style={styles.passcodeContainer}
                  onPress={() => inputRef.current?.focus()}
                >
                  {[0, 1, 2, 3].map((i) => (
                    <Animated.View
                      key={i}
                      style={[
                        styles.passcodeBox,
                        passcode.length > i && styles.passcodeBoxActive,
                        errorStatus && styles.passcodeBoxError,
                        { transform: [{ scale: scaleAnims[i]! }] },
                      ]}
                    >
                      {passcode.length > i && (
                        <View style={[styles.dot, errorStatus && styles.dotError]} />
                      )}
                    </Animated.View>
                  ))}
                </TouchableOpacity>
              </Animated.View>

              {errorStatus && (
                <Text style={styles.errorText}>
                  Incorrect passcode. {MAX_ATTEMPTS - attemptCount} attempts left.
                </Text>
              )}

              {isBiometricsEnabled && (
                <TouchableOpacity style={styles.bioButton} onPress={unlock}>
                  <Ionicons name="finger-print" size={32} color={Colors.primary} />
                  <Text style={styles.bioText}>Use Biometrics</Text>
                </TouchableOpacity>
              )}
            </View>
            ) : (
            <View style={styles.resetContent}>
              <View style={styles.logoContainer}>
                <Ionicons name="key-outline" size={38} color={Colors.primary} />
              </View>
              <Text style={styles.title}>Reset passcode</Text>

              {resetStep === "password" ? (
                <>
                  <Text style={styles.subtitle}>
                    Confirm your account password. We&apos;ll send a verification code before you set a new passcode.
                  </Text>
                  <TextInput
                    style={styles.resetInput}
                    placeholder="Account password"
                    placeholderTextColor={Colors.textSecondary}
                    secureTextEntry
                    autoCapitalize="none"
                    value={rPassword}
                    onChangeText={(t) => { setRPassword(t); setRError(null); }}
                    returnKeyType="go"
                    onSubmitEditing={sendResetCode}
                  />
                  {rError && <Text style={styles.resetError}>{rError}</Text>}
                  <Button title="Send code" onPress={sendResetCode} loading={rLoading} disabled={!rPassword.trim()} style={styles.resetButton} />
                </>
              ) : (
                <>
                  <Text style={styles.subtitle}>{rChannel}</Text>
                  <TextInput
                    style={styles.resetInput}
                    placeholder="Verification code"
                    placeholderTextColor={Colors.textSecondary}
                    keyboardType="number-pad"
                    value={rCode}
                    onChangeText={(t) => { setRCode(t.replace(/[^0-9]/g, "")); setRError(null); }}
                  />
                  <TextInput
                    style={styles.resetInput}
                    placeholder="New 4-digit passcode"
                    placeholderTextColor={Colors.textSecondary}
                    keyboardType="number-pad"
                    secureTextEntry
                    maxLength={4}
                    value={rNewPass}
                    onChangeText={(t) => { setRNewPass(t.replace(/[^0-9]/g, "").slice(0, 4)); setRError(null); }}
                  />
                  <TextInput
                    style={styles.resetInput}
                    placeholder="Confirm new passcode"
                    placeholderTextColor={Colors.textSecondary}
                    keyboardType="number-pad"
                    secureTextEntry
                    maxLength={4}
                    value={rConfirm}
                    onChangeText={(t) => { setRConfirm(t.replace(/[^0-9]/g, "").slice(0, 4)); setRError(null); }}
                    returnKeyType="go"
                    onSubmitEditing={submitReset}
                  />
                  {rError && <Text style={styles.resetError}>{rError}</Text>}
                  <Button title="Reset passcode" onPress={submitReset} loading={rLoading}
                    disabled={rCode.trim().length < 4 || rNewPass.length !== 4 || rConfirm.length !== 4}
                    style={styles.resetButton} />
                  <Text style={styles.resendLink} onPress={sendResetCode}>Didn&apos;t get it? Resend code</Text>
                </>
              )}
            </View>
            )}

            <View style={styles.footer}>
              {view === "lock" ? (
                <>
                  <TouchableOpacity onPress={() => { setView("reset"); Keyboard.dismiss(); }}>
                    <Text style={styles.resetEntryText}>Forgot passcode?</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={logout} style={{ marginTop: 16 }}>
                    <Text style={styles.logoutText}>Log out</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity onPress={backToLock}>
                  <Text style={styles.logoutText}>Back to passcode</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: Colors.background },
    container: { flex: 1 },
    content: { flex: 1, alignItems: "center", justifyContent: 'center', paddingHorizontal: 40 },
    resetContent: { flex: 1, alignItems: "center", justifyContent: 'center', paddingHorizontal: 32, width: '100%' },
    resetInput: {
      ...Typography.body,
      color: Colors.textPrimary,
      backgroundColor: isDark ? Colors.surface : Colors.white,
      borderRadius: Radius.md,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: Colors.border,
      width: '100%',
      marginTop: 12,
    },
    resetError: { ...Typography.body, color: Colors.error, marginTop: 12, textAlign: 'center' },
    resetButton: { marginTop: 20, width: '100%' },
    resendLink: { ...Typography.body, color: Colors.textPrimary, fontWeight: '600', textAlign: 'center', marginTop: 20 },
    resetEntryText: { ...Typography.body, color: Colors.primary, fontWeight: '600' },
    logoContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: isDark ? Colors.white10 : "rgba(22, 51, 0, 0.04)",
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 32
    },
    title: { ...Typography.h1, color: Colors.textPrimary, marginBottom: 8, textAlign: 'center' },
    subtitle: { ...Typography.body, color: Colors.textSecondary, marginBottom: 48, textAlign: 'center' },
    hiddenInput: { position: "absolute", width: 0, height: 0, opacity: 0 },
    passcodeContainer: { flexDirection: "row", gap: 16 },
    passcodeBox: {
      width: 56,
      height: 56,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: Colors.border,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: isDark ? Colors.surface : Colors.white,
    },
    passcodeBoxActive: { borderColor: Colors.primary },
    passcodeBoxError: { borderColor: Colors.error },
    dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: Colors.textPrimary },
    dotError: { backgroundColor: Colors.error },
    errorText: { color: Colors.error, marginTop: 24, ...Typography.body, fontWeight: "500" },
    bioButton: { marginTop: 64, alignItems: 'center' },
    bioText: { ...Typography.body, color: Colors.primary, marginTop: 8, fontWeight: '600' },
    footer: { paddingBottom: 40, alignItems: 'center' },
    logoutText: { ...Typography.body, color: Colors.textSecondary, fontWeight: '500' }
  });
}
