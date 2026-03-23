import React, { useState } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";
import { Colors, Typography, Spacing, Radius } from "../../../theme";
import Button from "../../../components/ui/Button";

type NavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "ChangePhone"
>;

export function ChangePhoneScreen() {
  const navigation = useNavigation<NavigationProp>();
  const initialPhoneNumber = "245903854";
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber);
  const [countryCode, setCountryCode] = useState("+233");
  const scrollY = React.useRef(new Animated.Value(0)).current;

  const isChanged = phoneNumber !== initialPhoneNumber && phoneNumber.length > 0;

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

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

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
          <Feather name="chevron-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Animated.View
          style={[styles.headerTitleContainer, { opacity: headerTitleOpacity }]}
        >
          <Text style={[Typography.h3, styles.headerTitle]}>
            Change phone number
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
              Change phone number
            </Text>
          </View>

          <Text style={styles.subtitle}>
            We'll text another verification code to your new number to confirm
            it.
          </Text>

          <View style={styles.inputSection}>
            <Text style={styles.label}>Phone number</Text>
            <View style={styles.row}>
              <TouchableOpacity style={styles.countryPicker}>
                <Text style={styles.countryCode}>{countryCode}</Text>
                <Feather
                  name="chevron-down"
                  size={16}
                  color={Colors.textPrimary}
                />
              </TouchableOpacity>
              <View style={styles.phoneInputContainer}>
                <TextInput
                  style={styles.input}
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  keyboardType="phone-pad"
                  placeholder="XXXXXXXXX"
                  placeholderTextColor={Colors.textSecondary + "80"}
                />
              </View>
            </View>
          </View>
        </Animated.ScrollView>

        <View style={styles.footer}>
          <Button
            title="Continue"
            onPress={() => {}}
            backgroundColor={isChanged ? Colors.primary : Colors.surface}
            textColor={isChanged ? Colors.secondary : Colors.textSecondary}
            borderRadius={Radius.full}
            disabled={!isChanged}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    height: 60,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  titleSection: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
  },
  mainTitle: {
    color: Colors.textPrimary,
    fontSize: 32,
    fontWeight: "700",
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
  },
  subtitle: {
    ...Typography.bodyLg,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
    lineHeight: 22,
    paddingHorizontal: Spacing.lg,
  },
  inputSection: {
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  label: {
    ...Typography.caption,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  countryPicker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 52,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    gap: 4,
  },
  countryCode: {
    ...Typography.bodyLg,
    color: Colors.textPrimary,
  },
  phoneInputContainer: {
    flex: 1,
    height: 52,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    justifyContent: "center",
  },
  input: {
    ...Typography.bodyLg,
    color: Colors.textPrimary,
  },
  footer: {
    padding: Spacing.lg,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border + "20",
  },
});
