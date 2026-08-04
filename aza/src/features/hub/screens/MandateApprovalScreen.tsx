import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  TouchableOpacity,
  Keyboard,
  Animated,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Feather } from "@react-native-vector-icons/feather";
import { useAppTheme, ThemeColors, Typography, Spacing } from "../../../theme";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../navigation/types";
import { usePreventScreenCapture } from "../../../hooks/usePreventScreenCapture";
import { confirmMandate } from "../../../services/api";
import { BackButton } from "../../../components/ui/BackButton";
import { extractErrorMessage } from "../../../utils/errorUtils";

type MandateApprovalScreenProps = NativeStackScreenProps<RootStackParamList, "MandateApproval">;

const PIN_LENGTH = 4;
const PIN_ARRAY = Array.from({ length: PIN_LENGTH });

function fmtGHS(n: number) {
  return `GH₵ ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function cadenceLabel(periodType?: string) {
  switch (periodType) {
    case "DAILY": return "day";
    case "WEEKLY": return "week";
    case "MONTHLY": return "month";
    default: return null;
  }
}

export default function MandateApprovalScreen({ navigation, route }: MandateApprovalScreenProps) {
  const {
    mandateId, merchantName, appName, perChargeLimit, periodLimit, periodType,
    reference, onApproved, onDeclined,
  } = route.params;
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  usePreventScreenCapture();

  const [step, setStep] = useState<"review" | "pin">("review");
  const [pin, setPin] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const scaleAnims = useRef(PIN_ARRAY.map(() => new Animated.Value(1))).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (step !== "pin") return;
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, [step]);

  const startShake = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const handleDecline = useCallback(() => {
    onDeclined();
    navigation.goBack();
  }, [onDeclined, navigation]);

  const handleCompletePin = useCallback(
    async (enteredPin: string) => {
      setIsVerifying(true);
      setErrorMsg(null);
      try {
        const res = await confirmMandate(mandateId, enteredPin);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onApproved(res.data?.data);
        navigation.goBack();
      } catch (err: unknown) {
        startShake();
        setPin("");
        const msg = extractErrorMessage(err, "Could not approve mandate. Please try again.");
        const isWrongPin =
          msg.toLowerCase().includes("passcode") || msg.toLowerCase().includes("invalid");
        setErrorMsg(isWrongPin ? "Incorrect PIN. Try again." : msg);
      } finally {
        setIsVerifying(false);
      }
    },
    [mandateId, onApproved, navigation, startShake],
  );

  useEffect(() => {
    if (pin.length !== PIN_LENGTH) return;
    const timer = setTimeout(() => handleCompletePin(pin), 300);
    return () => clearTimeout(timer);
  }, [pin, handleCompletePin]);

  const handleTextChange = useCallback(
    (text: string) => {
      if (isVerifying) return;
      if (errorMsg) setErrorMsg(null);
      const cleaned = text.replace(/[^0-9]/g, "").slice(0, PIN_LENGTH);
      if (cleaned.length > pin.length) {
        const index = cleaned.length - 1;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Animated.sequence([
          Animated.timing(scaleAnims[index]!, { toValue: 1.15, duration: 100, useNativeDriver: true }),
          Animated.timing(scaleAnims[index]!, { toValue: 1, duration: 100, useNativeDriver: true }),
        ]).start();
      }
      setPin(cleaned);
    },
    [pin.length, scaleAnims, errorMsg, isVerifying],
  );

  const cadence = cadenceLabel(periodType);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <BackButton onPress={step === "pin" ? () => setStep("review") : handleDecline} />
      </View>

      {step === "review" ? (
        <View style={styles.reviewContent}>
          <Image source={require("../../../assets/aza-z.png")} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>Approve standing charge</Text>
          <Text style={styles.subtitle}>
            <Text style={styles.emphasis}>{appName}</Text> wants {merchantName} to be able to charge
            your wallet without asking you again each time.
          </Text>

          <View style={styles.termsCard}>
            <View style={styles.termRow}>
              <Text style={styles.termLabel}>Per charge, up to</Text>
              <Text style={styles.termValue}>{fmtGHS(perChargeLimit)}</Text>
            </View>
            {periodLimit != null && cadence && (
              <View style={styles.termRow}>
                <Text style={styles.termLabel}>Per {cadence}, up to</Text>
                <Text style={styles.termValue}>{fmtGHS(periodLimit)}</Text>
              </View>
            )}
            <View style={styles.termRow}>
              <Text style={styles.termLabel}>Merchant</Text>
              <Text style={styles.termValue}>{merchantName}</Text>
            </View>
            {reference ? (
              <View style={styles.termRow}>
                <Text style={styles.termLabel}>For</Text>
                <Text style={styles.termValue}>{reference}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.noteRow}>
            <Feather name="shield" size={14} color={Colors.textSecondary} />
            <Text style={styles.noteText}>
              You can pause or cancel this anytime in Security & Privacy → Payment Mandates.
              {merchantName} can never charge more than the limits above.
            </Text>
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={() => setStep("pin")}>
            <Text style={styles.primaryButtonText}>Continue</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.declineButton} onPress={handleDecline}>
            <Text style={styles.declineButtonText}>Don't allow</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <Animated.View style={[styles.content, { transform: [{ translateX: shakeAnim }] }]}>
              <Text style={styles.title}>Enter your PIN</Text>
              <Text style={styles.subtitle}>
                To approve {merchantName} charging up to{" "}
                <Text style={styles.emphasis}>{fmtGHS(perChargeLimit)}</Text> at a time
              </Text>

              <View>
                <TextInput
                  underlineColorAndroid="transparent"
                  ref={inputRef}
                  value={pin}
                  onChangeText={handleTextChange}
                  keyboardType="number-pad"
                  maxLength={PIN_LENGTH}
                  style={styles.hiddenInput}
                  autoFocus
                  secureTextEntry
                  autoCorrect={false}
                  autoComplete="off"
                  textContentType="none"
                  importantForAutofill="no"
                  contextMenuHidden
                />
                <TouchableOpacity
                  activeOpacity={1}
                  style={styles.squaresContainer}
                  onPress={() => inputRef.current?.focus()}
                >
                  {PIN_ARRAY.map((_, index) => {
                    const isFilled = pin.length > index;
                    const isCurrent = pin.length === index;
                    return (
                      <Animated.View
                        key={index}
                        style={[
                          styles.square,
                          isFilled && styles.squareFilled,
                          isCurrent && styles.squareCurrent,
                          { transform: [{ scale: scaleAnims[index]! }] },
                        ]}
                      >
                        {isFilled ? <View style={styles.dot} /> : isCurrent ? <View style={styles.cursor} /> : null}
                      </Animated.View>
                    );
                  })}
                </TouchableOpacity>
              </View>

              {isVerifying ? (
                <Text style={styles.verifyingText}>Verifying…</Text>
              ) : errorMsg ? (
                <Text style={styles.errorText}>{errorMsg}</Text>
              ) : null}
            </Animated.View>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      )}
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: isDark ? Colors.background : Colors.surface },
    flex: { flex: 1 },
    header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
    reviewContent: { flex: 1, paddingHorizontal: Spacing.lg, alignItems: "center", paddingTop: Spacing.md },
    content: { flex: 1, paddingHorizontal: Spacing.lg, alignItems: "center", paddingTop: Spacing.xl, paddingBottom: Spacing.xl * 2 },
    logo: { width: 56, height: 56, marginBottom: Spacing.md },
    title: { ...Typography.h2, fontWeight: "700", color: Colors.textPrimary, marginBottom: Spacing.xs, textAlign: "center" },
    subtitle: { ...Typography.body, color: Colors.textSecondary, textAlign: "center", marginBottom: Spacing.lg },
    emphasis: { fontWeight: "700", color: Colors.textPrimary },
    termsCard: {
      width: "100%",
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: 16,
      padding: Spacing.md,
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    termRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    termLabel: { ...Typography.body, color: Colors.textSecondary, fontSize: 13 },
    termValue: { ...Typography.body, color: Colors.textPrimary, fontWeight: "600", fontSize: 13 },
    noteRow: { flexDirection: "row", gap: Spacing.xs, alignItems: "flex-start", marginBottom: Spacing.xl },
    noteText: { ...Typography.body, color: Colors.textSecondary, fontSize: 12, flex: 1, lineHeight: 17 },
    primaryButton: {
      width: "100%",
      backgroundColor: Colors.primary,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
      marginBottom: Spacing.sm,
    },
    primaryButtonText: { ...Typography.body, fontWeight: "700", color: isDark ? Colors.background : "#fff" },
    declineButton: { width: "100%", paddingVertical: 12, alignItems: "center" },
    declineButtonText: { ...Typography.body, color: Colors.textSecondary, fontWeight: "600" },
    squaresContainer: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 16 },
    square: {
      width: 56, height: 56, borderRadius: 12, backgroundColor: Colors.surface,
      borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center", overflow: "hidden",
    },
    squareFilled: { borderColor: Colors.primary },
    squareCurrent: { borderColor: Colors.primary },
    hiddenInput: { position: "absolute", width: 0, height: 0, opacity: 0 },
    cursor: { width: 2, height: 24, backgroundColor: Colors.primary },
    dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.textPrimary },
    verifyingText: { marginTop: 20, fontSize: 14, color: Colors.textSecondary, textAlign: "center" },
    errorText: { marginTop: 20, fontSize: 14, color: Colors.error, textAlign: "center" },
  });
}
