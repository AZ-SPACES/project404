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
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from "../../../theme";
import Button from "../../../components/ui/Button";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "PEPStatus">;

type PEPOptions = "No, I am not" | "Yes, I am a Politically Exposed Person" | "Yes, I am a family member or close associate of a PEP";

const PEP_OPTIONS: PEPOptions[] = [
  "No, I am not",
  "Yes, I am a Politically Exposed Person",
  "Yes, I am a family member or close associate of a PEP"
];

export default function PEPStatusScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();
  const [selectedOption, setSelectedOption] = useState<PEPOptions | null>(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [40, 70],
    outputRange: [0, 1],
    extrapolate: "clamp" });

  const headerBorderOpacity = scrollY.interpolate({
    inputRange: [40, 70],
    outputRange: [0, 1],
    extrapolate: "clamp" });

  const handleNext = () => {
    if (selectedOption === "No, I am not") {
      navigation.navigate("VerifyIdentity", { isPEP: false });
    } else {
      navigation.navigate("PEPDetails");
    }
  };

  const renderOption = (label: PEPOptions) => (
    <TouchableOpacity
      key={label}
      style={[
        styles.optionItem,
        selectedOption === label && styles.optionItemSelected,
      ]}
      onPress={() => setSelectedOption(label)}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.optionLabel,
          selectedOption === label && styles.optionLabelSelected,
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
              PEP Status
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
          <Text style={styles.title}>Are you a Politically Exposed Person (PEP)?</Text>
          <Text style={styles.subtitle}>
            A Politically Exposed Person (PEP) is an individual who is or has been entrusted with a prominent public function, such as a senior politician, a senior government, judicial or military official, a senior executive of a state-owned corporation, or an important political party official, as well as their family members and close associates.
          </Text>

          <View style={styles.optionsContainer}>
            {PEP_OPTIONS.map(renderOption)}
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
            disabled={selectedOption === null}
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
  subtitle:{
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 24,
    marginBottom: Spacing.xl },
  optionsContainer: {
    gap: Spacing.sm },
  optionItem: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    backgroundColor: isDark ? Colors.surface : 'white',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm },
  optionItemSelected: {
    borderColor: Colors.primary,
    backgroundColor: isDark ? Colors.white10 : '#FAFCF8' },
  optionLabel: {
    fontSize: 14,
    color: Colors.textSecondary },
  optionLabelSelected: {
    color: Colors.textPrimary,
    fontWeight: "500" },
  buttonContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg } });
}


