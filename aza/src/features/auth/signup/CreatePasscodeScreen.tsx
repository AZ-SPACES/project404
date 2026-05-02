import React, { useState, useEffect, useRef, useCallback } from "react";
import { View,Text,StyleSheet,TouchableOpacity,Animated,TextInput,TouchableWithoutFeedback,Keyboard,KeyboardAvoidingView,Platform,StatusBar, } from "react-native";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
import { usePreventScreenCapture } from "../../../hooks/usePreventScreenCapture";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {  useAppTheme, ThemeColors, Spacing, Radius } from "../../../theme";
import { SafeAreaView } from "react-native-safe-area-context";
import Button from "../../../components/ui/Button";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "CreatePasscode">;

export default function CreatePasscodeScreen() {
  usePreventScreenCapture();
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();
  const [passcode, setPasscode] = useState("");
  const [errorStatus, setErrorStatus] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isNavigating, setIsNavigating] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<TextInput>(null);
  
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

  const validatePasscode = (code: string) => {
    // 1. All same (1111, 2222, etc.)
    const allSame = code[0] === code[1] && code[1] === code[2] && code[2] === code[3];
    if (allSame) return "Please choose a more complex passcode.";

    // 2. Sequential (1234, 4321, 0123, 6789, etc.)
    const isSequentialForward = "0123456789".includes(code);
    const isSequentialBackward = "9876543210".includes(code);
    if (isSequentialForward || isSequentialBackward) return "Passcodes cannot be common sequences.";
    
    // 3. Three or more of the same digit (e.g. 1112, 1211, 2111)
    const counts: Record<string, number> = {};
    for (const char of code) {
      counts[char] = (counts[char] || 0) + 1;
      if (counts[char]! >= 3) return "Please choose a more complex passcode.";
    }

    // 4. Simple patterns (1212, 1122, 2211)
    const isAlternating = code[0] === code[2] && code[1] === code[3];
    const isTwoPairs = code[0] === code[1] && code[2] === code[3];
    if (isAlternating || isTwoPairs) return "Please choose a more complex passcode.";

    return null;
  };

  // Stable navigation callback
  const handleContinue = useCallback(() => {
    if (isNavigating) return;
    
    if (passcode.length === 4) {
      const error = validatePasscode(passcode);
      if (error) {
        setErrorMessage(error);
        setErrorStatus(true);
        startShake();
        setPasscode("");
        return;
      }
      
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      setIsNavigating(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.navigate("ConfirmPasscode", { firstPasscode: passcode });
      
      // Reset navigation flag after a short delay
      setTimeout(() => setIsNavigating(false), 1000);
    }
  }, [passcode, navigation, startShake, isNavigating]);

  useEffect(() => {
    // Focus keyboard on mount
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  // Automatic Navigation when 4 digits are entered
  useEffect(() => {
    if (passcode.length === 4) {
      // Small delay for visual confirmation of the last digit
      timerRef.current = setTimeout(() => {
        handleContinue();
      }, 300);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [passcode, handleContinue]);

  const handleTextChange = (text: string) => {
    if (errorStatus) {
      setErrorStatus(false);
      setErrorMessage("");
    }
    
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
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" />
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.container}>
            <View style={styles.header}>
              <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                <MaterialIcons name="chevron-left" size={28} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.content}>
              <Text style={styles.title}>Create passcode</Text>
              <Text style={styles.subtitle}>Passcode should be 4 digits long</Text>

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

              {/* Passcode Visualizer (Tappable to focus keyboard) */}
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
                        { transform: [{ scale: scaleAnims[i]! }] }
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
                  {errorMessage}
                </Text>
              )}
            </View>

            <View style={styles.footer}>
              <Button
                title="Continue"
                onPress={handleContinue}
                backgroundColor={passcode.length === 4 ? Colors.primary : isDark ? Colors.white10 : "#E5E7EB"}
                textColor={passcode.length === 4 ? Colors.secondary : isDark ? Colors.textSecondary : "#9CA3AF"}
                disabled={passcode.length !== 4}
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
    position: 'absolute',
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
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
});
}


