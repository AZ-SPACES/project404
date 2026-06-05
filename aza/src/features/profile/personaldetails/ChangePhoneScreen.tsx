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
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from "../../../theme";
import Button from "../../../components/ui/Button";
import { isValidPhone } from "../../../utils/validation";
import { useProfile } from "../../../providers/ProfileProvider";
import { useToast } from "../../../providers/ToastProvider";
import { BackButton } from '../../../components/ui/BackButton';
import { extractErrorMessage } from '../../../utils/errorUtils';

type NavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "ChangePhone"
>;

export function ChangePhoneScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();
  const { phone, requestPhoneChange, verifyPhoneChange } = useProfile();
  const { showToast } = useToast();
  
  const [phoneNumber, setPhoneNumber] = useState("");
  const [countryCode, setCountryCode] = useState("+233");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"input" | "verify">("input");
  const [touched, setTouched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const scrollY = React.useRef(new Animated.Value(0)).current;

  const phoneError = touched && phoneNumber.length > 0 && !isValidPhone(phoneNumber)
    ? "Enter a valid phone number"
    : null;
  
  const isInputValid = isValidPhone(phoneNumber);
  const isOtpValid = otp.length === 6;

  const handleNext = async () => {
    setIsLoading(true);
    try {
      const fullPhone = `${countryCode}${phoneNumber}`;
      if (step === "input") {
        await requestPhoneChange(fullPhone);
        setStep("verify");
        showToast('Verification code sent to ' + fullPhone, 'success');
      } else {
        await verifyPhoneChange(fullPhone, otp);
        showToast('Phone number updated successfully', 'success');
        navigation.goBack();
      }
    } catch (e: unknown) {
      const errorMsg = extractErrorMessage(e, 'Something went wrong. Please try again.');
      showToast(errorMsg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

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
            {step === "input" ? "Change phone" : "Verify phone"}
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
              {step === "input" ? "Change phone" : "Enter code"}
            </Text>
          </View>

          {step === "input" ? (
            <>
              <Text style={styles.subtitle}>
                We'll text a verification code to your new number to confirm it.
              </Text>

              <View style={styles.inputSection}>
                <Text style={styles.label}>New phone number</Text>
                <View style={styles.row}>
                  <TouchableOpacity style={styles.countryPicker}>
                    <Text style={styles.countryCode}>{countryCode}</Text>
                    <Feather
                      name="chevron-down"
                      size={16}
                      color={Colors.textPrimary}
                    />
                  </TouchableOpacity>
                  <View style={styles.phoneInputContainer}>
                    <TextInput
                      underlineColorAndroid="transparent"
                      style={styles.input}
                      value={phoneNumber}
                      onChangeText={setPhoneNumber}
                      onBlur={() => setTouched(true)}
                      keyboardType="phone-pad"
                      placeholder="XXXXXXXXX"
                      placeholderTextColor={Colors.textSecondary + "80"}
                      autoFocus
                    />
                  </View>
                </View>
                {phoneError ? <Text style={styles.errorText}>{phoneError}</Text> : null}
              </View>
            </>
          ) : (
            <>
              <Text style={styles.subtitle}>
                We've sent a 6-digit verification code to <Text style={{ color: Colors.textPrimary, fontWeight: '600' }}>{countryCode}{phoneNumber}</Text>.
              </Text>

              <View style={styles.inputSection}>
                <Text style={styles.label}>Verification code</Text>
                <View style={styles.phoneInputContainer}>
                  <TextInput
                    underlineColorAndroid="transparent"
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
                onPress={() => requestPhoneChange(`${countryCode}${phoneNumber}`)}
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
            disabled={!(step === "input" ? isInputValid : isOtpValid) || isLoading}
            loading={isLoading}
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
    marginBottom: Spacing.xl,
    lineHeight: 22,
    paddingHorizontal: Spacing.lg },
  inputSection: {
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg },
  label: {
    ...Typography.caption,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginBottom: 8 },
  row: {
    flexDirection: "row",
    gap: Spacing.sm },
  countryPicker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 52,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    gap: 4 },
  countryCode: {
    ...Typography.bodyLg,
    color: Colors.textPrimary },
  phoneInputContainer: {
    flex: 1,
    height: 52,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    justifyContent: "center" },
  input: {
    ...Typography.bodyLg,
    color: Colors.textPrimary },
  errorText: {
    fontSize: 12,
    color: '#D1222E',
    marginTop: 4,
    paddingHorizontal: Spacing.lg,
  },
  footer: {
    padding: Spacing.lg,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border + "20" } });
}


