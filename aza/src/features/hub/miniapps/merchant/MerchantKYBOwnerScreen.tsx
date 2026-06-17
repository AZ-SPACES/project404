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
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { RouteProp, useRoute } from "@react-navigation/native";
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from "../../../../theme";
import Button from "../../../../components/ui/Button";
import KYCProgressBar from "../../../../components/ui/KYCProgressBar";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../../navigation/types";
import { submitMerchantKyb, getKycStatus } from "../../../../services/api";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../../lib/queryKeys";
import { useProfile } from "../../../../providers/ProfileProvider";
import { BackButton } from '../../../../components/ui/BackButton';
import { extractErrorMessage } from '../../../../utils/errorUtils';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "MerchantKYBOwner">;
type RoutePropType = RouteProp<RootStackParamList, "MerchantKYBOwner">;

const ID_TYPES = [
  { value: "GHANA_CARD", label: "Ghana Card", placeholder: "GHA-XXXXXXXXX-X" },
  { value: "PASSPORT", label: "Passport", placeholder: "G1234567" },
  { value: "VOTER_ID", label: "Voter's ID", placeholder: "0123456789" },
  { value: "DRIVERS_LICENCE", label: "Driver's License", placeholder: "12345678" },
];

export default function MerchantKYBOwnerScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RoutePropType>();
  const {
    merchantId,
    businessType,
    registrationNumber,
    registeredAddress,
    city,
    taxIdNumber,
    website,
  } = route.params;

  const [ownerFullName, setOwnerFullName] = useState("");
  const [ownerIdType, setOwnerIdType] = useState("GHANA_CARD");
  const [ownerIdNumber, setOwnerIdNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [isPrimaryOwner, setIsPrimaryOwner] = useState<"yes" | "no" | null>(null);

  const { displayName } = useProfile();
  const { data: kycStatusData } = useQuery({
    queryKey: queryKeys.kycStatus(),
    queryFn: async () => { const res = await getKycStatus(); return res.data?.data ?? res.data; },
    staleTime: 5 * 60_000,
  });
  const kycIdType: string | null = kycStatusData?.idType ?? null;
  const kycIdNumber: string = kycStatusData?.idNumber ?? "";

  const handlePrimaryOwnerSelect = (value: "yes" | "no") => {
    setIsPrimaryOwner(value);
    if (value === "yes") {
      setOwnerFullName(displayName || "");
      let mappedType = "GHANA_CARD";
      if (kycIdType === 'passport') mappedType = "PASSPORT";
      if (kycIdType === 'drivers_license') mappedType = "DRIVERS_LICENCE";
      setOwnerIdType(mappedType);
      setOwnerIdNumber(kycIdNumber);
    } else {
      setOwnerFullName("");
      setOwnerIdType("GHANA_CARD");
      setOwnerIdNumber("");
    }
  };

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

  const selectedIdType = ID_TYPES.find((t) => t.value === ownerIdType);
  const idPlaceholder = selectedIdType?.placeholder ?? "Enter ID number";

  const isFormValid = ownerFullName.trim().length >= 2 && ownerIdType !== "";

  const handleContinue = async () => {
    setLoading(true);
    try {
      const payload: any = {
        businessType,
        ownerFullName: ownerFullName.trim(),
        ownerIdType,
      };
      if (registrationNumber) payload.registrationNumber = registrationNumber;
      if (registeredAddress) payload.registeredAddress = registeredAddress;
      if (city) payload.city = city;
      if (taxIdNumber) payload.taxIdNumber = taxIdNumber;
      if (website) payload.website = website;
      if (ownerIdNumber.trim()) payload.ownerIdNumber = ownerIdNumber.trim();

      await submitMerchantKyb(payload);
      navigation.navigate("MerchantKYBDocuments", { merchantId, isPrimaryOwner: isPrimaryOwner === "yes" });
    } catch (err: unknown) {
      const message =
        extractErrorMessage(err, "Something went wrong. Please try again.");
      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
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
            <BackButton onPress={() => navigation.goBack()} size={28} />
            <Animated.View style={[styles.headerTitleContainer, { opacity: headerTitleOpacity }]}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                About the owner
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
              { useNativeDriver: false }
            )}
            scrollEventThrottle={16}
          >
            <KYCProgressBar currentStep={3} totalSteps={4} label="Business Verification" />
            <Text style={styles.title}>About the owner</Text>
            <Text style={styles.subtitle}>
              We need the details of the primary owner or director.
            </Text>

            {/* Is Primary Owner */}
            <Text style={styles.label}>Are you the primary owner or director?</Text>
            <View style={styles.optionsContainer}>
              {[
                { value: "yes", label: "Yes, I am" },
                { value: "no", label: "No, someone else" },
              ].map((item) => {
                const isSelected = isPrimaryOwner === item.value;
                return (
                  <TouchableOpacity
                    key={item.value}
                    style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                    onPress={() => handlePrimaryOwnerSelect(item.value as "yes" | "no")}
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

            {/* Full Name */}
            <Text style={styles.label}>Full Name *</Text>
            <View style={styles.inputContainer}>
              <MaterialIcons
                name="person-outline"
                size={24}
                color={Colors.primary}
                style={styles.inputIcon}
              />
              <TextInput
                underlineColorAndroid="transparent"
                style={styles.input}
                placeholder="John Mensah"
                placeholderTextColor={Colors.textSecondary}
                value={ownerFullName}
                onChangeText={setOwnerFullName}
                autoCapitalize="words"
                cursorColor={Colors.primary}
                selectionColor={Colors.primary}
              />
            </View>

            {/* ID Type */}
            <Text style={styles.label}>ID Type *</Text>
            <View style={styles.optionsContainer}>
              {ID_TYPES.map((item) => {
                const isSelected = ownerIdType === item.value;
                return (
                  <TouchableOpacity
                    key={item.value}
                    style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                    onPress={() => setOwnerIdType(item.value)}
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

            {/* ID Number */}
            <Text style={styles.label}>ID Number</Text>
            <View style={styles.inputContainer}>
              <MaterialIcons name="pin" size={24} color={Colors.primary} style={styles.inputIcon} />
              <TextInput
                underlineColorAndroid="transparent"
                style={styles.input}
                placeholder={idPlaceholder}
                placeholderTextColor={Colors.textSecondary}
                value={ownerIdNumber}
                onChangeText={setOwnerIdNumber}
                autoCapitalize="characters"
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
              loading={loading}
              disabled={!isFormValid || loading}
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
    buttonContainer: {
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.lg,
    },
  });
}
