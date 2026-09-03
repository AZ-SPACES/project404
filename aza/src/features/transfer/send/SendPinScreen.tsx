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
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Animated,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Feather } from '@react-native-vector-icons/feather';
import { useAppTheme, ThemeColors, Typography, Spacing } from "../../../theme";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../navigation/types";
import { usePreventScreenCapture } from "../../../hooks/usePreventScreenCapture";
import { useTransferStore } from "../../../store/transferStore";
import { BackButton } from '../../../components/ui/BackButton';
import { classifyFailure, failureCopy, type Failure } from './transferFailure';
import Button from '../../../components/ui/Button';
import { useShallow } from 'zustand/react/shallow';

type SendPinScreenProps = NativeStackScreenProps<RootStackParamList, "SendPin">;

const PIN_LENGTH = 4;
const PIN_ARRAY = Array.from({ length: PIN_LENGTH });

export default function SendPinScreen({
  navigation,
  route,
}: SendPinScreenProps) {
  const { name, amount, id } = route.params;
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const { confirmTransfer, cancelPendingTransfer, pendingTransactionId } = useTransferStore(
    useShallow((s) => ({
      confirmTransfer: s.confirmTransfer,
      cancelPendingTransfer: s.cancelPendingTransfer,
      pendingTransactionId: s.pendingTransactionId,
    })),
  );
  usePreventScreenCapture();

  const [pin, setPin] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Set only for failures the keypad cannot fix — see classifyFailure.
  const [failure, setFailure] = useState<Failure | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const scaleAnims = useRef(PIN_ARRAY.map(() => new Animated.Value(1))).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const displayAmount = useMemo(() => amount.toFixed(2), [amount]);

  // Set the store's pendingTransactionId if we navigated with a specific transaction ID
  useEffect(() => {
    if (id) {
      useTransferStore.setState({ pendingTransactionId: id });
    }
  }, [id]);

  // If the user somehow got here without a pending transaction, go back
  useEffect(() => {
    if (id && !pendingTransactionId) return;
    if (!pendingTransactionId) {
      navigation.goBack();
    }
  }, [pendingTransactionId, navigation, id]);

  // Focus keyboard on mount
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  const startShake = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const handleCompletePin = useCallback(
    async (enteredPin: string) => {
      if (!pendingTransactionId) return;
      setIsVerifying(true);
      setErrorMsg(null);
      try {
        const txStatus = await confirmTransfer(pendingTransactionId, enteredPin);
        // A held transfer is not a completed one: warn rather than celebrate, and hand
        // the status to the outcome screen so it opens as "Under Review" instead of
        // flashing "Payment Sent" until the receipt query catches up.
        const held = txStatus === "HELD_FOR_REVIEW";
        Haptics.notificationAsync(
          held
            ? Haptics.NotificationFeedbackType.Warning
            : Haptics.NotificationFeedbackType.Success,
        );
        navigation.replace("SendSuccess", {
          ...route.params,
          transactionId: pendingTransactionId,
          ...(txStatus ? { status: txStatus } : {}),
        });
      } catch (err: unknown) {
        startShake();
        setPin("");
        const classified = classifyFailure(err);
        if (classified.kind === "pin") {
          setFailure(null);
          setErrorMsg("Incorrect PIN. Try again.");
        } else {
          // Nothing the keypad can do about these, so stop pretending otherwise.
          setErrorMsg(null);
          setFailure(classified);
        }
      } finally {
        setIsVerifying(false);
      }
    },
    [pendingTransactionId, confirmTransfer, navigation, route.params, startShake],
  );

  // Auto-submit when PIN fully entered
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

  // Cancel the pending transfer if user navigates away
  const handleBack = useCallback(() => {
    cancelPendingTransfer();
    navigation.goBack();
  }, [cancelPendingTransfer, navigation]);

  /**
   * Back to the keypad with a clean slate. The pending transaction is deliberately left
   * alone: confirming it again is how the retry works, and the server returns the
   * existing outcome rather than sending a second time.
   */
  const handleRetry = useCallback(() => {
    setFailure(null);
    setErrorMsg(null);
    setPin("");
    inputRef.current?.focus();
  }, []);

  const renderSquares = () => (
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
  );

  return (
    <SafeAreaView style={styles.container}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.header}>
            <BackButton onPress={handleBack} />
          </View>

          {failure ? (
            <View style={styles.content}>
              <View style={styles.failureIcon}>
                <Feather
                  name={failure.kind === "offline" ? "wifi-off" : "alert-triangle"}
                  size={26}
                  color={Colors.error}
                />
              </View>
              <Text style={styles.title}>{failureCopy(failure).title}</Text>
              <Text style={styles.failureBody}>{failureCopy(failure).body}</Text>
              {failureCopy(failure).note ? (
                <Text style={styles.failureNote}>{failureCopy(failure).note}</Text>
              ) : null}

              <View style={styles.failureActions}>
                <Button
                  title="Try again"
                  onPress={handleRetry}
                  backgroundColor={Colors.primary}
                  textColor="#FFFFFF"
                  borderRadius={12}
                  paddingVertical={14}
                  fontWeight="600"
                  activeOpacity={0.85}
                />
                <Button
                  title="Not now"
                  onPress={handleBack}
                  backgroundColor="transparent"
                  paddingVertical={Spacing.md}
                  fontWeight="600"
                  textStyle={{ color: Colors.textSecondary }}
                  activeOpacity={0.7}
                />
              </View>
            </View>
          ) : (
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

              {isVerifying ? (
                <Text style={styles.verifyingText}>Verifying…</Text>
              ) : errorMsg ? (
                <Text style={styles.errorText}>{errorMsg}</Text>
              ) : null}
            </View>
          )}
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? Colors.background : Colors.surface,
    },
    flex: { flex: 1 },
    header: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    backicon: { fontSize: 28, color: Colors.textPrimary },
    content: {
      flex: 1,
      paddingHorizontal: Spacing.lg,
      alignItems: "center",
      paddingTop: Spacing.xl,
      paddingBottom: Spacing.xl * 2,
    },
    logo: { width: 64, height: 64, marginBottom: Spacing.md },
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
    amountText: { fontWeight: "700", color: Colors.textPrimary },
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
      overflow: "hidden",
    },
    squareFilled: { borderColor: Colors.primary },
    squareCurrent: { borderColor: Colors.primary },
    hiddenInput: { position: "absolute", width: 0, height: 0, opacity: 0 },
    cursor: { width: 2, height: 24, backgroundColor: Colors.primary },
    dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.textPrimary },
    verifyingText: { marginTop: 20, fontSize: 14, color: Colors.textSecondary, textAlign: "center" },
    errorText: { marginTop: 20, fontSize: 14, color: Colors.error, textAlign: "center" },
    failureIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: Colors.error + (isDark ? "26" : "1A"),
      marginBottom: Spacing.md,
    },
    failureBody: {
      ...Typography.body,
      color: Colors.textSecondary,
      textAlign: "center",
      marginTop: Spacing.xs,
    },
    failureNote: {
      ...Typography.caption,
      color: Colors.textSecondary,
      textAlign: "center",
      marginTop: Spacing.sm,
    },
    failureActions: {
      alignSelf: "stretch",
      marginTop: Spacing.xl,
      gap: Spacing.xs,
    },
  });
}
