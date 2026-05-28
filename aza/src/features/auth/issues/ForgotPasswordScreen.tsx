import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";
import {  useAppTheme, ThemeColors, Typography, Spacing, Radius  } from "../../../theme";
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import Button from "../../../components/ui/Button";
import { BackButton } from '../../../components/ui/BackButton';

type NavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "ForgotPassword"
>;

export default function ForgotPasswordScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();
  const scrollY = React.useRef(new Animated.Value(0)).current;

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
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" />
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
        <BackButton onPress={() => navigation.goBack()} size={28} />
        <Animated.View
          style={[styles.headerTitleContainer, { opacity: headerTitleOpacity }]}
        >
          <Text style={styles.headerTitle} numberOfLines={1}>
            I've forgotten my password
          </Text>
        </Animated.View>
        <View style={{ width: 44 }} />
      </Animated.View>

      <Animated.ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
        scrollEventThrottle={16}
      >
        <Text style={styles.largeTitle}>I've forgotten my password</Text>
        <Text style={styles.subtitle}>
          If you're logged out and can't remember your password,{" "}
          <Text style={styles.boldText}>
            we can send you an email with a link to reset it.
          </Text>
        </Text>

        <View style={styles.buttonContainer}>
          <Button
            title="Reset password"
            onPress={() => {
              navigation.navigate("ResetPassword");
            }}
            backgroundColor={Colors.primary}
            textColor={Colors.secondary}
            borderRadius={30} // completely rounded
            paddingVertical={16}
            fontSize={Typography.button.fontSize}
            fontWeight={Typography.button.fontWeight}
          />
        </View>

        <TouchableOpacity
          style={styles.helpButton}
          onPress={() => navigation.navigate("TalkToUs")}
        >
          <Text style={styles.helpText}>I still need help</Text>
        </TouchableOpacity>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: isDark ? Colors.surface : '#FFFFFF',
  },
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 44,
    height: 44,
    backgroundColor: isDark ? Colors.white10 : "rgba(22,51,0,0.04)",
    alignItems: "center",
    justifyContent: "center",
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
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  largeTitle: {
    fontSize: Typography.h1.fontSize,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.xl,
  },
  boldText: {
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  buttonContainer: {
    marginBottom: Spacing.lg,
  },
  helpButton: {
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  helpText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
});
}


