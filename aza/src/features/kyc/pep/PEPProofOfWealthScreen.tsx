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
import * as DocumentPicker from "expo-document-picker";
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from "../../../theme";
import Button from "../../../components/ui/Button";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "PEPProofOfWealth">;

type DocumentType = "Bank Statement" | "Asset Declaration Form" | "Recent Payslip" | "Tax Return";

const DOC_TYPES: DocumentType[] = [
  "Asset Declaration Form",
  "Bank Statement",
  "Recent Payslip",
  "Tax Return"
];

export default function PEPProofOfWealthScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.background === '#121212';
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();
  const [docType, setDocType] = useState<DocumentType | null>(null);
  const [fileUploaded, setFileUploaded] = useState<boolean>(false);
  const [fileDetails, setFileDetails] = useState<{ name: string; size: string } | null>(null);
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
    // Proceed to standard KYC part of the EDD flow
    navigation.navigate("VerifyIdentity", { isPEP: true });
  };

  const handleSelectDocument = async () => {
    if (!docType) {
      // Unlikely to hit if button is managed correctly, but safety check
      console.log("No document type selected");
      return;
    }

    try {
      console.log("Launching document picker...");
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*", // Using wildcard for maximum compatibility during debugging
        copyToCacheDirectory: true });

      console.log("Picker result:", result);

      if (!result.canceled && result.assets && result.assets[0]) {
        const file = result.assets[0];
        const sizeInMb = file.size ? (file.size / (1024 * 1024)).toFixed(2) + " MB" : "Size unknown";
        setFileDetails({ name: file.name, size: sizeInMb });
        setFileUploaded(true);
      }
    } catch (err) {
      console.log("DocumentPicker Error: ", err);
    }
  };

  const removeFile = () => {
    setFileUploaded(false);
    setFileDetails(null);
  };

  const renderOption = (label: DocumentType) => (
    <TouchableOpacity
      key={label}
      style={[
        styles.optionItem,
        docType === label && styles.optionItemSelected,
      ]}
      onPress={() => setDocType(label)}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.optionLabel,
          docType === label && styles.optionLabelSelected,
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
              Proof of Wealth
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
          <Text style={styles.title}>Proof of Wealth</Text>
          <Text style={styles.subtitle}>
            Please upload a recent document that corroborates your declared source of wealth. This is securely stored and strictly used for compliance review.
          </Text>

          <Text style={styles.label}>Select Document Type</Text>
          <View style={styles.optionsContainer}>
            {DOC_TYPES.map(renderOption)}
          </View>

          <View style={styles.uploadSection}>
            <Text style={styles.label}>Upload File</Text>
            
            {!fileUploaded ? (
              <TouchableOpacity 
                style={[styles.uploadBox, !docType && styles.uploadBoxDisabled]} 
                onPress={handleSelectDocument}
                disabled={!docType}
              >
                <MaterialIcons 
                  name="cloud-upload" 
                  size={32} 
                  color={docType ? Colors.primary : Colors.textSecondary} 
                />
                <Text style={[styles.uploadBoxText, !docType && styles.uploadBoxTextDisabled]}>
                  {docType ? "Tap to select a document" : "Select a document type first"}
                </Text>
                {docType && <Text style={styles.uploadHint}>JPG, PNG, or PDF up to 10MB</Text>}
              </TouchableOpacity>
            ) : (
              <View style={styles.fileCard}>
                <View style={styles.fileDetailsRow}>
                  <MaterialIcons name="insert-drive-file" size={24} color={Colors.primary} />
                  <View style={styles.fileTextContainer}>
                    <Text style={styles.fileName}>{fileDetails?.name || "wealth_corroboration.pdf"}</Text>
                    <Text style={styles.fileSize}>{fileDetails?.size || "2.4 MB"}</Text>
                  </View>
                  <TouchableOpacity onPress={removeFile}>
                    <MaterialIcons name="close" size={24} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

        </Animated.ScrollView>

        {/* Footer */}
        <View style={styles.buttonContainer}>
          <Button
            title="Submit Verification"
            onPress={handleNext}
            backgroundColor={Colors.primary}
            textColor={Colors.secondary}
            borderRadius={30}
            paddingVertical={16}
            fontSize={Number(Typography.button.fontSize)}
            fontWeight={Typography.button.fontWeight}
            disabled={!docType || !fileUploaded}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.background === '#121212';
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
    marginBottom: Spacing.xl },
  label: {
    fontSize: Typography.bodyLg.fontSize,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.md },
  optionsContainer: {
    gap: Spacing.sm,
    marginBottom: Spacing.xl },
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
  uploadSection: {
    marginBottom: Spacing.xl },
  uploadBox: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    padding: Spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: isDark ? Colors.surface : "#FAFAFA" },
  uploadBoxText: {
    fontSize: Typography.bodyLg.fontSize,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginTop: Spacing.sm },
  uploadBoxDisabled: {
    backgroundColor: isDark ? Colors.background : "#F3F4F6",
    borderColor: isDark ? Colors.border : "#D1D5DB",
    borderStyle: "solid" },
  uploadBoxTextDisabled: {
    color: Colors.textSecondary },
  uploadHint: {
    fontSize: Typography.caption.fontSize,
    color: Colors.textSecondary,
    marginTop: Spacing.xs },
  fileCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    backgroundColor: isDark ? Colors.surface : 'white' },
  fileDetailsRow: {
    flexDirection: "row",
    alignItems: "center" },
  fileTextContainer: {
    flex: 1,
    marginLeft: Spacing.md },
  fileName: {
    fontSize: Typography.bodyLg.fontSize,
    fontWeight: "500",
    color: Colors.textPrimary },
  fileSize: {
    fontSize: Typography.caption.fontSize,
    color: Colors.textSecondary,
    marginTop: 2 },
  buttonContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg } });
}


