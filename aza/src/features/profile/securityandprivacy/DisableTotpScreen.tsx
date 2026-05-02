import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from "../../../theme";
import Button from "../../../components/ui/Button";
import { disableTotp } from "../../../services/api";
import { useToast } from "../../../providers/ToastProvider";
import { useProfile } from "../../../providers/ProfileProvider";

export default function DisableTotpScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { showToast } = useToast();
  const { fetchProfile } = useProfile();

  const [verificationCode, setVerificationCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleDisable = async () => {
    if (verificationCode.length !== 6) return;
    
    Alert.alert(
      "Turn off authenticator app?",
      "You'll no longer need to enter a code from your authenticator app when you log in. This will make your account less secure.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Turn off", 
          style: "destructive",
          onPress: async () => {
            setIsLoading(true);
            try {
              await disableTotp(verificationCode);
              await fetchProfile();
              showToast("Authenticator app disabled", "success");
              navigation.navigate("TwoStepVerification");
            } catch (err: any) {
              const msg = err.response?.data?.message || "Invalid code. Please try again.";
              showToast(msg, "error");
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Feather name="chevron-left" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Authenticator app</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            <Text style={styles.title}>Turn off authenticator app</Text>
            <Text style={styles.description}>
              Enter a 6-digit code from your authenticator app to confirm it's you.
            </Text>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="000 000"
                placeholderTextColor={Colors.textSecondary}
                value={verificationCode}
                onChangeText={(val) => setVerificationCode(val.replace(/[^0-9]/g, "").substring(0, 6))}
                keyboardType="number-pad"
                autoFocus
                maxLength={6}
              />
            </View>

            <View style={styles.warningBox}>
              <Feather name="alert-triangle" size={20} color="#991B1B" />
              <Text style={styles.warningText}>
                Turning this off will remove an extra layer of protection from your account.
              </Text>
            </View>
          </View>

          <View style={styles.footer}>
            <Button
              title="Verify & Turn Off"
              onPress={handleDisable}
              disabled={verificationCode.length !== 6 || isLoading}
              loading={isLoading}
              backgroundColor="#EF4444"
              textColor="#FFFFFF"
              borderRadius={Radius.full}
              paddingVertical={16}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: Spacing.lg,
      height: 56,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: isDark ? Colors.white10 : "rgba(22, 51, 0, 0.04)",
      justifyContent: "center",
      alignItems: "center",
      marginRight: Spacing.md,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: Colors.textPrimary,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.xl,
    },
    content: {
      flex: 1,
    },
    title: {
      fontSize: 28,
      fontWeight: "700",
      color: Colors.textPrimary,
      marginBottom: Spacing.sm,
    },
    description: {
      fontSize: 16,
      color: Colors.textSecondary,
      lineHeight: 24,
      marginBottom: Spacing.xl,
    },
    inputContainer: {
      marginBottom: Spacing.xl,
    },
    input: {
      fontSize: 36,
      fontWeight: "700",
      color: Colors.textPrimary,
      textAlign: "center",
      letterSpacing: 8,
      borderBottomWidth: 2,
      borderBottomColor: Colors.primary,
      paddingVertical: 8,
    },
    warningBox: {
      flexDirection: "row",
      backgroundColor: "#FEF2F2",
      padding: 16,
      borderRadius: 12,
      alignItems: "center",
      gap: 12,
    },
    warningText: {
      flex: 1,
      color: "#991B1B",
      fontSize: 14,
      lineHeight: 20,
    },
    footer: {
      marginTop: "auto",
      marginBottom: Spacing.xl,
    },
  });
}
