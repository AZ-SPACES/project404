import React, { useRef } from "react";
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
  ActivityIndicator,
  Alert
} from "react-native";
import * as Location from "expo-location";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import {  useAppTheme, ThemeColors, Typography, Spacing, Radius  } from "../../../theme";
import Button from "../../../components/ui/Button";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";
import { sanitizeText } from "../../../utils/validation";
import { useSignUp } from "../../../providers/SignUpProvider";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "SignUpAddress">;

export default function SignUpAddressScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();
  const { data, update } = useSignUp();
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

  const [isDetecting, setIsDetecting] = React.useState(false);

  const handleNext = () => {
    // Navigate to the next screen in the signup flow
    navigation.navigate("TaxResidency");
  };

  const handleDetectLocation = async () => {
    try {
      setIsDetecting(true);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Please enable location services in your settings to use this feature."
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const reverseGeocode = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (reverseGeocode.length > 0) {
        const addr = reverseGeocode[0];
        if (addr) {
          const streetAddress = [
            addr.streetNumber,
            addr.street,
            addr.district
          ].filter(Boolean).join(" ");

          update({
            homeAddress: streetAddress || addr.name || "",
            city: addr.city || addr.subregion || "",
          });
        }
      }
    } catch (error) {
      console.error("Location error:", error);
      Alert.alert("Error", "Could not detect your location. Please enter it manually.");
    } finally {
      setIsDetecting(false);
    }
  };

  const isFormValid = data.homeAddress.trim().length > 0 && data.city.trim().length > 0;

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
                Address
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
            <Text style={styles.title}>Enter your address</Text>
            <Text style={styles.subtitle}>
              Enter the address you live in most of the time. We may need to ask
              for proof of this address.
            </Text>

            <TouchableOpacity
              style={styles.detectLocationButton}
              onPress={handleDetectLocation}
              disabled={isDetecting}
            >
              {isDetecting ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <MaterialIcons name="my-location" size={18} color={Colors.primary} />
              )}
              <Text style={styles.detectLocationText}>
                {isDetecting ? "Detecting location..." : "Use current location"}
              </Text>
            </TouchableOpacity>

            <Text style={styles.label}>Home address</Text>
            <View style={styles.inputContainer}>
              <MaterialIcons
                name="search"
                size={24}
                color={Colors.primary}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="603 Newtown Rd,Accra,Ghana"
                placeholderTextColor={Colors.textSecondary}
                value={data.homeAddress}
                onChangeText={(t) => update({ homeAddress: sanitizeText(t) })}
                autoCapitalize="words"
                autoFocus
                cursorColor={Colors.primary}
                selectionColor={Colors.primary}
              />
            </View>

            <Text style={styles.label}>City</Text>
            <View style={styles.inputContainer}>
              <MaterialIcons
                name="search"
                size={24}
                color={Colors.primary}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Accra"
                placeholderTextColor={Colors.textSecondary}
                value={data.city}
                onChangeText={(t) => update({ city: sanitizeText(t) })}
                autoCapitalize="words"
                cursorColor={Colors.primary}
                selectionColor={Colors.primary}
              />
            </View>

            <Text style={styles.disclaimerText}>
              By continuing, you confirm this address is correct.
            </Text>
          </Animated.ScrollView>

          {/* Footer */}
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
  },
  scrollContentContainer: {
    paddingHorizontal: Spacing.lg,
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
    height: 48,
    backgroundColor: isDark ? Colors.surface : 'white',
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
  disclaimerText: {
    fontSize: 13,
    color: Colors.textPrimary,
    textAlign: "center",
    marginTop: Spacing.lg,
    fontWeight: "400",
  },
  buttonContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  detectLocationButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  detectLocationText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.primary,
  },
});
}


