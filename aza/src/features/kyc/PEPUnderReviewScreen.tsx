import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors, Typography, Spacing, Radius } from "../../theme";
import Button from "../../components/ui/Button";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function PEPUnderReviewScreen() {
  const navigation = useNavigation<NavigationProp>();

  const handleFinish = () => {
    // Navigate back to home/dashboard or onboarding since the account is locked in review state
    navigation.navigate("Onboarding");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.iconContainer}>
          <MaterialIcons name="pending-actions" size={64} color={Colors.primary} />
        </View>

        <Text style={styles.title}>Account Under Review</Text>
        <Text style={styles.subtitle}>
          Information submitted successfully.
        </Text>
        
        <View style={styles.infoCard}>
          <Text style={styles.bodyText}>
            As part of our commitment to financial security and in accordance with Bank of Ghana regulations for Politically Exposed Persons (PEPs), your profile requires standard senior management review.
          </Text>
          <View style={styles.spacer} />
          <Text style={styles.bodyText}>
            This review process typically takes 1-2 business days. We will notify you via email and push notification once your account has been fully activated and limitations are lifted.
          </Text>
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <Button
          title="Return to Home"
          onPress={handleFinish}
          backgroundColor={Colors.primary}
          textColor={Colors.secondary}
          borderRadius={30}
          paddingVertical={16}
          fontSize={Number(Typography.button.fontSize)}
          fontWeight={Typography.button.fontWeight as any}
        />
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
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl * 2,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(22, 51, 0, 0.05)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    letterSpacing: -0.5,
    lineHeight: 38,
  },
  subtitle: {
    fontSize: Typography.bodyLg.fontSize,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
  },
  infoCard: {
    backgroundColor: "#F9FAFB",
    padding: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bodyText: {
    fontSize: Typography.body.fontSize,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
  spacer: {
    height: Spacing.md,
  },
  buttonContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
});
