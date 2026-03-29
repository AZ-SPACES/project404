import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, AntDesign } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from "../../../theme";
import Button from "../../../components/ui/Button";
import { useProfile } from "../../../providers/ProfileProvider";

type NavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "PersonalInformation"
>;

interface ReadOnlyInputProps {
  label: string;
  value: string;
  placeholder?: string;
  isDate?: boolean;
}



export function PersonalInformationScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.background === '#121212';
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);

  const ReadOnlyInput = ({
    label,
    value,
    placeholder,
    isDate }: ReadOnlyInputProps) => (
    <View style={styles.inputSection}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputContainer, styles.readOnlyContainer]}>
        <TextInput
          style={[styles.input, { color: Colors.textSecondary }]}
          value={value}
          placeholder={placeholder}
          editable={false}
        />
        {isDate && (
          <Feather name="chevron-down" size={20} color={Colors.textSecondary} />
        )}
      </View>
    </View>
  );

  const navigation = useNavigation<NavigationProp>();
  const { displayName, phone, setDisplayName } = useProfile();
  const [preferredName, setPreferredName] = useState(displayName ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const scrollY = React.useRef(new Animated.Value(0)).current;

  // Sync if displayName loads after mount
  useEffect(() => {
    if (displayName) setPreferredName(displayName);
  }, [displayName]);

  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [40, 70],
    outputRange: [0, 1],
    extrapolate: "clamp" });

  const headerBorderOpacity = scrollY.interpolate({
    inputRange: [40, 70],
    outputRange: [0, 1],
    extrapolate: "clamp" });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await setDisplayName(preferredName.trim());
      navigation.goBack();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" />

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
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
        >
          <AntDesign name="close" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Animated.View
          style={[styles.headerTitleContainer, { opacity: headerTitleOpacity }]}
        >
          <Text style={[Typography.h3, styles.headerTitle]}>
            Tell us about yourself
          </Text>
        </Animated.View>
        <View style={{ width: 40 }} />
      </Animated.View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <Animated.ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}
        >
          <View style={styles.titleSection}>
            <Text style={[Typography.h1, styles.mainTitle]}>
              Tell us about yourself
            </Text>
          </View>

          <Text style={styles.sectionHeading}>Country of residence</Text>
          <View style={styles.inputSection}>
            <View style={styles.inputContainer}>
              <TextInput style={styles.input} value="Ghana" editable={false} />
              <Feather
                name="chevron-down"
                size={20}
                color={Colors.textSecondary}
              />
            </View>
          </View>

          <View style={styles.inputSection}>
            <View style={styles.divider} />
          </View>
          <Text style={styles.sectionHeading}>Personal details</Text>

          <ReadOnlyInput label="Full legal first and middle name(s)" value="—" placeholder="Provided after verification" />
          <ReadOnlyInput label="Full legal last name(s)" value="—" placeholder="Provided after verification" />

          <View style={styles.inputSection}>
            <View style={styles.labelWithIcon}>
              <Text style={styles.label}>Preferred name (optional)</Text>
              <Feather name="help-circle" size={16} color={Colors.textSecondary} style={{ marginLeft: 4 }} />
            </View>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={preferredName}
                onChangeText={setPreferredName}
                placeholder="How should we call you?"
                placeholderTextColor={Colors.textSecondary}
              />
            </View>
          </View>

          <View style={styles.inputSection}>
            <Text style={styles.label}>Date of birth</Text>
            <View style={styles.row}>
              <View style={[styles.dateInput, styles.readOnlyContainer]}>
                <Text style={styles.dateLabel}>Day</Text>
                <Text style={styles.dateValue}>—</Text>
              </View>
              <View style={[styles.dateInputLarge, styles.readOnlyContainer]}>
                <Text style={styles.dateLabel}>Month</Text>
                <View style={styles.rowBetween}>
                  <Text style={styles.dateValue}>—</Text>
                </View>
              </View>
              <View style={[styles.dateInput, styles.readOnlyContainer]}>
                <Text style={styles.dateLabel}>Year</Text>
                <Text style={styles.dateValue}>—</Text>
              </View>
            </View>
          </View>

          <ReadOnlyInput label="Phone number" value={phone ?? 'Not set'} />

          <TouchableOpacity onPress={() => navigation.navigate("ChangePhone")}>
            <Text style={styles.linkText}>Change phone number</Text>
          </TouchableOpacity>

          <View style={styles.inputSection}>
            <View style={styles.divider} />
          </View>
          <Text style={styles.sectionHeading}>Address</Text>

          <ReadOnlyInput label="Home address" value="—" placeholder="Provided after verification" />
          <ReadOnlyInput label="City" value="—" placeholder="Provided after verification" />

          <Text style={styles.confirmationText}>
            By continuing, you confirm this address is correct.
          </Text>

          <View style={{ height: Spacing.xl }} />
        </Animated.ScrollView>

        <View style={styles.footer}>
          <Button
            title="Save"
            onPress={handleSave}
            backgroundColor={Colors.primary}
            textColor={Colors.secondary}
            borderRadius={Radius.full}
            loading={isSaving}
            disabled={isSaving}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.background === '#121212';
  return StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    height: 60 },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1 },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center" },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textPrimary },
  titleSection: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.xl },
  mainTitle: {
    color: Colors.textPrimary,
    fontSize: 32,
    fontWeight: "700" },
  scrollContent: {
    paddingBottom: Spacing.xl },
  sectionHeading: {
    ...Typography.body,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.lg },
  inputSection: {
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.lg },
  label: {
    ...Typography.caption,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginBottom: 4 },
  labelWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4 },
  inputContainer: {
    height: 52,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md },
  readOnlyContainer: {
    backgroundColor: Colors.surface + "50" },
  input: {
    flex: 1,
    ...Typography.bodyLg,
    color: Colors.textPrimary },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.lg,
    opacity: 0.5 },
  row: {
    flexDirection: "row",
    gap: Spacing.sm },
  dateInput: {
    flex: 1,
    height: 52,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    justifyContent: "center" },
  dateInputLarge: {
    flex: 2,
    height: 52,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    justifyContent: "center" },
  dateLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontSize: 10,
    position: "absolute",
    top: 4,
    left: 8 },
  dateValue: {
    ...Typography.bodyLg,
    color: Colors.textSecondary,
    marginTop: 8 },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center" },
  linkText: {
    ...Typography.body,
    fontWeight: "700",
    color: Colors.primary,
    textAlign: "center",
    textDecorationLine: "underline",
    marginVertical: Spacing.md },
  confirmationText: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.lg },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border + "20",
    backgroundColor: Colors.background } });
}


