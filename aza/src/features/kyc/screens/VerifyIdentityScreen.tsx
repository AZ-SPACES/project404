import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  ScrollView,
  StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from "../../../theme";
import Button from "../../../components/ui/Button";
import KYCProgressBar from "../../../components/ui/KYCProgressBar";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";
import { RouteProp, useRoute } from "@react-navigation/native";
import { usePreventScreenCapture } from '../../../hooks/usePreventScreenCapture';
import { useKYC } from '../../../providers/KYCProvider';
import { BackButton } from '../../../components/ui/BackButton';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "VerifyIdentity">;
type VerifyIdentityRouteProp = RouteProp<RootStackParamList, "VerifyIdentity">;

export default function VerifyIdentityScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();
  const { recordConsent, isSubmitting } = useKYC();
  const route = useRoute<VerifyIdentityRouteProp>();
  const { isPEP } = route.params || {};
  usePreventScreenCapture();
  const [biometricConsent, setBiometricConsent] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [40, 70],
    outputRange: [0, 1],
    extrapolate: "clamp" });

  const headerBorderOpacity = scrollY.interpolate({
    inputRange: [40, 70],
    outputRange: [0, 1],
    extrapolate: "clamp" });

  const handleNext = async () => {
    try {
      await recordConsent();
      navigation.navigate('SourceofFund', { isPEP: !!isPEP });
    } catch (error) {
      console.error('Failed to record consent:', error);
      // Ideally show a toast or error message here
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
                outputRange: ["transparent", Colors.border] }) },
          ]}
        >
          <BackButton onPress={() => navigation.goBack()} size={28} />
          <Animated.View
            style={[styles.headerTitleContainer, { opacity: headerTitleOpacity }]}
          >
            <Text style={styles.headerTitle} numberOfLines={1}>
              Verify your identity
            </Text>
          </Animated.View>
        </Animated.View>

        {/* Content */}
        <Animated.ScrollView
          style={styles.content}
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false },
          )}
          scrollEventThrottle={16}
        >
          <KYCProgressBar currentStep={1} totalSteps={6} label="Identity Verification" />
          <Text style={styles.title}>Let's verify your identity</Text>
          <Text style={styles.subtitle}>
            As your financial partner, we are required to verify if it's really
            you.
          </Text>

          {/* Centered Image */}
          <View style={styles.imageContainer}>
            <Image
              source={require("../../../assets/encryption.png")}
              style={styles.image}
              resizeMode="contain"
            />
          </View>
        </Animated.ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          {/* Biometric consent — Data Protection Act 843 */}
          <TouchableOpacity
            style={styles.consentRow}
            onPress={() => setBiometricConsent(!biometricConsent)}
            activeOpacity={0.7}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: biometricConsent }}
          >
            <View style={[styles.checkbox, biometricConsent && styles.checkboxChecked]}>
              {biometricConsent && (
                <MaterialIcons name="check" size={14} color={Colors.secondary} />
              )}
            </View>
            <Text style={styles.consentText}>
              I consent to aza collecting and processing my ID document images
              and selfie for identity verification, as required under{" "}
              <Text style={styles.consentBold}>AML Act 1044</Text>. Data is
              retained for a minimum of 6 years.
            </Text>
          </TouchableOpacity>

          <View style={styles.securityNoteContainer}>
            <MaterialIcons
              name="lock-outline"
              size={20}
              color={Colors.textPrimary}
            />
            <Text style={styles.securityNoteText}>
              Your identity is safe with us.
            </Text>
          </View>
          <Button
            title="Continue"
            onPress={handleNext}
            backgroundColor={Colors.primary}
            textColor={Colors.secondary}
            borderRadius={Radius.sm}
            paddingVertical={16}
            fontSize={Typography.button.fontSize}
            fontWeight={Typography.button.fontWeight}
            loading={isSubmitting}
            disabled={!biometricConsent || isSubmitting}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background },
  container: {
    flex: 1 },
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
    marginRight: 44 },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textPrimary },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 50,
    backgroundColor: isDark ? Colors.white10 : "rgba(22,51,0,0.04)",
    alignItems: "center",
    justifyContent: "center" },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg },
  title: {
    fontSize: 34,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    letterSpacing: -0.5 },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 20 },
  imageContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center" },
  image: {
    width: "80%",
    height: "80%" },
  footer: {
    paddingHorizontal: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: isDark ? Colors.border : "rgba(0,0,0,0.05)",
    paddingVertical: Spacing.lg
  },
  securityNoteContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
    marginTop: Spacing.sm },
  securityNoteText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginLeft: Spacing.sm },
  consentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    marginBottom: Spacing.md,
    paddingHorizontal: 2 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: isDark ? Colors.surface : Colors.white,
    marginTop: 1,
    flexShrink: 0 },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary },
  consentText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18 },
  consentBold: {
    fontWeight: "600",
    color: Colors.textPrimary } });
}


