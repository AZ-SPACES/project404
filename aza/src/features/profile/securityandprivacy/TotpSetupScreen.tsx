import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Image,
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from '@react-native-vector-icons/feather';
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from "../../../theme";
import Button from "../../../components/ui/Button";
import { initiateTotpSetup, confirmTotpSetup } from "../../../services/api";
import { useToast } from "../../../providers/ToastProvider";
import { useProfile } from "../../../providers/ProfileProvider";
import { BackButton } from '../../../components/ui/BackButton';
import { extractErrorMessage } from '../../../utils/errorUtils';

const { width } = Dimensions.get("window");

export default function TotpSetupScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { showToast } = useToast();
  const { fetchProfile: invalidateProfile } = useProfile();

  const [step, setStep] = useState(1); // 1: QR/Secret, 2: Verification
  const [setupData, setSetupData] = useState<{ secret: string; qrCodeImage: string } | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    loadSetupData();
  }, []);

  const loadSetupData = async () => {
    setIsInitializing(true);
    try {
      const response = await initiateTotpSetup();
      setSetupData(response.data.data);
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, "Failed to initialize setup.");
      Alert.alert("Error", msg);
      navigation.goBack();
    } finally {
      setIsInitializing(false);
    }
  };

  const handleCopySecret = async () => {
    if (setupData?.secret) {
      await Clipboard.setStringAsync(setupData.secret);
      showToast("Secret copied to clipboard", "success");
    }
  };

  const handleVerify = async () => {
    if (verificationCode.length !== 6) return;
    setIsLoading(true);
    try {
      const response = await confirmTotpSetup(verificationCode);
      invalidateProfile();
      navigation.replace("RecoveryCodes", { codes: response.data.data.codes });
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, "Invalid code. Please try again.");
      showToast(msg, "error");
    } finally {
      setIsLoading(false);
    }
  };

  if (isInitializing) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Initializing secure setup...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <BackButton onPress={() => (step === 2 ? setStep(1) : navigation.goBack())} />
          <Text style={styles.headerTitle}>Two-step verification</Text>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
          {step === 1 ? (
            <View style={styles.stepContainer}>
              <Text style={styles.title}>Set up authenticator</Text>
              <Text style={styles.description}>
                Scan this QR code with an authenticator app (like Google Authenticator or Authy) to generate verification codes.
              </Text>

              <View style={styles.qrCard}>
                <Image
                  source={{ uri: `data:image/png;base64,${setupData?.qrCodeImage ?? ""}` }}
                  style={styles.qrImage}
                />
              </View>

              <View style={styles.manualEntrySection}>
                <Text style={styles.manualEntryTitle}>Can't scan the QR code?</Text>
                <Text style={styles.manualEntryDescription}>
                  Enter this secret key manually in your authenticator app.
                </Text>
                <TouchableOpacity style={styles.secretBox} onPress={handleCopySecret}>
                  <Text style={styles.secretText}>{setupData?.secret}</Text>
                  <Feather name="copy" size={18} color={Colors.primary} />
                </TouchableOpacity>
              </View>

              <View style={styles.footer}>
                <Button
                  title="Next"
                  onPress={() => setStep(2)}
                  backgroundColor={Colors.primary}
                  textColor={Colors.secondary}
                  borderRadius={Radius.full}
                  paddingVertical={16}
                />
              </View>
            </View>
          ) : (
            <View style={styles.stepContainer}>
              <Text style={styles.title}>Enter verification code</Text>
              <Text style={styles.description}>
                Enter the 6-digit code generated by your authenticator app to complete the setup.
              </Text>

              <View style={styles.inputContainer}>
                <TextInput
                  underlineColorAndroid="transparent"
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

              <View style={styles.footer}>
                <Button
                  title="Verify & Enable"
                  onPress={handleVerify}
                  disabled={verificationCode.length !== 6 || isLoading}
                  loading={isLoading}
                  backgroundColor={Colors.primary}
                  textColor={Colors.secondary}
                  borderRadius={Radius.full}
                  paddingVertical={16}
                />
              </View>
            </View>
          )}
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
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    loadingText: {
      color: Colors.textSecondary,
      fontSize: 16,
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
    stepContainer: {
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
    qrCard: {
      backgroundColor: "white",
      padding: 20,
      borderRadius: 24,
      alignSelf: "center",
      marginBottom: Spacing.xl,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.1,
      shadowRadius: 15,
      elevation: 5,
    },
    qrImage: {
      width: width * 0.6,
      height: width * 0.6,
    },
    manualEntrySection: {
      marginTop: Spacing.lg,
    },
    manualEntryTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: Colors.textPrimary,
      marginBottom: 8,
    },
    manualEntryDescription: {
      fontSize: 14,
      color: Colors.textSecondary,
      marginBottom: 16,
    },
    secretBox: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: isDark ? Colors.surface : "#F3F4F6",
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    secretText: {
      fontSize: 16,
      fontWeight: "700",
      color: Colors.textPrimary,
      letterSpacing: 1,
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
    footer: {
      marginTop: "auto",
      marginBottom: Spacing.xl,
    },
  });
}
