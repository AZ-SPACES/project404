import React, { useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  StatusBar
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";
import {  useAppTheme, ThemeColors, Typography, Spacing , Radius } from "../../../theme";
import Button from "../../../components/ui/Button";
import DateOfBirthCalendar from "../../../components/ui/DateOfBirthCalendar";
import { useSignUp } from "../../../providers/SignUpProvider";
import { BackButton } from '../../../components/ui/BackButton';
import SignUpProgressBar from '../../../components/ui/SignUpProgressBar';

const MIN_AGE = 18;

function isAtLeastMinAge(dateString: string): boolean {
  if (!dateString) return false;
  const dob = new Date(dateString);
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - MIN_AGE);
  return dob <= cutoff;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "SignUpBirthday">;

export default function SignUpBirthdayScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();
  const { data, update } = useSignUp();
  const [currentMonth, setCurrentMonth] = useState<string>("2004-07");
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

  // ── Stable callbacks ───────────────────────────────────────────────────────

  const handleDateSelect = useCallback((dateString: string) => {
    update({ dateOfBirth: dateString });
  }, [update]);

  const handleMonthChange = useCallback((dateString: string) => {
    setCurrentMonth(dateString);
  }, []);

  const handleNext = useCallback(() => {
    navigation.navigate("CreatePasscode");
  }, [navigation]);

  const handleBack = useCallback(() => navigation.goBack(), [navigation]);

  const ageError = data.dateOfBirth && !isAtLeastMinAge(data.dateOfBirth)
    ? `You must be at least ${MIN_AGE} years old to use aza.`
    : null;

  // Derived — avoids inline expression in JSX causing Button re-renders
  const isDisabled = useMemo(
    () => !data.dateOfBirth || !isAtLeastMinAge(data.dateOfBirth),
    [data.dateOfBirth],
  );

  // ── Render ─────────────────────────────────────────────────────────────────
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
          <BackButton onPress={handleBack} size={28} />
          <Animated.View
            style={[styles.headerTitleContainer, { opacity: headerTitleOpacity }]}
          >
            <Text style={styles.headerTitle} numberOfLines={1}>
              Date of birth
            </Text>
          </Animated.View>
        </Animated.View>

        <SignUpProgressBar step={10} total={10} />

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
          <Text style={styles.title}>When were you born?</Text>
          <Text style={styles.subtitle}>
            We may surprise you with a birthday gift.
          </Text>

          {/* Reusable calendar component */}
          <DateOfBirthCalendar
            selectedDate={data.dateOfBirth}
            onDateSelect={handleDateSelect}
            currentMonth={currentMonth}
            onMonthChange={handleMonthChange}
          />
          {ageError ? (
            <Text style={styles.ageErrorText}>{ageError}</Text>
          ) : null}
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
            disabled={isDisabled}
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
  skipText: {
    fontSize: Typography.body.fontSize,
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
    marginBottom: Spacing.xs,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.xl,
  },
  buttonContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  ageErrorText: {
    fontSize: 13,
    color: '#D1222E',
    marginTop: Spacing.md,
    textAlign: 'center',
    lineHeight: 18,
  },
});
}


