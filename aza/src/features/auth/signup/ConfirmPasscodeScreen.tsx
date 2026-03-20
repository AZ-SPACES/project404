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
} from "react-native";
import * as Haptics from "expo-haptics";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors, Spacing, } from "../../../theme";
import Button from "../../../components/ui/Button";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ConfirmPageRouteProp = RouteProp<RootStackParamList, "ConfirmPasscode">;

export default function ConfirmPasscodeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ConfirmPageRouteProp>();
  const { firstPasscode } = route.params;

  const [passcode, setPasscode] = useState("");
  const [errorStatus, setErrorStatus] = useState(false);
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

  const handleContinue = useCallback(() => {
    if (passcode.length === 4) {
      if (passcode === firstPasscode) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        navigation.navigate("EnableNotification");
      } else {
        setErrorStatus(true);
        startShake();
        setPasscode("");
      }
    }
  }, [passcode, firstPasscode, navigation, startShake]);

  useEffect(() => {
    // Focus keyboard on mount
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

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
    if (errorStatus) {
      setErrorStatus(false);
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
              <Text style={styles.title}>Confirm passcode</Text>
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
                <Text style={styles.errorText}>Passcodes do not match. Try again.</Text>
              )}
            </View>

            <View style={styles.footer}>
              <Button
                title="Continue"
                onPress={handleContinue}
                backgroundColor={passcode.length === 4 ? Colors.primary : "#E5E7EB"}
                textColor={passcode.length === 4 ? Colors.secondary : "#9CA3AF"}
                disabled={passcode.length !== 4}
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

const styles = StyleSheet.create({
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
    backgroundColor: "rgba(0,0,0,0.05)",
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
    backgroundColor: "#fff",
  },
  passcodeBoxActive: {
    borderColor: Colors.primary,
  },
  passcodeBoxError: {
    borderColor: "#DC2626",
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.textPrimary,
  },
  dotError: {
    backgroundColor: "#DC2626",
  },
  errorText: {
    color: "#DC2626",
    marginTop: Spacing.md,
    fontSize: 14,
    fontWeight: "500",
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
});
