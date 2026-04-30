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
import { usePreventScreenCapture } from "../../../hooks/usePreventScreenCapture";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useAppTheme, ThemeColors, Spacing } from "../../../theme";
import Button from "../../../components/ui/Button";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";
import { useAuth } from "../../../providers/AuthProvider";
import { useSignUp } from "../../../providers/SignUpProvider";
import { api } from "../../../services/api";

type NavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "ConfirmPasscode"
>;
type ConfirmPageRouteProp = RouteProp<RootStackParamList, "ConfirmPasscode">;

export default function ConfirmPasscodeScreen() {
  usePreventScreenCapture();
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.background === "#121212";
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ConfirmPageRouteProp>();
  const { firstPasscode } = route.params;
  const { userToken, savePasscodeValue } = useAuth();
  const { update } = useSignUp();

  const [passcode, setPasscode] = useState("");
  const [errorStatus, setErrorStatus] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const isNavigatingRef = useRef(false);
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (userToken) {
        // Standalone case: Already logged in, set passcode via API
        try {
          isNavigatingRef.current = true;
          await api.post('/api/v1/auth/passcode/set', { passcode });
          await savePasscodeValue(passcode);
          navigation.navigate("Consent");
        } catch (e: any) {
          isNavigatingRef.current = false;
          setServerError(e?.response?.data?.message || "Failed to set passcode. Please try again.");
          setPasscode("");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      } else if (update) {
        // Signup case: Not logged in yet, store in signup data
        isNavigatingRef.current = true;
        update({ passcode });
        navigation.navigate("Consent");
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

  useEffect(() => {
    if (isLocked) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, [isLocked]);

  // Automatic verification when 4 digits are entered
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (passcode.length === 4) {
      // Small delay for visual confirmation of the last digit
      timer = setTimeout(() => {
        handleContinue();
      }, 300);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [passcode, handleContinue]);

  const handleTextChange = (text: string) => {
    if (isLocked) return;
    if (errorStatus) setErrorStatus(false);
    if (serverError) setServerError(null);

    // Only allow numbers and max length of 4
    const cleaned = text.replace(/[^0-9]/g, "").slice(0, 4);

    // Animate box if a new digit was added
    if (cleaned.length > passcode.length) {
      const index = cleaned.length - 1;

      // Haptic feedback for each tap
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
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}
              >
                <MaterialIcons
                  name="chevron-left"
                  size={28}
                  color={Colors.textPrimary}
                />
              </TouchableOpacity>
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
                borderRadius={30}
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
