import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  TextInputKeyPressEvent,
  Animated,
  Image,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { useAppTheme, ThemeColors, Typography, Spacing } from "../../../theme";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../navigation/types";
import { useAuth } from "../../../providers/AuthProvider";

type SendPinScreenProps = NativeStackScreenProps<RootStackParamList, "SendPin">;

const PIN_LENGTH = 4;
const PIN_ARRAY = Array.from({ length: PIN_LENGTH });

export default function SendPinScreen({
  navigation,
  route,
}: SendPinScreenProps) {
  const { name, amount } = route.params;
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const { verifyPasscode } = useAuth();
  const [pin, setPin] = useState<string>("");
  const [errorStatus, setErrorStatus] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const scaleAnims = useRef(PIN_ARRAY.map(() => new Animated.Value(1))).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const displayAmount = useMemo(() => amount.toFixed(2), [amount]);

  const startShake = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  // Focus keyboard on mount
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleCompletePin = useCallback(
    async (enteredPin: string) => {
      const isValid = await verifyPasscode(enteredPin);
      if (isValid) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        navigation.replace("SendSuccess", route.params);
      } else {
        setErrorStatus(true);
        startShake();
        setPin("");
      }
    },
    [navigation, route.params, verifyPasscode, startShake],
  );

  // Auto-submit when PIN is fully entered
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (pin.length === PIN_LENGTH) {
      // Small delay for visual confirmation of the last digit
      timer = setTimeout(() => {
        handleCompletePin(pin);
      }, 300);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [pin, handleCompletePin]);

  const handleTextChange = useCallback(
    (text: string) => {
      if (errorStatus) setErrorStatus(false);
      // Only allow numbers and max length of 4
      const cleaned = text.replace(/[^0-9]/g, "").slice(0, PIN_LENGTH);

      // Animate box and vibrate if a new digit was added
      if (cleaned.length > pin.length) {
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

      setPin(cleaned);
    },
    [pin.length, scaleAnims],
  );

  const renderSquares = () => {
    return (
      <View>
        <TextInput
          ref={inputRef}
          value={pin}
          onChangeText={handleTextChange}
          keyboardType="number-pad"
          maxLength={PIN_LENGTH}
          style={styles.hiddenInput}
          autoFocus={true}
          secureTextEntry={true}
          autoCorrect={false}
          autoComplete="off"
          textContentType="none"
          importantForAutofill="no"
          contextMenuHidden={true}
        />

        <TouchableOpacity
          activeOpacity={1}
          style={styles.squaresContainer}
          onPress={() => inputRef.current?.focus()}
        >
          {PIN_ARRAY.map((_, index) => {
            const isFilled = pin.length > index;
            const isCurrent = pin.length === index; // The square currently awaiting input
            return (
              <Animated.View
                key={index}
                style={[
                  styles.square,
                  isFilled && styles.squareFilled,
                  isCurrent && styles.squareCurrent, // Give interactive feedback for current square
                  { transform: [{ scale: scaleAnims[index]! }] },
                ]}
              >
                {isFilled ? (
                  <View style={styles.dot} />
                ) : isCurrent ? (
                  <View style={styles.cursor} />
                ) : null}
              </Animated.View>
            );
          })}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather
                name="chevron-left"
                size={24}
                color={Colors.textPrimary}
                style={styles.backicon}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <Image
              source={require("../../../assets/aza-z.png")}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>Enter your PIN</Text>
            <Text style={styles.subtitle}>
              To send <Text style={styles.amountText}>GH¢ {displayAmount}</Text>{" "}
              to {name}
            </Text>

            {renderSquares()}
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.background === "#121212";
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? Colors.background : Colors.surface, // Adapts to theme
    },
    flex: {
      flex: 1,
    },
    header: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 50,
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    backicon: {
      fontSize: 28,
      color: Colors.textPrimary,
    },
    content: {
      flex: 1,
      paddingHorizontal: Spacing.lg,
      alignItems: "center",
      paddingTop: Spacing.xl,
      paddingBottom: Spacing.xl * 2,
    },
    logo: {
      width: 64,
      height: 64,
      marginBottom: Spacing.md,
    },
    title: {
      ...Typography.h2,
      fontWeight: "700",
      color: Colors.textPrimary,
      marginBottom: Spacing.xs,
    },
    subtitle: {
      ...Typography.body,
      color: Colors.textSecondary,
      textAlign: "center",
      marginBottom: 40,
    },
    amountText: {
      fontWeight: "700",
      color: Colors.textPrimary,
    },

    // Squares API
    squaresContainer: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 16,
    },
    square: {
      width: 56,
      height: 56,
      borderRadius: 12,
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.border,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden", // to ensure TextInput perfectly fits corners if needed
    },
    squareFilled: {
      borderColor: Colors.primary,
    },
    squareCurrent: {
      borderColor: Colors.primary,
    },
    hiddenInput: {
      position: "absolute",
      width: 0,
      height: 0,
      opacity: 0,
    },
    cursor: {
      width: 2,
      height: 24,
      backgroundColor: Colors.primary,
    },
    dot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: Colors.textPrimary,
    },
  });
}
