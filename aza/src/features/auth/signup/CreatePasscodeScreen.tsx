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
import { useNavigation, } from "@react-navigation/native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors, Typography, Spacing, } from "../../../theme";
import { SafeAreaView } from "react-native-safe-area-context";
import Button from "../../../components/ui/Button";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "CreatePasscode">;

export default function CreatePasscodeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [passcode, setPasscode] = useState("");
  const inputRef = useRef<TextInput>(null);
  const scaleAnims = useRef([
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
  ]).current;

  // Stable navigation callback
  const handleContinue = useCallback(() => {
    if (passcode.length === 4) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.navigate("ConfirmPasscode", { firstPasscode: passcode });
    }
  }, [passcode, navigation]);

  useEffect(() => {
    // Focus keyboard on mount
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  // Automatic Navigation when 4 digits are entered
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
                      { transform: [{ scale: scaleAnims[i]! }] }
                    ]}
                  >
                    {passcode.length > i && (
                      <View style={styles.dot} />
                    )}
                  </Animated.View>
                ))}
              </TouchableOpacity>
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
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.textPrimary,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
});
