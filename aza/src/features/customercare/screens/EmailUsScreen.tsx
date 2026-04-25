import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  TextInput } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";
import { useAppTheme, Spacing, Radius } from "../../../theme";
import { StatusBar } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SafeAreaView } from "react-native-safe-area-context";
import Button from "../../../components/ui/Button";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "EmailUs">;

export default function EmailUsScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const isDark = Colors.isDark;
  const navigation = useNavigation<NavigationProp>();
  const [details, setDetails] = useState("");

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" />
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.container}>
            <View style={styles.header}>
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
              <Text style={styles.title}>Email Us</Text>
              <Text style={styles.subtitle}>
                Talk to us. Tell us as much as you can about the problem.
              </Text>
            </View>

            <View style={styles.content}>
              <Text style={styles.inputLabel}>Details</Text>
              <TextInput
                style={styles.input}
                placeholder="Detail"
                placeholderTextColor={Colors.textSecondary}
                value={details}
                onChangeText={setDetails}
                multiline
                textAlignVertical="top"
              />
            </View>

            <View style={styles.footer}>
              <Button
                title="Send Message"
                onPress={() => {
                  // Handle send message
                  navigation.goBack();
                }}
                disabled={details.trim() === ""}
                backgroundColor="#1E5128"
                textColor="#B7ED7E"
                borderRadius={24}
              />
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(Colors: any) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background },
  keyboardAvoidingView: {
    flex: 1 },
  container: {
    flex: 1 },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: isDark ? Colors.surface : "rgba(22,51,0,0.04)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 8 },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22 },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md },
  inputLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    minHeight: 140,
    fontSize: 16,
    color: Colors.textPrimary,
    backgroundColor: isDark ? Colors.surface : Colors.white,
    paddingTop: Spacing.md,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: isDark ? Colors.border : "rgba(22,51,0,0.08)" } });
}
