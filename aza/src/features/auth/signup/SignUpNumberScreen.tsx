import React, { useState, useCallback } from "react";
import { debounce } from "lodash";
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
  StatusBar,
  ActivityIndicator,
  Modal,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import {  useAppTheme, ThemeColors, Typography, Spacing, Radius  } from "../../../theme";
import Button from "../../../components/ui/Button";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";
import { isValidPhone } from "../../../utils/validation";
import { useSignUp } from "../../../providers/SignUpProvider";
import { checkPhoneAvailability } from "../../../services/api";
import { BackButton } from '../../../components/ui/BackButton';
import { getErrorStatus } from '../../../utils/errorUtils';
import SignUpProgressBar from '../../../components/ui/SignUpProgressBar';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "SignUpNumber">;

type CountryCode = { code: string; flag: string; name: string };

const COUNTRY_CODES: CountryCode[] = [
  { code: '+233', flag: '🇬🇭', name: 'Ghana' },
  { code: '+1',   flag: '🇺🇸', name: 'United States' },
  { code: '+44',  flag: '🇬🇧', name: 'United Kingdom' },
  { code: '+234', flag: '🇳🇬', name: 'Nigeria' },
  { code: '+27',  flag: '🇿🇦', name: 'South Africa' },
  { code: '+254', flag: '🇰🇪', name: 'Kenya' },
  { code: '+1',   flag: '🇨🇦', name: 'Canada' },
];

export default function SignUpNumberScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();
  const { data, update } = useSignUp();
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(
    COUNTRY_CODES.find(c => c.code === data.countryCode) ?? COUNTRY_CODES[0]!
  );
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  // The stored phone number is the local digits only; full number = code + localNumber.
  const localNumber = data.phoneNumber;
  const fullNumber = selectedCountry.code + localNumber.replace(/\D/g, '');

  const phoneError = (touched && localNumber.length > 0 && !isValidPhone(fullNumber))
    ? "Enter a valid phone number"
    : error;

  const validatePhone = useCallback(
    debounce(async (phone: string) => {
      if (!isValidPhone(phone)) {
        setIsAvailable(null);
        setIsValidating(false);
        return;
      }

      try {
        const response = await checkPhoneAvailability(phone);
        const available = response.data?.success && response.data?.data === true;
        setIsAvailable(available);
        if (!available) {
          setError("This phone number is already linked to an account.");
        } else {
          setError(null);
        }
      } catch (err: unknown) {
        if (getErrorStatus(err) === 409) {
          setIsAvailable(false);
          setError("This phone number is already linked to an account.");
        } else {
          console.error("Availability check failed", err);
        }
      } finally {
        setIsValidating(false);
      }
    }, 600),
    []
  );

  // Cancel in-flight debounce when the component unmounts.
  React.useEffect(() => () => validatePhone.cancel(), [validatePhone]);

  const handleNext = async () => {
    if (!isValidPhone(fullNumber)) return;
    if (isAvailable === false) return;

    // Debounce already confirmed availability — skip the redundant API call.
    if (isAvailable === true) {
      navigation.navigate("SignUpEmail");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await checkPhoneAvailability(fullNumber);
      if (response.data?.success && response.data?.data === true) {
        navigation.navigate("SignUpEmail");
      } else {
        setIsAvailable(false);
        setError("This phone number is already linked to an account.");
      }
    } catch (err: unknown) {
      if (getErrorStatus(err) === 409) {
        setIsAvailable(false);
        setError("This phone number is already linked to an account.");
      } else {
        console.error("Availability check failed", err);
        setError("Unable to verify phone number. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTextChange = (t: string) => {
    // Strip non-digit characters from local number input.
    const digits = t.replace(/\D/g, '');
    update({ phoneNumber: digits });
    setError(null);
    setIsAvailable(null);

    const full = selectedCountry.code + digits;
    if (isValidPhone(full)) {
      setIsValidating(true);
      validatePhone(full);
    } else {
      setIsValidating(false);
    }
  };

  const handleCountrySelect = (country: CountryCode) => {
    setSelectedCountry(country);
    setShowCountryPicker(false);
    setIsAvailable(null);
    setError(null);
    update({ countryCode: country.code });
    const full = country.code + localNumber.replace(/\D/g, '');
    if (isValidPhone(full)) {
      setIsValidating(true);
      validatePhone(full);
    }
  };

  const isButtonDisabled = !isValidPhone(fullNumber) || isAvailable === false || isValidating;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* Header */}
          <View style={styles.header}>
            <BackButton onPress={() => navigation.goBack()} />
          </View>

          <SignUpProgressBar step={1} total={10} />

          {/* Content */}
          <View style={styles.content}>
            <Text style={styles.title}>What's your mobile number?</Text>
            <Text style={styles.subtitle}>
              Your number will be used for signing into your account.
            </Text>
            <Text style={styles.label}>Your Phone Number</Text>
            <View style={[
              styles.inputContainer,
              isAvailable === true && styles.inputSuccess,
              isAvailable === false && styles.inputError,
            ]}>
              {/* Country code selector */}
              <TouchableOpacity
                style={styles.countryCodeButton}
                onPress={() => setShowCountryPicker(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
                <Text style={styles.countryCode}>{selectedCountry.code}</Text>
                <MaterialIcons name="arrow-drop-down" size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
              <View style={styles.countryDivider} />
              <TextInput
                underlineColorAndroid="transparent"
                style={styles.input}
                placeholder="000 000 0000"
                placeholderTextColor={Colors.textSecondary}
                value={localNumber}
                onChangeText={handleTextChange}
                onBlur={() => setTouched(true)}
                keyboardType="phone-pad"
                autoCapitalize="none"
                autoFocus
                cursorColor={Colors.primary}
                selectionColor={Colors.primary}
              />
              {isValidating && <ActivityIndicator size="small" color={Colors.primary} />}
              {!isValidating && isAvailable === true && (
                <MaterialIcons name="check-circle" size={20} color={Colors.success} />
              )}
              {!isValidating && isAvailable === false && (
                <MaterialIcons name="error" size={20} color={Colors.error} />
              )}
            </View>
            {phoneError ? <Text style={styles.errorText}>{phoneError}</Text> : null}
          </View>

          {/* Footer */}
          <View style={styles.buttonContainer}>
            <Button
              title="Next"
              onPress={handleNext}
              backgroundColor={Colors.primary}
              textColor={Colors.secondary}
              borderRadius={Radius.sm}
              paddingVertical={16}
              fontSize={Typography.button.fontSize}
              fontWeight={Typography.button.fontWeight}
              disabled={isButtonDisabled}
              loading={loading}
            />
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>

      {/* Country Code Picker Modal */}
      <Modal
        visible={showCountryPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCountryPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowCountryPicker(false)}
        />
        <View style={styles.pickerSheet}>
          <Text style={styles.pickerTitle}>Select country code</Text>
          <FlatList
            data={COUNTRY_CODES}
            keyExtractor={(item) => item.name}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.pickerItem,
                  selectedCountry.name === item.name && styles.pickerItemSelected,
                ]}
                onPress={() => handleCountrySelect(item)}
                activeOpacity={0.7}
              >
                <Text style={styles.pickerFlag}>{item.flag}</Text>
                <Text style={styles.pickerName}>{item.name}</Text>
                <Text style={styles.pickerCode}>{item.code}</Text>
                {selectedCountry.name === item.name && (
                  <MaterialIcons name="check" size={18} color={Colors.primary} />
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
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
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.xl,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
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
    backgroundColor: isDark ? Colors.surface : 'white',
  },
  countryCodeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingRight: Spacing.xs,
  },
  countryFlag: {
    fontSize: 20,
  },
  countryCode: {
    fontSize: Typography.body.fontSize,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginLeft: 4,
  },
  countryDivider: {
    width: 1,
    height: 22,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.sm,
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
  inputSuccess: {
    borderColor: Colors.success,
  },
  inputError: {
    borderColor: Colors.error,
  },
  errorText: {
    fontSize: 12,
    color: '#D1222E',
    marginTop: 4,
  },
  buttonContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  pickerSheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: 40,
    maxHeight: '55%',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  pickerItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  pickerItemSelected: {
    backgroundColor: isDark ? Colors.white10 : Colors.accent,
    marginHorizontal: -Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderRadius: 0,
  },
  pickerFlag: {
    fontSize: 24,
  },
  pickerName: {
    flex: 1,
    fontSize: Typography.bodyLg.fontSize,
    color: Colors.textPrimary,
  },
  pickerCode: {
    fontSize: Typography.body.fontSize,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
});
}
