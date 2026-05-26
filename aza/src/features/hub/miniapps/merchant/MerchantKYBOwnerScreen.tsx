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
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from "../../../../theme";
import Button from "../../../../components/ui/Button";
import KYCProgressBar from "../../../../components/ui/KYCProgressBar";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../../navigation/types";
import { submitMerchantKyb } from "../../../../services/api";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "MerchantKYBOwner">;
type RoutePropType = RouteProp<RootStackParamList, "MerchantKYBOwner">;

const ID_TYPES = [
  { value: "PASSPORT", label: "Passport", placeholder: "G1234567" },
  { value: "NATIONAL_ID", label: "National ID", placeholder: "GHA-XXXXXXXXX-X" },
  { value: "DRIVERS_LICENSE", label: "Driver's License", placeholder: "12345678" },
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
  const [ownerIdType, setOwnerIdType] = useState("NATIONAL_ID");
  const [ownerIdNumber, setOwnerIdNumber] = useState("");
  const [loading, setLoading] = useState(false);

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
      await submitMerchantKyb({
        businessType,
        registrationNumber,
        registeredAddress,
        city,
        taxIdNumber,
        website,
        ownerFullName: ownerFullName.trim(),
        ownerIdType,
        ownerIdNumber: ownerIdNumber.trim() || undefined,
      });
      navigation.navigate("MerchantKYBDocuments", { merchantId });
    } catch (err: any) {
      const message =
        err?.response?.data?.message ?? err?.message ?? "Something went wrong. Please try again.";
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
                About the owner
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
            <KYCProgressBar currentStep={3} totalSteps={4} label="Business Verification" />
            <Text style={styles.title}>About the owner</Text>
            <Text style={styles.subtitle}>
              We need the details of the primary owner or director.
            </Text>

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
