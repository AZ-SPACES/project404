import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from "../../../theme";
import Button from "../../../components/ui/Button";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";
import { useKYC, PEPAccountPurpose, PEPMonthlyVolume } from '../../../providers/KYCProvider';
import { useToast } from "../../../providers/ToastProvider";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "PEPAccountPurpose">;

type PurposeOption = 
  | "Day-to-day spending" 
  | "Savings & Investments" 
  | "Business transactions" 
  | "Salary receiving";

type VolumeOption = 
  | "Less than GH₵ 10,000" 
  | "GH₵ 10,000 - 50,000" 
  | "GH₵ 50,000 - 100,000"
  | "More than GH₵ 100,000";

const PURPOSE_OPTIONS: PurposeOption[] = [
  "Day-to-day spending", 
  "Savings & Investments", 
  "Business transactions", 
  "Salary receiving"
];

const VOLUME_OPTIONS: VolumeOption[] = [
  "Less than GH₵ 10,000", 
  "GH₵ 10,000 - 50,000", 
  "GH₵ 50,000 - 100,000",
  "More than GH₵ 100,000"
];

export function PEPAccountPurposeScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();
  const { data, submitPepDetails, isSubmitting } = useKYC();
  const { showToast } = useToast();
  const [purpose, setPurpose] = useState<PurposeOption | null>(data.pepAccountPurpose as PurposeOption ?? null);
  const [volume, setVolume] = useState<VolumeOption | null>(data.pepMonthlyVolume as VolumeOption ?? null);
  const scrollY = useRef(new Animated.Value(0)).current;

  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [40, 70],
    outputRange: [0, 1],
    extrapolate: "clamp" });

  const headerBorderOpacity = scrollY.interpolate({
    inputRange: [40, 70],
    outputRange: [0, 1],
    extrapolate: "clamp" });

  const isFormValid = purpose !== null && volume !== null;

  const handleNext = async () => {
    try {
      if (purpose && volume) {
        await submitPepDetails(
          purpose as PEPAccountPurpose, 
          volume as PEPMonthlyVolume
        );
        navigation.navigate("PEPProofOfWealth");
      }
    } catch (error) {
      console.error('Failed to submit PEP details:', error);
      showToast('Submission failed. Please try again.', 'error');
    }
  };

  const renderPurposeOption = (label: PurposeOption) => (
    <TouchableOpacity
      key={label}
      style={[
        styles.optionItem,
        purpose === label && styles.optionItemSelected,
      ]}
      onPress={() => setPurpose(label)}
      activeOpacity={0.7}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: purpose === label }}
    >
      <Text
        style={[
          styles.optionLabel,
          purpose === label && styles.optionLabelSelected,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderVolumeOption = (label: VolumeOption) => (
    <TouchableOpacity
      key={label}
      style={[
        styles.optionItem,
        volume === label && styles.optionItemSelected,
      ]}
      onPress={() => setVolume(label)}
      activeOpacity={0.7}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: volume === label }}
    >
      <Text
        style={[
          styles.optionLabel,
          volume === label && styles.optionLabelSelected,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

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
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <MaterialIcons
              name="chevron-left"
              size={28}
              color={Colors.textPrimary}
            />
          </TouchableOpacity>
          <Animated.View
            style={[styles.headerTitleContainer, { opacity: headerTitleOpacity }]}
          >
            <Text style={styles.headerTitle} numberOfLines={1}>
              Account Purpose
            </Text>
          </Animated.View>
        </Animated.View>

        {/* Content */}
        <Animated.ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContentContainer}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false },
          )}
          scrollEventThrottle={16}
        >
          <Text style={styles.title}>Account Usage</Text>
          <Text style={styles.subtitle}>
            Please provide details on how you intend to use this account to help us optimize your limits and secure your profile.
          </Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Primary Purpose of Account</Text>
            <View style={styles.optionsContainer}>
              {PURPOSE_OPTIONS.map(renderPurposeOption)}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Expected Monthly Volume</Text>
            <View style={styles.optionsContainer}>
              {VOLUME_OPTIONS.map(renderVolumeOption)}
            </View>
          </View>
        </Animated.ScrollView>

        {/* Footer */}
        <View style={styles.buttonContainer}>
          <Button
            title="Continue"
            onPress={handleNext}
            backgroundColor={Colors.primary}
            textColor={Colors.secondary}
            borderRadius={30}
            paddingVertical={16}
            fontSize={Typography.button.fontSize}
            fontWeight={Typography.button.fontWeight}
            loading={isSubmitting}
            disabled={!isFormValid || isSubmitting}
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
    flex: 1 },
  scrollContentContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl },
  title: {
    fontSize: 34,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    letterSpacing: -0.5,
    lineHeight: 38 },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 24,
    marginBottom: Spacing.lg },
  section: {
    marginBottom: Spacing.xl },
  sectionTitle: {
    fontSize: Typography.bodyLg.fontSize,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.md },
  optionsContainer: {
    gap: Spacing.sm },
  optionItem: {
    height: 48,
    justifyContent: "center",
    paddingHorizontal: Spacing.md,
    backgroundColor: isDark ? Colors.surface : 'white',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm },
  optionItemSelected: {
    borderColor: Colors.primary,
    backgroundColor: isDark ? Colors.white10 : '#FAFCF8' },
  optionLabel: {
    fontSize: Typography.body.fontSize,
    color: Colors.textSecondary },
  optionLabelSelected: {
    color: Colors.textPrimary,
    fontWeight: "500" },
  buttonContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg } });
}


