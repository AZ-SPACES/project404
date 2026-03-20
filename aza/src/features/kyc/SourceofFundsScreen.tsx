import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors, Typography, Spacing, Radius } from "../../theme";
import Button from "../../components/ui/Button";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type SourceOptions =
  | "Salary/Employment Income"
  | "Business Profits"
  | "Personal Savings"
  | "Inheritance or Gifts"
  | "Sale of Assets"
  | "Investment Dividends"
  | "Pension / Retirement Distributions";

const SOURCE_OPTIONS: SourceOptions[] = [
  "Salary/Employment Income",
  "Business Profits",
  "Personal Savings",
  "Inheritance or Gifts",
  "Sale of Assets",
  "Investment Dividends",
  "Pension / Retirement Distributions"
];

export default function SourceofFundsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [selectedEmployment, setSelectedEmployment] =
    useState<SourceOptions | null>(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [40, 70],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const headerBorderOpacity = scrollY.interpolate({
    inputRange: [40, 70],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const handleNext = () => {
    navigation.navigate('Idtype')
  };

  const renderOption = (label: SourceOptions) => (
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
              Source of Funds
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
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
    marginRight: 44,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textPrimary,
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
  subtitle:{
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.xl,
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
