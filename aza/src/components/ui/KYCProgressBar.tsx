import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "../../theme";

type KYCProgressBarProps = {
  currentStep: number;
  totalSteps: number;
  label?: string;
};

export default function KYCProgressBar({
  currentStep,
  totalSteps,
  label,
}: KYCProgressBarProps) {
  const safeCurrentStep = Math.min(Math.max(currentStep, 1), totalSteps);
  const progressRatio = safeCurrentStep / totalSteps;

  return (
    <View style={styles.container}>
      {label && (
        <Text style={styles.label}>
          {label} — Step {safeCurrentStep} of {totalSteps}
        </Text>
      )}
      <View style={styles.track}>
        <View
          style={[styles.fill, { width: `${progressRatio * 100}%` }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
    width: "100%",
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  track: {
    width: "100%",
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
});
