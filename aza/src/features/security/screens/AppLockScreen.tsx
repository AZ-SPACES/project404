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
import { useAppTheme, ThemeColors, Typography } from "../../../theme";
import { useAuth } from "../../../providers/AuthProvider";
import { useSecurity } from "../../../providers/SecurityProvider";

export default function AppLockScreen() {
  usePreventScreenCapture();
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const { verifyPasscode, isBiometricsEnabled, logout } = useAuth();
  const { unlock, unlockWithPasscode } = useSecurity();

  const [passcode, setPasscode] = useState("");
  const [errorStatus, setErrorStatus] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const inputRef = useRef<TextInput>(null);

  const MAX_ATTEMPTS = 5;

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
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.container}>
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

            <View style={styles.footer}>
               <TouchableOpacity onPress={logout}>
                  <Text style={styles.logoutText}>Forgot passcode? Log out</Text>
               </TouchableOpacity>
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
