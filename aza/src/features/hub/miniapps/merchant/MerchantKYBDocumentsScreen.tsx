import React, { useState, useRef } from "react";
import {
  View,
  Text,
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
import { Feather } from "@expo/vector-icons";
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from "../../../../theme";
import Button from "../../../../components/ui/Button";
import KYCProgressBar from "../../../../components/ui/KYCProgressBar";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../../navigation/types";
import { submitKybFinal } from "../../../../services/api";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "MerchantKYBDocuments">;
type RoutePropType = RouteProp<RootStackParamList, "MerchantKYBDocuments">;

type DocumentType =
  | "BUSINESS_REGISTRATION"
  | "CERTIFICATE_OF_INCORPORATION"
  | "TAX_CERTIFICATE"
  | "OWNER_ID_FRONT"
  | "OWNER_ID_BACK"
  | "BANK_STATEMENT";

const DOCUMENTS: { type: DocumentType; label: string; required: boolean }[] = [
  { type: "BUSINESS_REGISTRATION", label: "Business Registration", required: true },
  { type: "CERTIFICATE_OF_INCORPORATION", label: "Certificate of Incorporation", required: false },
  { type: "TAX_CERTIFICATE", label: "Tax Certificate", required: false },
  { type: "OWNER_ID_FRONT", label: "Owner ID (Front)", required: true },
  { type: "OWNER_ID_BACK", label: "Owner ID (Back)", required: false },
  { type: "BANK_STATEMENT", label: "Bank Statement", required: false },
];

const REQUIRED_TYPES = DOCUMENTS.filter((d) => d.required).map((d) => d.type);

export default function MerchantKYBDocumentsScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RoutePropType>();
  const { merchantId } = route.params;

  const [uploaded, setUploaded] = useState<Set<DocumentType>>(new Set());
  const [submitting, setSubmitting] = useState(false);

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

  const requiredUploaded = REQUIRED_TYPES.every((type) => uploaded.has(type));

  const handleDocumentPress = (docType: DocumentType, label: string) => {
    const isUploaded = uploaded.has(docType);
    Alert.alert(
      isUploaded ? "Replace Document" : `Upload ${label}`,
      isUploaded
        ? `"${label}" is already uploaded. Would you like to replace it?`
        : `Simulate uploading "${label}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: isUploaded ? "Replace" : "Upload",
          onPress: () => {
            setUploaded((prev) => {
              const next = new Set(prev);
              next.add(docType);
              return next;
            });
          },
        },
      ]
    );
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await submitKybFinal();
      navigation.navigate("MerchantKYBSubmitted");
    } catch (err: any) {
      const message =
        err?.response?.data?.message ?? err?.message ?? "Something went wrong. Please try again.";
      Alert.alert("Error", message);
    } finally {
      setSubmitting(false);
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
              Upload documents
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
          <KYCProgressBar currentStep={4} totalSteps={4} label="Business Verification" />
          <Text style={styles.title}>Upload documents</Text>
          <Text style={styles.subtitle}>
            Upload clear photos or scans. PDF, JPG, and PNG accepted.
          </Text>

          <View style={styles.documentsContainer}>
            {DOCUMENTS.map((doc) => {
              const isUploaded = uploaded.has(doc.type);
              return (
                <TouchableOpacity
                  key={doc.type}
                  style={[styles.documentCard, isUploaded && styles.documentCardUploaded]}
                  onPress={() => handleDocumentPress(doc.type, doc.label)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`${doc.label}${doc.required ? ", required" : ", optional"}`}
                >
                  <View style={[styles.documentIconArea, isUploaded && styles.documentIconAreaUploaded]}>
                    {isUploaded ? (
                      <Feather name="check-circle" size={24} color={Colors.success} />
                    ) : (
                      <Feather name="upload" size={24} color={Colors.primary} />
                    )}
                  </View>
                  <View style={styles.documentInfo}>
                    <Text style={[styles.documentLabel, isUploaded && styles.documentLabelUploaded]}>
                      {doc.label}
                    </Text>
                    <View
                      style={[
                        styles.documentTag,
                        doc.required ? styles.documentTagRequired : styles.documentTagOptional,
                      ]}
                    >
                      <Text
                        style={[
                          styles.documentTagText,
                          doc.required
                            ? styles.documentTagTextRequired
                            : styles.documentTagTextOptional,
                        ]}
                      >
                        {doc.required ? "Required" : "Optional"}
                      </Text>
                    </View>
                  </View>
                  {isUploaded && (
                    <MaterialIcons name="check-circle" size={20} color={Colors.success} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.ScrollView>

        {/* Footer */}
        <View style={styles.buttonContainer}>
          <Button
            title="Submit Application"
            onPress={handleSubmit}
            backgroundColor={Colors.primary}
            textColor={Colors.secondary}
            borderRadius={Radius.sm}
            paddingVertical={16}
            fontSize={Typography.button.fontSize}
            fontWeight={Typography.button.fontWeight}
            loading={submitting}
            disabled={!requiredUploaded || submitting}
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
    documentsContainer: {
      marginTop: Spacing.xl,
      gap: Spacing.sm,
    },
    documentCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
      paddingVertical: 14,
      paddingHorizontal: Spacing.md,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: Radius.sm,
      backgroundColor: isDark ? Colors.surface : "white",
    },
    documentCardUploaded: {
      borderColor: Colors.success,
      backgroundColor: isDark ? Colors.white10 : "#F4FBF0",
    },
    documentIconArea: {
      width: 44,
      height: 44,
      borderRadius: Radius.sm,
      backgroundColor: isDark ? Colors.white10 : "rgba(22,51,0,0.04)",
      alignItems: "center",
      justifyContent: "center",
    },
    documentIconAreaUploaded: {
      backgroundColor: isDark ? Colors.white10 : "#E8F7E3",
    },
    documentInfo: {
      flex: 1,
      gap: 4,
    },
    documentLabel: {
      fontSize: Typography.bodyLg.fontSize,
      fontWeight: "500",
      color: Colors.textPrimary,
    },
    documentLabelUploaded: {
      color: Colors.success,
    },
    documentTag: {
      alignSelf: "flex-start",
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
    },
    documentTagRequired: {
      backgroundColor: isDark ? "rgba(209,34,46,0.15)" : "rgba(209,34,46,0.08)",
    },
    documentTagOptional: {
      backgroundColor: isDark ? Colors.white10 : "rgba(0,0,0,0.05)",
    },
    documentTagText: {
      fontSize: 11,
      fontWeight: "600",
    },
    documentTagTextRequired: {
      color: "#D1222E",
    },
    documentTagTextOptional: {
      color: Colors.textSecondary,
    },
    buttonContainer: {
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.lg,
    },
  });
}
