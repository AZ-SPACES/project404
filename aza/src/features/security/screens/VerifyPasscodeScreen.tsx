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
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { usePreventScreenCapture } from "../../../hooks/usePreventScreenCapture";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from '@react-native-vector-icons/feather';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useAppTheme, ThemeColors, Spacing, Typography, Radius } from "../../../theme";
import { useAuth } from "../../../providers/AuthProvider";
import { RootStackParamList } from "../../../navigation/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "VerifyPasscode">;
type VerifyPasscodeRouteProp = RouteProp<RootStackParamList, "VerifyPasscode">;

export function VerifyPasscodeScreen() {
  usePreventScreenCapture();
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<VerifyPasscodeRouteProp>();
  const { verifyPasscode, isBiometricsEnabled } = useAuth();

  const { onSuccessScreen, onSuccessParams } = route.params;

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

  const handleVerify = useCallback(async () => {
    const isCorrect = await verifyPasscode(passcode);
    if (isCorrect) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Navigate to the success screen
      // Forward the just-verified passcode so a change flow can prove the current one.
      navigation.replace(onSuccessScreen as any, { ...(onSuccessParams ?? {}), currentPasscode: passcode });
    } else {
      const newCount = attemptCount + 1;
      setAttemptCount(newCount);
      setErrorStatus(true);
      startShake();
      setPasscode("");
    }
  }, [passcode, verifyPasscode, navigation, onSuccessScreen, onSuccessParams, attemptCount, startShake]);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 500);
  }, []);

  useEffect(() => {
    if (passcode.length === 4) {
      handleVerify();
    }
  }, [passcode, handleVerify]);

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
            <View style={styles.header}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <Feather name="x" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.content}>
              <View style={styles.iconContainer}>
                 <Ionicons name="shield-checkmark" size={40} color={Colors.primary} />
              </View>
              
              <Text style={styles.title}>Confirm it's you</Text>
              <Text style={styles.subtitle}>Enter your 4-digit passcode to proceed with this sensitive change.</Text>

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

              <TouchableOpacity onPress={() => navigation.navigate('ResetPasscode')} style={styles.forgotLink}>
                <Text style={styles.forgotText}>Forgot passcode?</Text>
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
    header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
    backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
    content: { flex: 1, alignItems: "center", paddingTop: 60, paddingHorizontal: 40 },
    iconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: isDark ? Colors.white10 : "rgba(22, 51, 0, 0.04)",
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 32
    },
    title: { ...Typography.h2, color: Colors.textPrimary, marginBottom: 8, textAlign: 'center' },
    subtitle: { ...Typography.body, color: Colors.textSecondary, marginBottom: 48, textAlign: 'center' },
    forgotLink: { marginTop: 28, paddingVertical: 8 },
    forgotText: { ...Typography.body, color: Colors.textPrimary, fontWeight: '600' },
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
  });
}
