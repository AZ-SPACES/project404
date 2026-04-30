import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Linking,
  StatusBar,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {  useAppTheme, ThemeColors, Typography, Spacing, Radius  } from "../../../theme";
import Button from "../../../components/ui/Button";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";
import { useAuth } from "../../../providers/AuthProvider";
import { useSignupData, useSignupActions, useSignupLoading } from "../../../providers/SignUpProvider";
import { useProfile } from "../../../providers/ProfileProvider";
import { useToast } from "../../../providers/ToastProvider";
import * as SecureStore from "expo-secure-store";
import { TOKEN_KEY, REFRESH_TOKEN_KEY } from "../../../services/api";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Consent">;

const TERMS_URL = ""; // TODO: add production URL
const PRIVACY_URL = ""; // TODO: add production URL

export default function ConsentScreen() {
  const { colors: Colors } = useAppTheme();
  const { userToken, login, savePasscodeValue, setPasscode } = useAuth();
  const data = useSignupData();
  const { reset, submitSignup } = useSignupActions();
  const isLoading = useSignupLoading();
  const { setDisplayName, setEmail, setPhone } = useProfile();
  const { showToast } = useToast();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();
  const isDark = Colors.isDark;
  const scrollY = useRef(new Animated.Value(0)).current;

  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);

  const headerBorderOpacity = scrollY.interpolate({
    inputRange: [40, 70],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const isValid = agreedToTerms && agreedToPrivacy;

  const handleOpenTerms = () => {
    if (TERMS_URL) {
      Linking.openURL(TERMS_URL).catch(() => {});
    } else {
      Alert.alert("Coming Soon", "Our Terms of Service will be available shortly.");
    }
  };

  const handleOpenPrivacy = () => {
    if (PRIVACY_URL) {
      Linking.openURL(PRIVACY_URL).catch(() => {});
    } else {
      Alert.alert("Coming Soon", "Our Privacy Policy will be available shortly.");
    }
  };

  const handleContinue = async () => {
    if (userToken) {
      // Standalone case: User is already logged in, just finishing setup
      setPasscode();
      return;
    }

    // Signup case: Not logged in yet
    try {
      const response = await submitSignup();
      const authPayload = response?.data ?? response;
      const { accessToken, refreshToken } = authPayload;

      const fullName = [data.firstName, data.lastName].filter(Boolean).join(' ');
      if (fullName) await setDisplayName(fullName);
      if (data.email) await setEmail(data.email);
      if (data.phoneNumber) await setPhone(data.phoneNumber);

      // Save passcode locally for biometrics/verification
      if (data.passcode) {
        await savePasscodeValue(data.passcode);
      }

      reset();

      await SecureStore.setItemAsync(TOKEN_KEY, accessToken);
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
      
      // hasPasscode=true because we just set it during signup
      login(accessToken, true, false);
    } catch (error: any) {
      showToast(error?.response?.data?.message || error.message || 'Signup failed', 'error');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" />
      <View style={styles.container}>
        {/* Header */}
        <Animated.View
          style={[
            styles.header,
            {
              borderBottomColor: headerBorderOpacity.interpolate({
                inputRange: [0, 1],
                outputRange: ["transparent", Colors.border],
              }),
            },
          ]}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons name="chevron-left" size={28} color={Colors.textPrimary} />
          </TouchableOpacity>
        </Animated.View>

        {/* Content */}
        <Animated.ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}
        >
          <Text style={styles.title}>Before you continue</Text>
          <Text style={styles.subtitle}>
            Please review and accept our Terms of Service and Privacy Policy.
            These documents explain your rights, our obligations, and how your
            data is handled.
          </Text>

          {/* Documents */}
          <View style={styles.documentList}>
            <TouchableOpacity
              style={styles.documentRow}
              onPress={handleOpenTerms}
              activeOpacity={0.7}
            >
              <View style={styles.documentIcon}>
                <MaterialIcons name="description" size={20} color={Colors.primary} />
              </View>
              <View style={styles.documentInfo}>
                <Text style={styles.documentTitle}>Terms of Service</Text>
                <Text style={styles.documentMeta}>aza Financial Services Ltd</Text>
              </View>
              <MaterialIcons name="open-in-new" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.documentRow}
              onPress={handleOpenPrivacy}
              activeOpacity={0.7}
            >
              <View style={styles.documentIcon}>
                <MaterialIcons name="privacy-tip" size={20} color={Colors.primary} />
              </View>
              <View style={styles.documentInfo}>
                <Text style={styles.documentTitle}>Privacy Policy</Text>
                <Text style={styles.documentMeta}>How your data is collected and used</Text>
              </View>
              <MaterialIcons name="open-in-new" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Checkboxes */}
          <View style={styles.checkboxSection}>
            <CheckboxRow
              checked={agreedToTerms}
              onPress={() => setAgreedToTerms(!agreedToTerms)}
              label="I have read and agree to the "
              linkLabel="Terms of Service"
              onLinkPress={handleOpenTerms}
            />
            <CheckboxRow
              checked={agreedToPrivacy}
              onPress={() => setAgreedToPrivacy(!agreedToPrivacy)}
              label="I have read and agree to the "
              linkLabel="Privacy Policy"
              onLinkPress={handleOpenPrivacy}
            />
          </View>

          <View style={styles.legalNote}>
            <MaterialIcons name="info-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.legalNoteText}>
              Your acceptance is recorded with a timestamp under the Data
              Protection Act 843 (2012) and BoG Disclosure Guidelines 2022.
            </Text>
          </View>
        </Animated.ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <Button
            title="I agree — Continue"
            onPress={handleContinue}
            backgroundColor={Colors.primary}
            textColor={Colors.secondary}
            borderRadius={30}
            paddingVertical={16}
            fontSize={Typography.button.fontSize}
            fontWeight={Typography.button.fontWeight}
            disabled={!isValid || isLoading}
            loading={isLoading}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}


type CheckboxRowProps = {
  checked: boolean;
  onPress: () => void;
  label: string;
  linkLabel: string;
  onLinkPress: () => void;
};

function CheckboxRow({
  checked,
  onPress,
  label,
  linkLabel,
  onLinkPress,
}: CheckboxRowProps) {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  return (
    <TouchableOpacity
      style={styles.checkboxRow}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
    >
      <View
        style={[styles.checkbox, checked && styles.checkboxChecked]}
        aria-hidden
      >
        {checked && (
          <MaterialIcons name="check" size={14} color={Colors.secondary} />
        )}
      </View>
      <Text style={styles.checkboxLabel}>
        {label}
        <Text style={styles.checkboxLink} onPress={onLinkPress}>
          {linkLabel}
        </Text>
      </Text>
    </TouchableOpacity>
  );
}


function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: { flex: 1 },
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 50,
    backgroundColor: isDark ? Colors.white10 : "rgba(22,51,0,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  content: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  documentList: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
    overflow: "hidden",
  },
  documentRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    gap: Spacing.md,
  },
  documentIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  documentInfo: { flex: 1 },
  documentTitle: {
    fontSize: Typography.bodyLg.fontSize,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  documentMeta: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginLeft: Spacing.md + 36 + Spacing.md,
  },
  checkboxSection: {
    marginTop: Spacing.xl,
    gap: Spacing.md,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surface,
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: Typography.bodyLg.fontSize,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  checkboxLink: {
    color: Colors.primary,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  legalNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    padding: Spacing.md,
  },
  legalNoteText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
});
}


