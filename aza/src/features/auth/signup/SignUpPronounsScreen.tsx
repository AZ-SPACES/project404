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
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors, Typography, Spacing, Radius } from "../../../theme";
import Button from "../../../components/ui/Button";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type PronounOption = "he/his" | "she/her" | "they/them" | "custom" | null;

export default function SignUpPronounsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [selectedPronoun, setSelectedPronoun] = useState<PronounOption>(null);
  const [customPronoun, setCustomPronoun] = useState("");

  const handleNext = () => {
    // Navigate to the next screen in the signup flow
    navigation.navigate("SignUpEmployment");
  };

  const handleSkip = () => {
    // Navigate without saving
    navigation.navigate("SignUpEmployment");
  };

  const isFormValid =
    (selectedPronoun !== null && selectedPronoun !== "custom") ||
    (selectedPronoun === "custom" && customPronoun.trim().length > 0);

  const renderOption = (label: string, id: PronounOption) => (
    <TouchableOpacity
      style={[
        styles.radioItem,
        selectedPronoun === id && styles.radioItemSelected,
      ]}
      onPress={() => setSelectedPronoun(id)}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.radioCircle,
          selectedPronoun === id && styles.radioCircleSelected,
        ]}
      />
      <Text
        style={[
          styles.radioLabel,
          selectedPronoun === id && styles.radioLabelSelected,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
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
            <TouchableOpacity onPress={handleSkip}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContentContainer}
          >
            <Text style={styles.title}>What are your pronouns?</Text>
            <Text style={styles.subtitle}>
              Specifying pronouns helps us accurately understand your identity.
            </Text>

            <Text style={styles.label}>Your pronouns</Text>

            {renderOption("he/his", "he/his")}
            {renderOption("she/her", "she/her")}
            {renderOption("they/them", "they/them")}

            <Text style={styles.label}>Custom</Text>
            <View
              style={[
                styles.inputContainer,
                selectedPronoun === "custom" && styles.inputContainerActive,
              ]}
            >
              <TextInput
                style={styles.input}
                placeholder="Add yours"
                placeholderTextColor={Colors.textSecondary}
                value={customPronoun}
                onChangeText={(text) => {
                  setCustomPronoun(text);
                  if (text.length > 0) {
                    setSelectedPronoun("custom");
                  }
                }}
                onFocus={() => setSelectedPronoun("custom")}
                autoCapitalize="none"
              />
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.buttonContainer}>
            <Button
              title="Continue"
              onPress={handleNext}
              backgroundColor={Colors.primary}
              textColor={Colors.secondary}
              borderRadius={30}
              paddingVertical={16}
              fontSize={Number(Typography.button.fontSize)}
              fontWeight={Typography.button.fontWeight as any}
              disabled={!isFormValid}
            />
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 50,
    backgroundColor: "rgba(22,51,0,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  skipText: {
    fontSize: Typography.bodyLg.fontSize,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  content: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginTop: Spacing.xs,
    paddingRight: Spacing.xl,
  },
  label: {
    fontSize: Typography.bodyLg.fontSize,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    marginTop: Spacing.xl,
  },
  radioItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    height: 46,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    marginBottom: Spacing.md,
  },
  radioItemSelected: {
    borderColor: Colors.primary,
    backgroundColor: "#FAFCF8",
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    marginRight: Spacing.sm,
  },
  radioCircleSelected: {
    backgroundColor: Colors.primary,
  },
  radioLabel: {
    fontSize: Typography.body.fontSize,
    color: Colors.textSecondary,
  },
  radioLabelSelected: {
    color: Colors.textPrimary,
    fontWeight: "500",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    height: 48,
    backgroundColor: "white",
  },
  inputContainerActive: {
    borderColor: Colors.primary,
    backgroundColor: "#FAFCF8",
  },
  input: {
    flex: 1,
    fontSize: Typography.body.fontSize,
    color: Colors.textPrimary,
    height: "100%",
  },
  buttonContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
});
