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
import { useNavigation, useRoute, RouteProp, useFocusEffect } from "@react-navigation/native";
import { usePreventScreenCapture } from "../../../hooks/usePreventScreenCapture";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import { useAppTheme, ThemeColors, Spacing, Radius } from "../../../theme";
import Button from "../../../components/ui/Button";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";
import { useAuth } from "../../../providers/AuthProvider";
import { useSignupActions } from "../../../providers/SignUpProvider";
import { api } from "../../../services/api";
import { BackButton } from '../../../components/ui/BackButton';

type NavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "ConfirmPasscode"
>;
type ConfirmPageRouteProp = RouteProp<RootStackParamList, "ConfirmPasscode">;

const MAX_ATTEMPTS = 5;

export default function ConfirmPasscodeScreen() {
  usePreventScreenCapture();
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.background === "#121212";
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ConfirmPageRouteProp>();
  const { firstPasscode } = route.params;
  const { userToken, savePasscodeValue } = useAuth();

  // useSignupActions() returns stable references — calling update()
  // will NOT cause this component to re-render.
  const { update } = useSignupActions();

  const [passcode, setPasscode] = useState("");
  const [errorStatus, setErrorStatus] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const isNavigatingRef = useRef(false);
  const inputRef = useRef<TextInput>(null);

  const scaleAnims = useRef([
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
  ]).current;

  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Reset navigation guard and clear passcode when screen regains focus
  // (e.g. user pressed back from Consent)
  useFocusEffect(
    useCallback(() => {
      isNavigatingRef.current = false;
      setPasscode("");
    }, [])
  );

  const startShake = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 50,
        useNativeDriver: true,
      }),
    ]).start();
  }, [shakeAnim]);

  const handleContinue = useCallback(async () => {
    if (isNavigatingRef.current || passcode.length !== 4 || isLocked) return;

    if (String(passcode).trim() === String(firstPasscode).trim()) {
      isNavigatingRef.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      isNavigatingRef.current = true;

      if (userToken) {
        try {
          await api.post('/api/v1/auth/passcode/set', { passcode });
          await savePasscodeValue(passcode);
          
          update({ passcode });
          navigation.reset({
            index: 0,
            routes: [{ name: "Consent" }],
          });
        } catch (e: unknown) {
          console.error("Passcode sync error:", e);
          setServerError("Failed to sync passcode. Please try again.");
          isNavigatingRef.current = false;
          setErrorStatus(true);
          startShake();
          setPasscode("");
        }
      } else {
        // Signup case: Not logged in yet, store in signup data.
        update({ passcode });
        navigation.reset({
          index: 0,
          routes: [{ name: "Consent" }],
        });
      }
    } else {
      const newCount = attemptCount + 1;
      setAttemptCount(newCount);
      if (newCount >= MAX_ATTEMPTS) {
        setIsLocked(true);
      }
      setErrorStatus(true);
      startShake();
      setPasscode("");
    }
  }, [passcode, firstPasscode, navigation, startShake, update, attemptCount, isLocked, userToken, savePasscodeValue]);

  // Keep a ref to the latest handleContinue so the auto-trigger effect
  // doesn't re-fire when handleContinue's identity changes.
  const handleContinueRef = useRef(handleContinue);
  handleContinueRef.current = handleContinue;

  useEffect(() => {
    if (isLocked) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, [isLocked]);

  // Automatic verification when 4 digits are entered.
  // Only depends on `passcode` — uses a ref for the callback to avoid
  // re-triggering when handleContinue's identity changes.
  useEffect(() => {
    if (passcode.length !== 4) return;

    const timer = setTimeout(() => {
      handleContinueRef.current();
    }, 300);

    return () => clearTimeout(timer);
  }, [passcode]);

  const handleTextChange = (text: string) => {
    if (isLocked) return;
    if (errorStatus) setErrorStatus(false);
    if (serverError) setServerError(null);

    const cleaned = text.replace(/[^0-9]/g, "").slice(0, 4);

    // Animate box if a new digit was added
    if (cleaned.length > passcode.length) {
      const index = cleaned.length - 1;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      Animated.sequence([
        Animated.timing(scaleAnims[index]!, {
          toValue: 1.15,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnims[index]!, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
    }

    setPasscode(cleaned);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor="transparent"
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.container}>
            <View style={styles.header}>
              <BackButton onPress={() => navigation.goBack()} size={28} />
            </View>

            <View style={styles.content}>
              <Text style={styles.title}>Confirm passcode</Text>
              <Text style={styles.subtitle}>
                Passcode should be 4 digits long
              </Text>

              {/* Hidden Input */}
              <TextInput
                ref={inputRef}
                value={passcode}
                onChangeText={handleTextChange}
                keyboardType="number-pad"
                maxLength={4}
                style={styles.hiddenInput}
                autoFocus={true}
              />

              <Animated.View
                style={[{ transform: [{ translateX: shakeAnim }] }]}
              >
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
                        <View
                          style={[styles.dot, errorStatus && styles.dotError]}
                        />
                      )}
                    </Animated.View>
                  ))}
                </TouchableOpacity>
              </Animated.View>

              {isLocked ? (
                <Text style={styles.errorText}>
                  Too many failed attempts. Please go back and start over.
                </Text>
              ) : serverError ? (
                <Text style={styles.errorText}>{serverError}</Text>
              ) : errorStatus ? (
                <Text style={styles.errorText}>
                  Passcodes do not match. {MAX_ATTEMPTS - attemptCount} attempt{MAX_ATTEMPTS - attemptCount === 1 ? "" : "s"} remaining.
                </Text>
              ) : null}
            </View>

            <View style={styles.footer}>
              <Button
                title="Continue"
                onPress={handleContinue}
                backgroundColor={
                  passcode.length === 4 && !isLocked
                    ? Colors.primary
                    : isDark
                      ? Colors.white10
                      : "#E5E7EB"
                }
                textColor={
                  passcode.length === 4 && !isLocked
                    ? Colors.secondary
                    : isDark
                      ? Colors.textSecondary
                      : "#9CA3AF"
                }
                disabled={passcode.length !== 4 || isLocked}
                borderRadius={Radius.sm}
                paddingVertical={16}
              />
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.background === "#121212";
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
      paddingVertical: Spacing.sm,
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: isDark ? Colors.white10 : "rgba(22, 51, 0, 0.04)",
      alignItems: "center",
      justifyContent: "center",
    },
    content: {
      flex: 1,
      alignItems: "center",
      paddingTop: Spacing.xl,
    },
    title: {
      fontSize: 34,
      fontWeight: "700",
      color: Colors.textPrimary,
      marginBottom: Spacing.xs,
    },
    subtitle: {
      fontSize: 16,
      color: Colors.textSecondary,
      marginBottom: Spacing.xl * 2,
    },
    hiddenInput: {
      position: "absolute",
      width: 0,
      height: 0,
      opacity: 0,
    },
    passcodeContainer: {
      flexDirection: "row",
      gap: 12,
    },
    passcodeBox: {
      width: 60,
      height: 60,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Colors.border,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: Colors.surface,
    },
    passcodeBoxActive: {
      borderColor: Colors.primary,
    },
    passcodeBoxError: {
      borderColor: Colors.error,
    },
    dot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: Colors.textPrimary,
    },
    dotError: {
      backgroundColor: Colors.error,
    },
    errorText: {
      color: Colors.error,
      marginTop: Spacing.md,
      fontSize: 14,
      fontWeight: "500",
    },
    footer: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.xl,
    },
  });
}
