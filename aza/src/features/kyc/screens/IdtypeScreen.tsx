import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  TouchableOpacity,
  StyleSheet,
  Animated,
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
import { useKYC, IdType } from '../../../providers/KYCProvider';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Idtype'>;
type IdtypeRouteProp = RouteProp<RootStackParamList, "Idtype">;

// Defined ID Types
const ID_OPTIONS = [
  { label: "Ghana Card", value: "ghana_card", placeholder: "GHA-123456789-1", prefix: "GHA-", maxLength: 15, keyboardType: "numeric" as const },
  { label: "Passport", value: "passport", placeholder: "G1234567", prefix: "", maxLength: 9, keyboardType: "default" as const },
  { label: "Voter ID", value: "voter_id", placeholder: "1234567890", prefix: "", maxLength: 10, keyboardType: "numeric" as const },
  { label: "Driver's License", value: "drivers_license", placeholder: "12345678", prefix: "", maxLength: 12, keyboardType: "numeric" as const },
];

export default function IdtypeScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<IdtypeRouteProp>();
  const { isPEP } = route.params || {};
  usePreventScreenCapture();
  const { data, update } = useKYC();
  const [documentType, setDocumentType] = useState(
    data.idType ? (ID_OPTIONS.find(o => o.value === data.idType) ?? null) : null
  );
  const [idNumber, setIdNumber] = useState(data.idNumber);
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
    if (documentType) {
      update({ idType: documentType.value as IdType, idLabel: documentType.label, idNumber });
    }
    navigation.navigate("VerifyFaceId", { isPEP: isPEP as boolean });
  };

  const handleDocumentSelect = (item: typeof ID_OPTIONS[0]) => {
    setDocumentType(item);
    setIdNumber(item.prefix || "");
  };

  const handleIdChange = (text: string) => {
    if (!documentType) return;
    const prefix = documentType.prefix || "";

    if (documentType.value === "ghana_card") {
      // Remove all non-numeric characters from the input after the prefix
      let numbersOnly = text.replace(prefix, "").replace(/[^0-9]/g, "");
      
      // Auto-format: GHA-XXXXXXXXX-X
      let formatted = prefix;
      if (numbersOnly.length > 0) {
        if (numbersOnly.length <= 9) {
          formatted += numbersOnly;
        } else {
          formatted += numbersOnly.slice(0, 9) + "-" + numbersOnly.slice(9, 10);
        }
      }
      setIdNumber(formatted);
    } else if (documentType.keyboardType === "numeric") {
      // For other numeric types, just ensure numbers
      let numbersOnly = text.replace(/[^0-9]/g, "");
      setIdNumber(numbersOnly);
    } else {
      // Default behavior
      if (text.startsWith(prefix)) {
        setIdNumber(text);
      } else {
        setIdNumber(prefix);
      }
    }
  };

  const isFormValid = documentType !== null && idNumber.length > (documentType.prefix?.length || 5);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
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
                  outputRange: ["transparent", Colors.border] }) },
            ]}
          >
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} accessibilityLabel="Go back" accessibilityRole="button">
              <MaterialIcons name="chevron-left" size={28} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Animated.View style={[styles.headerTitleContainer, { opacity: headerTitleOpacity }]}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                Identity Verification
              </Text>
            </Animated.View>
          </Animated.View>

          <Animated.ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: false }
            )}
            scrollEventThrottle={16}
          >
            <KYCProgressBar currentStep={3} totalSteps={6} label="Select ID Type" />
            <Text style={styles.title}>What type of ID do you have?</Text>
            <Text style={styles.subtitle}>Select your document type and enter the ID number</Text>

            {/* Document Type Selector */}
            <Text style={styles.label}>Document type</Text>
            <View style={styles.optionsContainer}>
              {ID_OPTIONS.map((item) => {
                const isSelected = documentType?.value === item.value;
                return (
                  <TouchableOpacity
                    key={item.value}
                    style={[
                      styles.optionCard,
                      isSelected && styles.optionCardSelected
                    ]}
                    onPress={() => handleDocumentSelect(item)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={item.label}
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text style={[
                      styles.optionCardText,
                      isSelected && styles.optionCardTextSelected
                    ]}>
                      {item.label}
                    </Text>
                    {isSelected && (
                      <MaterialIcons name="check-circle" size={20} color={Colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ID Number Input */}
            <Text style={styles.label}>ID Number</Text>
            <View style={styles.inputContainer}>
              <MaterialIcons name="pin" size={24} color={Colors.primary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={documentType?.placeholder || "Select an ID type first"}
                placeholderTextColor={Colors.textSecondary}
                value={idNumber}
                onChangeText={handleIdChange}
                autoCorrect={false}
                editable={!!documentType}
                maxLength={documentType?.maxLength}
                keyboardType={documentType?.keyboardType || "default"}
              />
            </View>
          </Animated.ScrollView>



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
              disabled={!isFormValid}
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
    backgroundColor: Colors.background 
  },
  container: { 
    flex: 1 
  },
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
    borderRadius: 22, 
    backgroundColor: isDark ? Colors.white10 : 'rgba(0, 0, 0, 0.05)', 
    alignItems: "center", 
    justifyContent: "center" 
  },
  content: { 
    flex: 1, 
    paddingHorizontal: Spacing.lg 
  },
  title: { 
    fontSize: 32, 
    fontWeight: "700", 
    color: Colors.textPrimary, 
    marginTop: Spacing.md 
  },
  subtitle: { 
    fontSize: 16, 
    color: Colors.textSecondary, 
    marginBottom: Spacing.xl 
  },
  label: { 
    color: Colors.textPrimary, 
    fontSize: 16, 
    fontWeight: "600", 
    marginBottom: Spacing.xs, 
    marginTop: Spacing.lg 
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    height: 52,
    backgroundColor: isDark ? Colors.surface : 'white' },
  inputIcon: { 
    marginRight: Spacing.sm 
  },
  inputText: { 
    flex: 1, 
    fontSize: 16, 
    color: Colors.textPrimary 
  },
  input: { 
    flex: 1, fontSize: 16, 
    color: Colors.textPrimary 
  },
  buttonContainer: { 
    padding: Spacing.lg 
  },
  optionsContainer: {
    marginTop: Spacing.xs,
    gap: Spacing.sm },
  optionCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    backgroundColor: isDark ? Colors.surface : 'white' },
  optionCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: isDark ? Colors.white10 : '#FAFCF8' },
  optionCardText: {
    fontSize: 16,
    color: Colors.textPrimary },
  optionCardTextSelected: {
    fontWeight: "600",
    color: Colors.textPrimary } });
}


