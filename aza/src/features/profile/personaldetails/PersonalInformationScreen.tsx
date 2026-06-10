import React, { useState, useEffect, useCallback } from "react";
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
  ScrollView,
  ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from '@react-native-vector-icons/feather';
import { AntDesign } from '@react-native-vector-icons/ant-design';
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from "../../../theme";
import Button from "../../../components/ui/Button";
import { useProfile } from "../../../providers/ProfileProvider";
import { useToast } from "../../../providers/ToastProvider";
import { checkHandleAvailability, suggestHandles } from "../../../services/api";
import { debounce } from "lodash";
import { CloseButton } from '../../../components/ui/CloseButton';

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
  const isDark = Colors.isDark;
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
          underlineColorAndroid="transparent"
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
  const { 
    firstName, 
    lastName, 
    dateOfBirth, 
    phone, 
    homeAddress, 
    city, 
    nationality,
    handle,
    setHandle 
  } = useProfile();
  const { showToast } = useToast();
  const [username, setUsername] = useState(handle ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  
  const [isValidating, setIsValidating] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const scrollY = React.useRef(new Animated.Value(0)).current;

  // Parse date of birth
  const dob = dateOfBirth ? new Date(dateOfBirth) : null;
  const dobDay = dob ? dob.getDate().toString() : "—";
  const dobMonth = dob ? dob.toLocaleString('default', { month: 'long' }) : "—";
  const dobYear = dob ? dob.getFullYear().toString() : "—";

  // Sync if handle loads after mount
  useEffect(() => {
    if (handle && username === "") setUsername(handle);
  }, [handle]);

  const validateHandle = useCallback(
    debounce(async (text: string) => {
      if (text.length < 3) {
        setIsAvailable(null);
        setIsValidating(false);
        return;
      }
      if (text === handle) {
        setIsAvailable(null);
        setError(null);
        setSuggestions([]);
        setIsValidating(false);
        return;
      }

      try {
        const response = await checkHandleAvailability(text);
        setIsAvailable(response.data.data);
        if (!response.data.data) {
          setError("This username is already taken");
          fetchSuggestions();
        } else {
          setError(null);
        }
      } catch (err) {
        console.error("Error checking username:", err);
      } finally {
        setIsValidating(false);
      }
    }, 500),
    [handle]
  );

  const fetchSuggestions = async () => {
    try {
      const response = await suggestHandles(firstName ?? "", lastName ?? "");
      setSuggestions(response.data.data || []);
    } catch (err) {
      console.error("Error fetching suggestions:", err);
    }
  };

  useEffect(() => {
    if (username !== handle && username.length >= 3) {
      setIsValidating(true);
      validateHandle(username);
    } else {
      setIsAvailable(null);
      setError(null);
      setSuggestions([]);
    }
  }, [username, handle, validateHandle]);

  const onUsernameChange = (text: string) => {
    const cleaned = text.toLowerCase().replace(/[^a-z0-9_]/g, "");
    setUsername(cleaned);
  };

  const selectSuggestion = (s: string) => {
    setUsername(s);
    setSuggestions([]);
  };

  const isFormValid = username.length >= 3 && (username === handle || (isAvailable === true && !isValidating));

  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [40, 70],
    outputRange: [0, 1],
    extrapolate: "clamp" });

  const headerBorderOpacity = scrollY.interpolate({
    inputRange: [40, 70],
    outputRange: [0, 1],
    extrapolate: "clamp" });

  const handleSave = async () => {
    if (!isFormValid) return;
    setIsSaving(true);
    try {
      const sanitizedHandle = username.trim().toLowerCase().replace(/^@/, "");
      await setHandle(sanitizedHandle);
      showToast('Changes saved', 'success');
      navigation.goBack();
    } catch {
      showToast('Failed to save changes. Please try again.', 'error');
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
        <CloseButton onPress={() => navigation.goBack()} size={24} />
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
              <TextInput style={styles.input} value={nationality ?? "N/A"} editable={false} />
              <Feather
                name="chevron-down"
                size={20}
                color={Colors.textSecondary}
              />
            </View>
          </View>

            <View style={styles.divider} />
          <Text style={styles.sectionHeading}>Personal details</Text>

          <ReadOnlyInput label="Full legal first and middle name(s)" value={firstName ?? "—"} placeholder="Provided after verification" />
          <ReadOnlyInput label="Full legal last name(s)" value={lastName ?? "—"} placeholder="Provided after verification" />

          <View style={styles.inputSection}>
            <View style={styles.labelWithIcon}>
              <Text style={styles.label}>Username</Text>
              <TouchableOpacity onPress={() => setShowTooltip(!showTooltip)} activeOpacity={0.7} accessibilityLabel="What is a username?">
                <Feather name="help-circle" size={16} color={Colors.textSecondary} style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            </View>
            {showTooltip && (
              <View style={styles.tooltipContainer}>
                <Text style={styles.tooltipText}>
                  Your username is your unique @username on AZA.
                </Text>
              </View>
            )}
            <View style={[
              styles.inputContainer,
              isAvailable === true && styles.inputSuccess,
              isAvailable === false && styles.inputError
            ]}>
              <Text style={{ ...Typography.bodyLg, color: Colors.textPrimary, marginRight: 2 }}>@</Text>
              <TextInput
                underlineColorAndroid="transparent"
                style={styles.input}
                value={username}
                onChangeText={onUsernameChange}
                placeholder="username"
                placeholderTextColor={Colors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {isValidating && <ActivityIndicator size="small" color={Colors.primary} />}
              {!isValidating && isAvailable === true && (
                <Feather name="check-circle" size={20} color={Colors.success} />
              )}
              {!isValidating && isAvailable === false && (
                <Feather name="alert-circle" size={20} color={Colors.error} />
              )}
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {suggestions.length > 0 && isAvailable === false && (
              <View style={styles.suggestionsContainer}>
                <Text style={styles.suggestionsLabel}>Suggested usernames:</Text>
                <View style={styles.suggestionsList}>
                  {suggestions.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={styles.suggestionBadge}
                      onPress={() => selectSuggestion(s)}
                    >
                      <Text style={styles.suggestionText}>@{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>

          <View style={styles.inputSection}>
            <Text style={styles.label}>Date of birth</Text>
            <View style={styles.row}>
              <View style={[styles.dateInput, styles.readOnlyContainer]}>
                <Text style={styles.dateLabel}>Day</Text>
                <Text style={styles.dateValue}>{dobDay}</Text>
              </View>
              <View style={[styles.dateInputLarge, styles.readOnlyContainer]}>
                <Text style={styles.dateLabel}>Month</Text>
                <View style={styles.rowBetween}>
                  <Text style={styles.dateValue}>{dobMonth}</Text>
                </View>
              </View>
              <View style={[styles.dateInput, styles.readOnlyContainer]}>
                <Text style={styles.dateLabel}>Year</Text>
                <Text style={styles.dateValue}>{dobYear}</Text>
              </View>
            </View>
          </View>

          <ReadOnlyInput label="Phone number" value={phone ?? 'Not set'} />


          <View style={styles.inputSection}>
            <View style={styles.divider} />
          </View>
          <Text style={styles.sectionHeading}>Address</Text>

          <ReadOnlyInput label="Home address" value={homeAddress ?? "—"} placeholder="Provided after verification" />
          <ReadOnlyInput label="City" value={city ?? "—"} placeholder="Provided after verification" />

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
            disabled={isSaving || !isFormValid}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
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
    backgroundColor: isDark ? Colors.white10 : "rgba(22,51,0,0.04)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
    borderRadius: 22,
  },
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
  tooltipContainer: {
    backgroundColor: isDark ? Colors.surface : Colors.background,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tooltipText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
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
  inputSuccess: {
    borderColor: Colors.success,
  },
  inputError: {
    borderColor: Colors.error,
  },
  errorText: {
    fontSize: 14,
    color: Colors.error,
    marginTop: 4,
    marginBottom: Spacing.sm,
  },
  suggestionsContainer: {
    marginTop: Spacing.sm,
  },
  suggestionsLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  suggestionsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  suggestionBadge: {
    backgroundColor: isDark ? Colors.white10 : "rgba(0,0,0,0.05)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  suggestionText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: "500",
  },
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


