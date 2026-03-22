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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors, Typography, Spacing, Radius } from "../../../theme";
import Button from "../../../components/ui/Button";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "TaxResidency">;

const NATIONALITIES = [
  "Ghanaian",
  "Nigerian",
  "Kenyan",
  "South African",
  "Ivorian",
  "Senegalese",
  "Ethiopian",
  "Tanzanian",
  "Rwandan",
  "Ugandan",
  "British",
  "American",
  "Canadian",
  "French",
  "German",
  "Other",
];

type YesNo = "Yes" | "No" | null;

export default function TaxResidencyScreen() {
  const navigation = useNavigation<NavigationProp>();
  const scrollY = useRef(new Animated.Value(0)).current;

  const [nationality, setNationality] = useState<string | null>(null);
  const [showNationalityPicker, setShowNationalityPicker] = useState(false);
  const [isTaxResidentAbroad, setIsTaxResidentAbroad] = useState<YesNo>(null);
  const [taxCountry, setTaxCountry] = useState("");
  const [isUSPerson, setIsUSPerson] = useState<YesNo>(null);

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

  const isFormValid =
    nationality !== null &&
    isTaxResidentAbroad !== null &&
    isUSPerson !== null &&
    (isTaxResidentAbroad === "No" || taxCountry.trim().length > 0);

  const handleNext = () => {
    navigation.navigate("SignUpPronouns");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
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
            <Animated.View
              style={[styles.headerTitleContainer, { opacity: headerTitleOpacity }]}
            >
              <Text style={styles.headerTitle} numberOfLines={1}>
                Tax Residency
              </Text>
            </Animated.View>
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
            scrollEventThrottle={10}
          >
            <Text style={styles.title}>Tax residency</Text>
            <Text style={styles.subtitle}>
              We are required by law to collect this information under FATCA and
              Common Reporting Standards (CRS) obligations.
            </Text>

            {/* Nationality */}
            <Text style={styles.label}>Nationality</Text>
            <TouchableOpacity
              style={styles.selector}
              onPress={() => setShowNationalityPicker(!showNationalityPicker)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.selectorText,
                  !nationality && styles.selectorPlaceholder,
                ]}
              >
                {nationality ?? "Select nationality"}
              </Text>
              <MaterialIcons
                name={showNationalityPicker ? "expand-less" : "expand-more"}
                size={22}
                color={Colors.textSecondary}
              />
            </TouchableOpacity>

            {showNationalityPicker && (
              <View style={styles.pickerList}>
                {NATIONALITIES.map((item) => (
                  <TouchableOpacity
                    key={item}
                    style={[
                      styles.pickerItem,
                      nationality === item && styles.pickerItemSelected,
                    ]}
                    onPress={() => {
                      setNationality(item);
                      setShowNationalityPicker(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        nationality === item && styles.pickerItemTextSelected,
                      ]}
                    >
                      {item}
                    </Text>
                    {nationality === item && (
                      <MaterialIcons name="check" size={18} color={Colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Tax resident outside Ghana */}
            <Text style={styles.label}>
              Are you a tax resident outside Ghana?
            </Text>
            <Text style={styles.helperText}>
              You may be a tax resident in another country if you live, work, or
              have financial ties there.
            </Text>
            <View style={styles.yesNoRow}>
              {(["No", "Yes"] as const).map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.yesNoOption,
                    isTaxResidentAbroad === opt && styles.yesNoOptionSelected,
                  ]}
                  onPress={() => {
                    setIsTaxResidentAbroad(opt);
                    if (opt === "No") setTaxCountry("");
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.yesNoText,
                      isTaxResidentAbroad === opt && styles.yesNoTextSelected,
                    ]}
                  >
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {isTaxResidentAbroad === "Yes" && (
              <View style={styles.inputContainer}>
                <MaterialIcons
                  name="public"
                  size={20}
                  color={Colors.primary}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Country of tax residence"
                  placeholderTextColor={Colors.textSecondary}
                  value={taxCountry}
                  onChangeText={setTaxCountry}
                  autoCapitalize="words"
                />
              </View>
            )}

            {/* FATCA — US Person */}
            <Text style={styles.label}>
              Are you a US person?
            </Text>
            <Text style={styles.helperText}>
              A US person includes US citizens, green card holders, and anyone
              who meets the IRS "substantial presence" test.
            </Text>
            <View style={styles.yesNoRow}>
              {(["No", "Yes"] as const).map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.yesNoOption,
                    isUSPerson === opt && styles.yesNoOptionSelected,
                  ]}
                  onPress={() => setIsUSPerson(opt)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.yesNoText,
                      isUSPerson === opt && styles.yesNoTextSelected,
                    ]}
                  >
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.legalNote}>
              <MaterialIcons name="info-outline" size={16} color={Colors.textSecondary} />
              <Text style={styles.legalNoteText}>
                This information may be shared with the Ghana Revenue Authority
                (GRA) and relevant foreign tax authorities as required by law.
              </Text>
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
              disabled={!isFormValid}
            />
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: Typography.bodyLg.fontSize,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  helperText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: Spacing.sm,
  },
  selector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.white,
  },
  selectorText: {
    fontSize: Typography.bodyLg.fontSize,
    color: Colors.textPrimary,
  },
  selectorPlaceholder: {
    color: Colors.textSecondary,
  },
  pickerList: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    backgroundColor: Colors.white,
    marginTop: Spacing.xs,
    overflow: "hidden",
  },
  pickerItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  pickerItemSelected: {
    backgroundColor: "#FAFCF8",
  },
  pickerItemText: {
    fontSize: Typography.bodyLg.fontSize,
    color: Colors.textSecondary,
  },
  pickerItemTextSelected: {
    color: Colors.textPrimary,
    fontWeight: "500",
  },
  yesNoRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  yesNoOption: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.white,
  },
  yesNoOptionSelected: {
    borderColor: Colors.primary,
    backgroundColor: "#FAFCF8",
  },
  yesNoText: {
    fontSize: Typography.bodyLg.fontSize,
    color: Colors.textSecondary,
  },
  yesNoTextSelected: {
    color: Colors.textPrimary,
    fontWeight: "600",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    height: 48,
    backgroundColor: Colors.white,
    marginTop: Spacing.sm,
  },
  inputIcon: { marginRight: Spacing.sm },
  input: {
    flex: 1,
    fontSize: Typography.bodyLg.fontSize,
    color: Colors.textPrimary,
  },
  legalNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  legalNoteText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  buttonContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
});
