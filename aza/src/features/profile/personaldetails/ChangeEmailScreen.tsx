import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from '@react-native-vector-icons/feather';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from "../../../theme";
import Button from "../../../components/ui/Button";
import { useProfile } from "../../../providers/ProfileProvider";
import { useToast } from "../../../providers/ToastProvider";
import { isValidEmail } from "../../../utils/validation";
import { BackButton } from '../../../components/ui/BackButton';
import { extractErrorMessage } from '../../../utils/errorUtils';

type NavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "ChangeEmail"
>;

export function ChangeEmailScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();
  const { email, requestEmailChange, verifyEmailChange } = useProfile();
  const { showToast } = useToast();
  
  const [newEmail, setNewEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"input" | "verify">("input");
  const [isSaving, setIsSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  const scrollY = React.useRef(new Animated.Value(0)).current;

  const emailError = touched && newEmail.length > 0 && !isValidEmail(newEmail)
    ? "Enter a valid email address"
    : null;
  
  const isInputValid = isValidEmail(newEmail) && newEmail !== email;
  const isOtpValid = otp.length === 6;

  const handleNext = async () => {
    setIsSaving(true);
    try {
      if (step === "input") {
        await requestEmailChange(newEmail.trim());
        setStep("verify");
        showToast('Verification code sent to ' + newEmail, 'success');
      } else {
        await verifyEmailChange(newEmail.trim(), otp);
        showToast('Email address updated successfully', 'success');
        navigation.goBack();
      }
    } catch (e: unknown) {
      const errorMsg = extractErrorMessage(e, 'Something went wrong. Please try again.');
      showToast(errorMsg, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" />

      <Animated.View
        style={[
          styles.header,
          {
            borderBottomColor: scrollY.interpolate({
              inputRange: [40, 70],
              outputRange: ["transparent", Colors.border],
              extrapolate: "clamp"
            })
          },
        ]}
      >
        <BackButton onPress={() => step === "verify" ? setStep("input") : navigation.goBack()} />
        <Animated.View
          style={[styles.headerTitleContainer, { 
            opacity: scrollY.interpolate({
              inputRange: [40, 70],
              outputRange: [0, 1],
              extrapolate: "clamp"
            })
          }]}
        >
          <Text style={[Typography.h3, styles.headerTitle]}>
            {step === "input" ? "Change email" : "Verify email"}
          </Text>
        </Animated.View>
        <View style={{ width: 40 }} />
      </Animated.View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <Animated.ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}
        >
          <View style={styles.titleSection}>
            <Text style={[Typography.h1, styles.mainTitle]}>
              {step === "input" ? "Change email" : "Enter code"}
            </Text>
          </View>

          {step === "input" ? (
            <>
              <Text style={styles.subtitle}>
                Enter the email address you'd like to use with your account. We'll send a verification code to ensure it belongs to you.
              </Text>

              <View style={styles.inputSection}>
                <Text style={styles.label}>New email address</Text>
                <View style={[styles.inputContainer, emailError ? { borderColor: '#D1222E' } : null]}>
                  <TextInput
                    style={styles.input}
                    value={newEmail}
                    onChangeText={setNewEmail}
                    onBlur={() => setTouched(true)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholder="email@example.com"
                    placeholderTextColor={Colors.textSecondary + "80"}
                    autoFocus
                  />
                </View>
                {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
              </View>

              <View style={styles.noticeBox}>
                <MaterialIcons name="info-outline" size={20} color={Colors.textSecondary} style={{ marginTop: 2 }} />
                <Text style={styles.noticeText}>
                  Your current email: <Text style={{ fontWeight: '600' }}>{email}</Text>
                </Text>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.subtitle}>
                We've sent a 6-digit verification code to <Text style={{ color: Colors.textPrimary, fontWeight: '600' }}>{newEmail}</Text>.
              </Text>

              <View style={styles.inputSection}>
                <Text style={styles.label}>Verification code</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={[styles.input, { letterSpacing: 8, fontSize: 24, textAlign: 'center', fontWeight: '700' }]}
                    value={otp}
                    onChangeText={(val) => setOtp(val.replace(/[^0-9]/g, "").slice(0, 6))}
                    keyboardType="number-pad"
                    placeholder="000000"
                    placeholderTextColor={Colors.textSecondary + "40"}
                    autoFocus
                    maxLength={6}
                  />
                </View>
              </View>

              <TouchableOpacity 
                style={{ paddingHorizontal: Spacing.lg, marginTop: Spacing.sm }}
                onPress={() => requestEmailChange(newEmail.trim())}
              >
                <Text style={[Typography.body, { color: Colors.primary, fontWeight: '600' }]}>
                  Resend code
                </Text>
              </TouchableOpacity>
            </>
          )}
        </Animated.ScrollView>

        <View style={styles.footer}>
          <Button
            title={step === "input" ? "Continue" : "Verify and change"}
            onPress={handleNext}
            backgroundColor={(step === "input" ? isInputValid : isOtpValid) ? Colors.primary : Colors.surface}
            textColor={(step === "input" ? isInputValid : isOtpValid) ? Colors.secondary : Colors.textSecondary}
            borderRadius={Radius.full}
            disabled={!(step === "input" ? isInputValid : isOtpValid) || isSaving}
            loading={isSaving}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    height: 60 },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1 },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center" },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textPrimary },
  titleSection: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.xl },
  mainTitle: {
    color: Colors.textPrimary,
    fontSize: 32,
    fontWeight: "700" },
  scrollContent: {
    paddingBottom: Spacing.xl },
  subtitle: {
    ...Typography.bodyLg,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    lineHeight: 22,
    paddingHorizontal: Spacing.lg },
  noticeText: {
    ...Typography.body,
    flex: 1,
    color: Colors.textSecondary,
    lineHeight: 20 },
  noticeBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: isDark ? Colors.surface : Colors.accent,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputSection: {
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg },
  label: {
    ...Typography.caption,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginBottom: 8 },
  inputContainer: {
    height: 52,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    flexDirection: "row",
    alignItems: "center" },
  input: {
    flex: 1,
    ...Typography.bodyLg,
    color: Colors.textPrimary },
  errorText: {
    fontSize: 12,
    color: '#D1222E',
    marginTop: 4 },
  readOnlyContainer: {
    backgroundColor: Colors.surface + "30",
    borderColor: Colors.border + "50" },
  readOnlyText: {
    ...Typography.body,
    color: Colors.border },
  footer: {
    padding: Spacing.lg,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border + "20" } });
}


