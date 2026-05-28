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
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";
import { useAppTheme, Spacing, Radius, ThemeColors } from "../../../theme";
import { StatusBar } from "react-native";
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import { Feather } from '@react-native-vector-icons/feather';
import { SafeAreaView } from "react-native-safe-area-context";
import Button from "../../../components/ui/Button";
import { sendSupportMessage, getOrCreateSupportChat } from "../../../services/api";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "EmailUs">;

const SUBJECTS = [
  "General inquiry",
  "Transaction issue",
  "Account issue",
  "Technical problem",
  "Report fraud",
  "Feedback",
];

export default function EmailUsScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const isDark = Colors.isDark;
  const navigation = useNavigation<NavigationProp>();

  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!details.trim()) return;
    setLoading(true);
    try {
      await getOrCreateSupportChat();
      await sendSupportMessage(`[${subject}]\n\n${details.trim()}`);
      setSent(true);
    } catch {
      Alert.alert("Error", "Could not send your message. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" />
        <View style={styles.successContainer}>
          <View style={styles.successIconWrap}>
            <Feather name="check" size={32} color="#1E5128" />
          </View>
          <Text style={styles.successTitle}>Message sent</Text>
          <Text style={styles.successSubtitle}>
            We've received your message and will respond within 24 hours.
          </Text>
          <Button
            title="Done"
            onPress={() => navigation.goBack()}
            backgroundColor="#1E5128"
            textColor="#B7ED7E"
            borderRadius={24}
          />
        </View>
      </SafeAreaView>
    );
  }

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
                <MaterialIcons name="chevron-left" size={28} color={Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.title}>Email Us</Text>
              <Text style={styles.subtitle}>
                Tell us as much as you can about the problem. We'll aim to respond within 24 hours.
              </Text>
            </View>

            <View style={styles.content}>
              <Text style={styles.inputLabel}>Subject</Text>
              <TouchableOpacity
                style={[styles.dropdownButton, isDropdownOpen && styles.dropdownButtonActive]}
                onPress={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                <Text style={styles.dropdownText}>{subject}</Text>
                <Feather
                  name={isDropdownOpen ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={Colors.textSecondary}
                />
              </TouchableOpacity>

              {isDropdownOpen && (
                <View style={styles.dropdownList}>
                  {SUBJECTS.map((s, index) => (
                    <TouchableOpacity
                      key={s}
                      style={[
                        styles.dropdownItem,
                        index === SUBJECTS.length - 1 && { borderBottomWidth: 0 },
                      ]}
                      onPress={() => {
                        setSubject(s);
                        setIsDropdownOpen(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.dropdownItemText,
                          subject === s && styles.dropdownItemTextSelected,
                        ]}
                      >
                        {s}
                      </Text>
                      {subject === s && (
                        <Feather name="check" size={16} color={Colors.textPrimary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={[styles.inputLabel, { marginTop: Spacing.md }]}>Details</Text>
              <TextInput
                style={styles.input}
                placeholder="Describe your issue in detail..."
                placeholderTextColor={Colors.textSecondary}
                value={details}
                onChangeText={setDetails}
                multiline
                textAlignVertical="top"
              />
            </View>

            <View style={styles.footer}>
              {loading ? (
                <ActivityIndicator color="#1E5128" />
              ) : (
                <Button
                  title="Send Message"
                  onPress={handleSend}
                  disabled={details.trim() === ""}
                  backgroundColor="#1E5128"
                  textColor="#B7ED7E"
                  borderRadius={24}
                />
              )}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
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
    keyboardAvoidingView: {
      flex: 1,
    },
    container: {
      flex: 1,
    },
    header: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.md,
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: Radius.full,
      backgroundColor: isDark ? Colors.white10 : "rgba(22,51,0,0.04)",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: Spacing.lg,
    },
    title: {
      fontSize: 32,
      fontWeight: "700",
      color: Colors.textPrimary,
      letterSpacing: -0.5,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      color: Colors.textSecondary,
      lineHeight: 22,
    },
    content: {
      flex: 1,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: "700",
      color: Colors.textPrimary,
      marginBottom: Spacing.sm,
    },
    dropdownButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: 12,
    },
    dropdownButtonActive: {
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      borderBottomColor: "transparent",
    },
    dropdownText: {
      fontSize: 16,
      color: Colors.textPrimary,
    },
    dropdownList: {
      borderWidth: 1,
      borderColor: Colors.border,
      borderTopWidth: 0,
      borderBottomLeftRadius: Radius.md,
      borderBottomRightRadius: Radius.md,
      backgroundColor: isDark ? Colors.surface : Colors.white,
      overflow: "hidden",
    },
    dropdownItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
      paddingHorizontal: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? Colors.border : "rgba(22,51,0,0.04)",
    },
    dropdownItemText: {
      fontSize: 15,
      color: Colors.textSecondary,
    },
    dropdownItemTextSelected: {
      color: Colors.textPrimary,
      fontWeight: "500",
    },
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
      borderTopColor: isDark ? Colors.border : "rgba(22,51,0,0.08)",
    },
    successContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: Spacing.lg,
      gap: Spacing.md,
    },
    successIconWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: "#B7EE7A",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: Spacing.sm,
    },
    successTitle: {
      fontSize: 28,
      fontWeight: "700",
      color: Colors.textPrimary,
      letterSpacing: -0.5,
    },
    successSubtitle: {
      fontSize: 15,
      color: Colors.textSecondary,
      textAlign: "center",
      lineHeight: 22,
      marginBottom: Spacing.lg,
    },
  });
}
