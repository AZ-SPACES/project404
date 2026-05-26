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
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { RouteProp, useRoute } from "@react-navigation/native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from "../../../../theme";
import Button from "../../../../components/ui/Button";
import KYCProgressBar from "../../../../components/ui/KYCProgressBar";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../../navigation/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "MerchantKYBBusiness">;
type RoutePropType = RouteProp<RootStackParamList, "MerchantKYBBusiness">;

const BUSINESS_TYPES = [
  { value: "SOLE_PROPRIETOR", label: "Sole Proprietorship" },
  { value: "PARTNERSHIP", label: "Partnership" },
  { value: "LIMITED_COMPANY", label: "Limited Company (LLC)" },
  { value: "NGO", label: "NGO / Non-Profit" },
  { value: "OTHER", label: "Other" },
];

export default function MerchantKYBBusinessScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RoutePropType>();
  const { merchantId } = route.params;

  const [businessType, setBusinessType] = useState("SOLE_PROPRIETOR");
  const [regNum, setRegNum] = useState("");
  const [taxId, setTaxId] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [website, setWebsite] = useState("");

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

  const handleContinue = () => {
    navigation.navigate("MerchantKYBOwner", {
      merchantId,
      businessType,
      registrationNumber: regNum.trim() || undefined,
      registeredAddress: address.trim() || undefined,
      city: city.trim() || undefined,
      taxIdNumber: taxId.trim() || undefined,
      website: website.trim() || undefined,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
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
              accessibilityLabel="Go back"
              accessibilityRole="button"
            >
              <MaterialIcons name="chevron-left" size={28} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Animated.View style={[styles.headerTitleContainer, { opacity: headerTitleOpacity }]}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                About your business
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
              { useNativeDriver: false }
            )}
            scrollEventThrottle={16}
          >
            <KYCProgressBar currentStep={2} totalSteps={4} label="Business Verification" />
            <Text style={styles.title}>About your business</Text>
            <Text style={styles.subtitle}>Tell us about your business structure.</Text>

            {/* Business Type */}
            <Text style={styles.label}>Business Type *</Text>
            <View style={styles.optionsContainer}>
              {BUSINESS_TYPES.map((item) => {
                const isSelected = businessType === item.value;
                return (
                  <TouchableOpacity
                    key={item.value}
                    style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                    onPress={() => setBusinessType(item.value)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={item.label}
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text
                      style={[
                        styles.optionCardText,
                        isSelected && styles.optionCardTextSelected,
                      ]}
                    >
                      {item.label}
                    </Text>
                    {isSelected && (
                      <MaterialIcons name="check-circle" size={20} color={Colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Registration Number */}
            <Text style={styles.label}>Registration Number</Text>
            <View style={styles.inputContainer}>
              <MaterialIcons name="pin" size={24} color={Colors.primary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="BN-XXXXXXXX"
                placeholderTextColor={Colors.textSecondary}
                value={regNum}
                onChangeText={setRegNum}
                autoCapitalize="characters"
                cursorColor={Colors.primary}
                selectionColor={Colors.primary}
              />
            </View>

            {/* Tax ID */}
            <Text style={styles.label}>Tax ID Number</Text>
            <View style={styles.inputContainer}>
              <MaterialIcons name="receipt" size={24} color={Colors.primary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="TIN-XXXXXXXXX"
                placeholderTextColor={Colors.textSecondary}
                value={taxId}
                onChangeText={setTaxId}
                autoCapitalize="characters"
                cursorColor={Colors.primary}
                selectionColor={Colors.primary}
              />
            </View>

            {/* Registered Address */}
            <Text style={styles.label}>Registered Address</Text>
            <View style={styles.inputContainer}>
              <MaterialIcons name="location-on" size={24} color={Colors.primary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="123 Main Street"
                placeholderTextColor={Colors.textSecondary}
                value={address}
                onChangeText={setAddress}
                cursorColor={Colors.primary}
                selectionColor={Colors.primary}
              />
            </View>

            {/* City */}
            <Text style={styles.label}>City</Text>
            <View style={styles.inputContainer}>
              <MaterialIcons name="location-city" size={24} color={Colors.primary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Accra"
                placeholderTextColor={Colors.textSecondary}
                value={city}
                onChangeText={setCity}
                cursorColor={Colors.primary}
                selectionColor={Colors.primary}
              />
            </View>

            {/* Website */}
            <Text style={styles.label}>Website</Text>
            <View style={styles.inputContainer}>
              <MaterialIcons name="language" size={24} color={Colors.primary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="https://yourbusiness.com"
                placeholderTextColor={Colors.textSecondary}
                value={website}
                onChangeText={setWebsite}
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
                cursorColor={Colors.primary}
                selectionColor={Colors.primary}
              />
            </View>
          </Animated.ScrollView>

          {/* Footer */}
          <View style={styles.buttonContainer}>
            <Button
              title="Continue"
              onPress={handleContinue}
              backgroundColor={Colors.primary}
              textColor={Colors.secondary}
              borderRadius={Radius.sm}
              paddingVertical={16}
              fontSize={Typography.button.fontSize}
              fontWeight={Typography.button.fontWeight}
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
      backgroundColor: isDark ? Colors.white10 : "rgba(22,51,0,0.04)",
      alignItems: "center",
      justifyContent: "center",
    },
    content: {
      flex: 1,
      paddingHorizontal: Spacing.lg,
    },
    scrollContentContainer: {
      paddingBottom: Spacing.xl,
    },
    title: {
      fontSize: 34,
      fontWeight: "700",
      color: Colors.textPrimary,
      marginBottom: Spacing.sm,
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: 16,
      color: Colors.textSecondary,
      lineHeight: 20,
    },
    label: {
      fontSize: Typography.bodyLg.fontSize,
      fontWeight: "600",
      color: Colors.textPrimary,
      marginBottom: Spacing.sm,
      marginTop: Spacing.xl,
    },
    optionsContainer: {
      gap: 8,
    },
    optionCard: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 14,
      paddingHorizontal: Spacing.md,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: Radius.sm,
      backgroundColor: isDark ? Colors.surface : "white",
    },
    optionCardSelected: {
      borderColor: Colors.primary,
      backgroundColor: isDark ? Colors.white10 : "#FAFCF8",
    },
    optionCardText: {
      fontSize: Typography.bodyLg.fontSize,
      color: Colors.textPrimary,
    },
    optionCardTextSelected: {
      fontWeight: "600",
      color: Colors.textPrimary,
    },
    inputContainer: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: Radius.sm,
      paddingHorizontal: Spacing.md,
      height: 52,
      backgroundColor: isDark ? Colors.surface : "white",
    },
    inputIcon: {
      marginRight: Spacing.sm,
    },
    input: {
      flex: 1,
      fontSize: Typography.bodyLg.fontSize,
      color: Colors.textPrimary,
      height: "100%",
    },
    buttonContainer: {
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.lg,
    },
  });
}
