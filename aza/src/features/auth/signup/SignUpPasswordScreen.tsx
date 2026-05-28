import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  TouchableOpacity,
  StyleSheet,
  StatusBar
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import {  useAppTheme, ThemeColors, Typography, Spacing, Radius  } from "../../../theme";
import Button from "../../../components/ui/Button";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";
import { isValidPassword, getPasswordRules } from "../../../utils/validation";
import { useSignUp } from "../../../providers/SignUpProvider";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "SignUpPassword">;

export default function SignUpPasswordScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();
  const { data, update } = useSignUp();
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);

  const rules = getPasswordRules(data.password);
  const mismatchError = confirmTouched && confirmPassword.length > 0 && data.password !== confirmPassword
    ? "Passwords don't match"
    : null;

  const handleNext = () => {
    navigation.navigate("SignUpName");
  };

  const isFormValid = isValidPassword(data.password) && data.password === confirmPassword;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* Header */}
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

          {/* Content */}
          <View style={styles.content}>
            <Text style={styles.title}>Enter Password</Text>
            <Text style={styles.subtitle}>
              Your password is save with you. We don't get to know it.
            </Text>

            <Text style={styles.label}>Password</Text>
            <View style={styles.inputContainer}>
              <MaterialIcons
                name="fingerprint"
                size={24}
                color={Colors.primary}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="********"
                placeholderTextColor={Colors.textSecondary}
                value={data.password}
                onChangeText={(t) => update({ password: t })}
                onBlur={() => setPasswordTouched(true)}
                secureTextEntry={!isPasswordVisible}
                autoCapitalize="none"
                autoFocus
              />
              <TouchableOpacity
                onPress={() => setIsPasswordVisible(!isPasswordVisible)}
              >
                <MaterialIcons
                  name={isPasswordVisible ? "visibility" : "visibility-off"}
                  size={20}
                  color={Colors.primary}
                />
              </TouchableOpacity>
            </View>
            {passwordTouched && data.password.length > 0 && (
              <View style={styles.rulesContainer}>
                {rules.map((r) => (
                  <Text
                    key={r.label}
                    style={[styles.ruleText, r.met ? styles.ruleMet : styles.ruleUnmet]}
                  >
                    {r.met ? '✓' : '✗'} {r.label}
                  </Text>
                ))}
              </View>
            )}

            <Text style={styles.label}>Confirm Password</Text>
            <View style={styles.inputContainer}>
              <MaterialIcons
                name="fingerprint"
                size={24}
                color={Colors.primary}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="********"
                placeholderTextColor={Colors.textSecondary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                onBlur={() => setConfirmTouched(true)}
                secureTextEntry={!isConfirmPasswordVisible}
                autoCapitalize="none"
                cursorColor={Colors.primary}
                selectionColor={Colors.primary}
              />
              <TouchableOpacity
                onPress={() =>
                  setIsConfirmPasswordVisible(!isConfirmPasswordVisible)
                }
              >
                <MaterialIcons
                  name={
                    isConfirmPasswordVisible ? "visibility" : "visibility-off"
                  }
                  size={20}
                  color={Colors.primary}
                />
              </TouchableOpacity>
            </View>
            {mismatchError ? <Text style={styles.errorText}>{mismatchError}</Text> : null}
          </View>

          {/* Footer */}
          <View style={styles.buttonContainer}>
            <Button
              title="Continue"
              onPress={handleNext}
              backgroundColor={Colors.primary}
              textColor={Colors.secondary}
              borderRadius={Radius.sm}
              paddingVertical={16}
              fontSize={Typography.button.fontSize}
              fontWeight={Typography.button.fontWeight}
              disabled={!isFormValid}
            />
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
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
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 50,
    backgroundColor: isDark ? Colors.white10 : "rgba(22,51,0,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  label: {
    fontSize: Typography.bodyLg.fontSize,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    marginTop: Spacing.xl,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    height: 48,
    backgroundColor: isDark ? Colors.surface : 'white',
  },
  inputIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: Typography.bodyLg.fontSize,
    color: Colors.textPrimary,
    height: "100%",
  },
  rulesContainer: {
    marginTop: 8,
    gap: 2,
  },
  ruleText: {
    fontSize: 12,
  },
  ruleMet: {
    color: '#22C55E',
  },
  ruleUnmet: {
    color: '#D1222E',
  },
  errorText: {
    fontSize: 12,
    color: '#D1222E',
    marginTop: 4,
  },
  buttonContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
});
}


