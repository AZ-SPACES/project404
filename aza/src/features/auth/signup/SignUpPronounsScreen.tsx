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
  ScrollView,
  Animated,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {  useAppTheme, ThemeColors, Typography, Spacing, Radius  } from "../../../theme";
import Button from "../../../components/ui/Button";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";
import { useSignUp } from "../../../providers/SignUpProvider";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "SignUpPronouns">;

export default function SignUpPronounsScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.background === '#121212';
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

  const handleNext = () => {
    // Navigate to the next screen in the signup flow
    navigation.navigate("SignUpEmployment");
  };

  const handleSkip = () => {
    // Navigate without saving
    navigation.navigate("SignUpEmployment");
  };

  const isFormValid =
    (data.pronoun !== null && data.pronoun !== "custom") ||
    (data.pronoun === "custom" && data.customPronoun.trim().length > 0);

  const renderOption = (label: string, id: "he/his" | "she/her" | "they/them") => (
    <TouchableOpacity
      style={[
        styles.radioItem,
        data.pronoun === id && styles.radioItemSelected,
      ]}
      onPress={() => update({ pronoun: id })}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.radioCircle,
          data.pronoun === id && styles.radioCircleSelected,
        ]}
      />
      <Text
        style={[
          styles.radioLabel,
          data.pronoun === id && styles.radioLabelSelected,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

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
                Your pronouns
              </Text>
            </Animated.View>
            <TouchableOpacity onPress={handleSkip}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
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
            <Text style={styles.title}>What are your pronouns?</Text>
            <Text style={styles.subtitle}>
              Specifying pronouns helps us accurately understand your identity.
            </Text>

            <Text style={styles.label}>Your pronouns</Text>

            {renderOption("he/his", "he/his")}
            {renderOption("she/her", "she/her")}
            {renderOption("they/them", "they/them")}

            <Text style={styles.label}>Custom</Text>
            <View
              style={[
                styles.inputContainer,
                data.pronoun === "custom" && styles.inputContainerActive,
              ]}
            >
              <TextInput
                style={styles.input}
                placeholder="Add yours"
                placeholderTextColor={Colors.textSecondary}
                value={data.customPronoun}
                onChangeText={(text) => {
                  update({ customPronoun: text, ...(text.length > 0 ? { pronoun: "custom" } : {}) });
                }}
                onFocus={() => update({ pronoun: "custom" })}
                autoCapitalize="none"
              />
            </View>
          </Animated.ScrollView>

          {/* Footer */}
          <View style={styles.buttonContainer}>
            <Button
              title="Continue"
              onPress={handleNext}
              backgroundColor={Colors.primary}
              textColor={Colors.secondary}
              borderRadius={30}
              paddingVertical={16}
              fontSize={Number(Typography.button.fontSize)}
              fontWeight={Typography.button.fontWeight as any}
              disabled={!isFormValid}
            />
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.background === '#121212';
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
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 50,
    backgroundColor: isDark ? Colors.white10 : "rgba(22, 51, 0, 0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  skipText: {
    fontSize: Typography.bodyLg.fontSize,
    color: Colors.textSecondary,
    fontWeight: "500",
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
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginTop: Spacing.xs,
    paddingRight: Spacing.xl,
  },
  label: {
    fontSize: Typography.bodyLg.fontSize,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    marginTop: Spacing.xl,
  },
  radioItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    height: 46,
    backgroundColor: isDark ? Colors.surface : 'white',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    marginBottom: Spacing.md,
  },
  radioItemSelected: {
    borderColor: Colors.primary,
    backgroundColor: isDark ? Colors.white10 : "#FAFCF8",
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    marginRight: Spacing.sm,
  },
  radioCircleSelected: {
    backgroundColor: Colors.primary,
  },
  radioLabel: {
    fontSize: Typography.body.fontSize,
    color: Colors.textSecondary,
  },
  radioLabelSelected: {
    color: Colors.textPrimary,
    fontWeight: "500",
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
  inputContainerActive: {
    borderColor: Colors.primary,
    backgroundColor: isDark ? Colors.white10 : "#FAFCF8",
  },
  input: {
    flex: 1,
    fontSize: Typography.body.fontSize,
    color: Colors.textPrimary,
    height: "100%",
  },
  buttonContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
});
}


