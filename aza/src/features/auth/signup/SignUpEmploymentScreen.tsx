import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
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

type EmploymentOption =
  | "Student"
  | "Part-Time"
  | "Full-Time"
  | "Self-employed"
  | "Retired"
  | "Unemployed";

const EMPLOYMENT_OPTIONS: EmploymentOption[] = [
  "Student",
  "Part-Time",
  "Full-Time",
  "Self-employed",
  "Retired",
  "Unemployed",
];

export default function SignUpEmploymentScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [selectedEmployment, setSelectedEmployment] =
    useState<EmploymentOption | null>(null);

  const handleNext = () => {
    // Navigate to the next screen in the signup flow
    navigation.navigate("SignUpBirthday");
  };

  const renderOption = (label: EmploymentOption) => (
    <TouchableOpacity
      key={label}
      style={[
        styles.optionItem,
        selectedEmployment === label && styles.optionItemSelected,
      ]}
      onPress={() => setSelectedEmployment(label)}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.optionLabel,
          selectedEmployment === label && styles.optionLabelSelected,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
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
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContentContainer}
        >
          <Text style={styles.title}>What is your{"\n"}employment status?</Text>

          <Text style={styles.label}>Employment</Text>

          <View style={styles.optionsContainer}>
            {EMPLOYMENT_OPTIONS.map(renderOption)}
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
            disabled={selectedEmployment === null}
          />
        </View>
      </View>
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
    marginBottom: Spacing.md,
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  label: {
    fontSize: Typography.bodyLg.fontSize,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
  },
  optionsContainer: {
    gap: Spacing.sm,
  },
  optionItem: {
    height: 48,
    justifyContent: "center",
    paddingHorizontal: Spacing.md,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
  },
  optionItemSelected: {
    borderColor: Colors.primary,
    backgroundColor: "#FAFCF8",
  },
  optionLabel: {
    fontSize: Typography.body.fontSize,
    color: Colors.textSecondary,
  },
  optionLabelSelected: {
    color: Colors.textPrimary,
    fontWeight: "500",
  },
  buttonContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
});
