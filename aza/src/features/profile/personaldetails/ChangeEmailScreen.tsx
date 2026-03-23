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
import { Feather, Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";
import { Colors, Typography, Spacing, Radius } from "../../../theme";
import Button from "../../../components/ui/Button";

type NavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "ChangeEmail"
>;

export function ChangeEmailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [newEmail, setNewEmail] = useState("");
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
            Change email address
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
              Change email address
            </Text>
          </View>

          <Text style={styles.subtitle}>
            Enter the email address you'd like to use with your account. Please
            ensure that only you have access to this email to keep your account
            secure.
          </Text>

          <View style={styles.inputSection}>
            <Text style={styles.label}>Enter new email</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={newEmail}
                onChangeText={setNewEmail}
                placeholder="caleb.dussey04@icloud.com"
                placeholderTextColor={Colors.textSecondary + "80"}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={false}
              />
            </View>
          </View>

          <View
            style={[
              styles.inputContainer,
              styles.readOnlyContainer,
              { marginHorizontal: Spacing.lg },
            ]}
          >
            <Ionicons
              name="checkmark-circle"
              size={20}
              color={Colors.border}
              style={{ marginRight: 8 }}
            />
            <Text style={styles.readOnlyText}>Account email (verified)</Text>
          </View>
        </Animated.ScrollView>

        <View style={styles.footer}>
          <Button
            title="Contact us"
            onPress={() => navigation.navigate("TalkToUs")}
            backgroundColor={Colors.primary}
            textColor={Colors.secondary}
            borderRadius={Radius.full}
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
    marginBottom: Spacing.md,
    lineHeight: 22,
    paddingHorizontal: Spacing.lg,
  },
  noticeText: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
    lineHeight: 20,
    paddingHorizontal: Spacing.lg,
  },
  inputSection: {
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  label: {
    ...Typography.caption,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  inputContainer: {
    height: 52,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
  },
  readOnlyContainer: {
    backgroundColor: Colors.surface + "30",
    borderColor: Colors.border + "50",
  },
  input: {
    flex: 1,
    ...Typography.bodyLg,
    color: Colors.textPrimary,
  },
  readOnlyText: {
    ...Typography.body,
    color: Colors.border,
  },
  footer: {
    padding: Spacing.lg,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border + "20",
  },
});
