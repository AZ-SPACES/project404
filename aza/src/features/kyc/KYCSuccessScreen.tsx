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

export default function KYCSuccessScreen() {
  const navigation = useNavigation<NavigationProp>();

  const handleFinish = () => {
    // In a real app, this would set kyc_status to completed and show the Dashboard
    navigation.navigate("Onboarding");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.iconContainer}>
          <MaterialIcons name="check-circle" size={64} color={Colors.primary} />
        </View>

        <Text style={styles.title}>Verification Complete</Text>
        <Text style={styles.subtitle}>
          Information submitted successfully.
        </Text>
        
        <View style={styles.infoCard}>
          <Text style={styles.bodyText}>
            Thank you for verifying your identity. Your documents are being processed to ensure compliance with financial regulations.
          </Text>
          <View style={styles.spacer} />
          <Text style={styles.bodyText}>
            This usually takes less than 60 seconds. You will receive a notification once your account is fully activated.
          </Text>
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <Button
          title="Go to Dashboard"
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
