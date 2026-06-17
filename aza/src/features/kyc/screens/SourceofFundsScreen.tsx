import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
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
import { useKYC, FundsSource } from '../../../providers/KYCProvider';
import { useToast } from '../../../providers/ToastProvider';
import { BackButton } from '../../../components/ui/BackButton';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'SourceofFund'>;
type SourceofFundRouteProp = RouteProp<RootStackParamList, "SourceofFund">;

type SourceOptions =
  | "Salary/Employment Income"
  | "Business Profits"
  | "Personal Savings"
  | "Inheritance or Gifts"
  | "Sale of Assets"
  | "Investment Dividends"
  | "Pension / Retirement Distributions"
  | "Other";

const SOURCE_OPTIONS: SourceOptions[] = [
  "Salary/Employment Income",
  "Business Profits",
  "Personal Savings",
  "Inheritance or Gifts",
  "Sale of Assets",
  "Investment Dividends",
  "Pension / Retirement Distributions",
  "Other"
];

export default function SourceofFundsScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<SourceofFundRouteProp>();
  const { isPEP } = route.params || {};
  usePreventScreenCapture();
  const { data, submitFundsSource, isSubmitting } = useKYC();
  const { showToast } = useToast();
  const [selectedOptions, setSelectedOptions] = useState<SourceOptions[]>(data.fundsSource as SourceOptions[]);
  const [otherText, setOtherText] = useState(data.otherFundsText);
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
      await submitFundsSource(selectedOptions as FundsSource[], otherText);
      navigation.navigate('Idtype', { isPEP: isPEP as boolean });
    } catch (error) {
      console.error('Failed to submit funds source:', error);
      showToast('Failed to submit source of funds. Please try again.', 'error');
    }
  };

  const isFormValid = selectedOptions.length > 0 && (!selectedOptions.includes("Other") || otherText.trim().length > 0);

  const toggleOption = (label: SourceOptions) => {
    setSelectedOptions((prev) => 
      prev.includes(label) ? prev.filter(item => item !== label) : [...prev, label]
    );
  };

  const renderOption = (label: SourceOptions) => {
    const isSelected = selectedOptions.includes(label);
    return (
      <View key={label}>
        <TouchableOpacity
          style={[
            styles.optionItem,
            isSelected && styles.optionItemSelected,
          ]}
          onPress={() => toggleOption(label)}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.optionLabel,
              isSelected && styles.optionLabelSelected,
            ]}
          >
            {label}
          </Text>
          {isSelected && (
            <MaterialIcons name="check" size={20} color={Colors.primary} />
          )}
        </TouchableOpacity>
        {label === "Other" && isSelected && (
          <TextInput
            underlineColorAndroid="transparent"
            style={styles.otherInput}
            placeholder="Please specify"
            placeholderTextColor={Colors.textSecondary}
            value={otherText}
            onChangeText={setOtherText}
            autoCapitalize="sentences"
            cursorColor={Colors.primary}
            selectionColor={Colors.primary}
          />
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 16 : 0}
        >
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
              Source of Funds
            </Text>
          </Animated.View>
        </Animated.View>

        {/* Content */}
        <Animated.ScrollView keyboardShouldPersistTaps="handled"
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContentContainer}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false },
          )}
          scrollEventThrottle={16}
        >
          <KYCProgressBar currentStep={2} totalSteps={6} label="Source of Income" />
          <Text style={styles.title}>Source of Funds</Text>
          <Text style={styles.subtitle}>To keep your account secure and comply with Bank of Ghana regulations, please select the primary source of your funds.</Text>

          <Text style={styles.label}>Employment</Text>

          <View style={styles.optionsContainer}>
            {SOURCE_OPTIONS.map(renderOption)}
          </View>
        </Animated.ScrollView>

        {/* Footer */}
        <View style={styles.buttonContainer}>
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
            disabled={!isFormValid || isSubmitting}
          />
        </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
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
    lineHeight: 32 },
  subtitle:{
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.xl },
  label: {
    fontSize: Typography.bodyLg.fontSize,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    marginTop: Spacing.sm },
  optionsContainer: {
    gap: Spacing.sm },
  optionItem: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
    marginBottom: Spacing.lg },
  otherInput: {
    marginTop: Spacing.xs,
    height: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: isDark ? Colors.surface : Colors.white,
    fontSize: Typography.bodyLg.fontSize,
    color: Colors.textPrimary } });
}


