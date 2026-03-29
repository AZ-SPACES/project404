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
  ScrollView,
  Animated,
  StatusBar
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {  useAppTheme, ThemeColors, Typography, Spacing, Radius  } from "../../../theme";
import Button from "../../../components/ui/Button";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";
import { isValidName, sanitizeText } from "../../../utils/validation";
import { useSignUp } from "../../../providers/SignUpProvider";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "SignUpName">;

export default function SignUpNameScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.background === '#121212';
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();
  const { data, update } = useSignUp();
  const [firstTouched, setFirstTouched] = useState(false);
  const [lastTouched, setLastTouched] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  const firstNameError = firstTouched && data.firstName.length > 0 && !isValidName(data.firstName)
    ? "Only letters, spaces, hyphens and apostrophes allowed"
    : null;
  const lastNameError = lastTouched && data.lastName.length > 0 && !isValidName(data.lastName)
    ? "Only letters, spaces, hyphens and apostrophes allowed"
    : null;

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
    navigation.navigate("SignUpAddress");
  };

  const isFormValid = isValidName(data.firstName) && isValidName(data.lastName);

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
                What's your name?
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
            <Text style={styles.title}>What's your name?</Text>
            <Text style={styles.subtitle}>
              This will be the name we use to refer to you.
            </Text>

            <Text style={styles.label}>Firstname</Text>
            <View style={styles.inputContainer}>
              <MaterialIcons
                name="person-outline"
                size={24}
                color={Colors.primary}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="e.g. Kwame"
                placeholderTextColor={Colors.textSecondary}
                value={data.firstName}
                onChangeText={(t) => update({ firstName: sanitizeText(t) })}
                onBlur={() => setFirstTouched(true)}
                autoCapitalize="words"
                autoFocus
                cursorColor={Colors.primary}
                selectionColor={Colors.primary}
              />
            </View>
            {firstNameError ? <Text style={styles.errorText}>{firstNameError}</Text> : null}

            <Text style={styles.label}>Lastname</Text>
            <View style={styles.inputContainer}>
              <MaterialIcons
                name="person-outline"
                size={24}
                color={Colors.primary}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="e.g. Obeng"
                placeholderTextColor={Colors.textSecondary}
                value={data.lastName}
                onChangeText={(t) => update({ lastName: sanitizeText(t) })}
                onBlur={() => setLastTouched(true)}
                autoCapitalize="words"
              />
            </View>
            {lastNameError ? <Text style={styles.errorText}>{lastNameError}</Text> : null}
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
  errorText: {
    fontSize: 12,
    color: '#D1222E',
    marginTop: 4,
  },
  buttonContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
});
}


