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
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {  useAppTheme, ThemeColors, Typography, Spacing, Radius  } from "../../../theme";
import Button from "../../../components/ui/Button";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "SignUpNumber">;

export default function SignUpNumberScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.background === '#121212';
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();
  const [phoneNumber, setPhoneNumber] = useState("");

  const handleNext = () => {
    // Navigate to next screen, e.g. OTP verification
    // navigation.navigate('SignUpOTP'); or similar
    navigation.navigate("SignUpEmail");
  };

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
                name="close"
                size={28}
                color={Colors.textPrimary}
              />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={styles.title}>What's your mobile number?</Text>
            <Text style={styles.subtitle}>
              Your number will be used for signing into your account.
            </Text>
            <Text style={styles.label}>Your Phone Number</Text>
            <View style={styles.inputContainer}>
              <MaterialIcons
                name="smartphone"
                size={24}
                color={Colors.primary}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="000 000 0000"
                placeholderTextColor={Colors.textSecondary}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
                autoCapitalize="none"
                autoFocus
                cursorColor={Colors.primary}
                selectionColor={Colors.primary}
              />
            </View>
          </View>

          {/* Footer */}
          <View style={styles.buttonContainer}>
            <Button
              title="Next"
              onPress={handleNext}
              backgroundColor={Colors.primary}
              textColor={Colors.secondary}
              borderRadius={30}
              paddingVertical={16}
              fontSize={Number(Typography.button.fontSize)}
              fontWeight={Typography.button.fontWeight as any}
              disabled={phoneNumber.trim().length === 0}
            />
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.background === '#121212';
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
    marginBottom: Spacing.xl,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
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
  buttonContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
});
}


