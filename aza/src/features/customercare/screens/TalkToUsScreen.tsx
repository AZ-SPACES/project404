import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";
import {
  useAppTheme,
  Spacing,
  Typography,
  Radius,
  ThemeColors,
} from "../../../theme";
import { StatusBar } from "react-native";
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import { Feather } from '@react-native-vector-icons/feather';
import { AntDesign } from '@react-native-vector-icons/ant-design';
import { SafeAreaView } from "react-native-safe-area-context";
import Button from "../../../components/ui/Button";
import { getAvailableSupportAgents, initiateCall } from "../../../services/api";

const { height } = Dimensions.get("window");

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "TalkToUs">;

export default function TalkToUsScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const isDark = Colors.isDark;
  const navigation = useNavigation<NavigationProp>();
  const [language, setLanguage] = useState("English");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isBottomSheetVisible, setBottomSheetVisible] = useState(false);
  const [callingSupport, setCallingSupport] = useState(false);
  const bottomSheetAnim = useRef(new Animated.Value(height)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const handleCallSupport = async () => {
    setCallingSupport(true);
    try {
      const res = await getAvailableSupportAgents();
      const agents: any[] = res.data?.data ?? [];
      if (agents.length === 0) {
        Alert.alert(
          "No agents available",
          "All support agents are currently busy. Try chat instead.",
          [{ text: "Chat instead", onPress: () => navigation.navigate("ChatWithUs") }, { text: "OK" }]
        );
        return;
      }
      const agent = agents[0];
      await initiateCall(agent.userId, "VOICE");
      navigation.navigate("AudioCall", {
        name: agent.name ?? "AZA Support",
        avatar: agent.avatarUrl ?? "",
      });
    } catch (err) {
      Alert.alert("Error", "Could not connect to support. Please try again.");
    } finally {
      setCallingSupport(false);
    }
  };

  const languages = ["English", "Twi", "Ga", "Ewe", "Hausa"];

  useEffect(() => {
    if (isBottomSheetVisible) {
      Animated.parallel([
        Animated.timing(bottomSheetAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(bottomSheetAnim, {
          toValue: height,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isBottomSheetVisible, bottomSheetAnim, backdropAnim]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor="transparent"
      />
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
        <Text style={styles.title}>Talk to us</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Conversation Language</Text>
          <TouchableOpacity
            style={[
              styles.dropdownButton,
              isDropdownOpen && styles.dropdownButtonActive,
            ]}
            onPress={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            <Text style={styles.dropdownText}>{language}</Text>
            <Feather
              name={isDropdownOpen ? "chevron-up" : "chevron-down"}
              size={24}
              color={Colors.textSecondary}
            />
          </TouchableOpacity>

          {isDropdownOpen && (
            <View style={styles.dropdownList}>
              {languages.map((lang, index) => (
                <TouchableOpacity
                  key={lang}
                  style={[
                    styles.dropdownItem,
                    index === languages.length - 1 && { borderBottomWidth: 0 },
                  ]}
                  onPress={() => {
                    setLanguage(lang);
                    setIsDropdownOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.dropdownItemText,
                      language === lang && styles.dropdownItemTextSelected,
                    ]}
                  >
                    {lang}
                  </Text>
                  {language === lang && (
                    <Feather
                      name="check"
                      size={16}
                      color={Colors.textPrimary}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select an issue</Text>
          <View style={styles.separator} />

          <TouchableOpacity
            style={styles.issueItem}
            onPress={() => navigation.navigate("ChatWithUs")}
          >
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: "rgba(234, 67, 53, 0.1)" },
              ]}
            >
              <Feather name="alert-triangle" size={20} color="#EA4335" />
            </View>
            <View style={styles.issueTextContainer}>
              <Text style={styles.issueTitle}>
                Report suspicious activity / Fraud
              </Text>
              <Text style={styles.issueSubtitle}>
                Priority immediate response
              </Text>
            </View>
            <Feather
              name="chevron-right"
              size={20}
              color={Colors.textPrimary}
            />
          </TouchableOpacity>
          <View style={styles.separator} />

          <TouchableOpacity
            style={styles.issueItem}
            onPress={() => navigation.navigate("EmailUs")}
          >
            <View style={styles.iconContainer}>
              <Feather name="mail" size={20} color={Colors.textPrimary} />
            </View>
            <View style={styles.issueTextContainer}>
              <Text style={styles.issueTitle}>Email us</Text>
              <Text style={styles.issueSubtitle}>
                We'll aim to respond with 24hours
              </Text>
            </View>
            <Feather
              name="chevron-right"
              size={20}
              color={Colors.textPrimary}
            />
          </TouchableOpacity>
          <View style={styles.separator} />

          <TouchableOpacity
            style={styles.issueItem}
            onPress={() => navigation.navigate("ChatWithUs")}
          >
            <View style={styles.iconContainer}>
              <Feather
                name="message-circle"
                size={20}
                color={Colors.textPrimary}
              />
            </View>
            <View style={styles.issueTextContainer}>
              <Text style={styles.issueTitle}>Chat with us</Text>
              <Text style={styles.issueSubtitle}>Immediate response</Text>
            </View>
            <Feather
              name="chevron-right"
              size={20}
              color={Colors.textPrimary}
            />
          </TouchableOpacity>
          <View style={styles.separator} />

          <TouchableOpacity
            style={styles.issueItem}
            onPress={handleCallSupport}
            disabled={callingSupport}
          >
            <View style={styles.iconContainer}>
              {callingSupport ? (
                <ActivityIndicator size="small" color={Colors.textPrimary} />
              ) : (
                <Feather name="smartphone" size={20} color={Colors.textPrimary} />
              )}
            </View>
            <View style={styles.issueTextContainer}>
              <Text style={styles.issueTitle}>Call us</Text>
              <Text style={styles.issueSubtitle}>
                {callingSupport ? "Connecting..." : "Available"}
              </Text>
            </View>
            <Feather
              name="chevron-right"
              size={20}
              color={Colors.textPrimary}
            />
          </TouchableOpacity>
          <View style={styles.separator} />
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
    },
    content: {
      flex: 1,
      paddingHorizontal: Spacing.lg,
    },
    section: {
      marginBottom: Spacing.xl,
    },
    sectionLabel: {
      fontSize: 14,
      fontWeight: "400",
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
      fontWeight: "400",
      color: Colors.textSecondary,
    },
    dropdownList: {
      borderWidth: 1,
      borderColor: Colors.border,
      borderTopWidth: 0,
      borderBottomLeftRadius: Radius.md,
      borderBottomRightRadius: Radius.md,
      backgroundColor: isDark ? Colors.surface : "#FFFFFF",
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
      fontSize: 16,
      color: Colors.textSecondary,
    },
    dropdownItemTextSelected: {
      color: Colors.textPrimary,
      fontWeight: "500",
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: Colors.textPrimary,
      marginBottom: Spacing.sm,
    },
    separator: {
      height: 1,
      backgroundColor: isDark ? Colors.border : "rgba(22,51,0,0.08)",
    },
    issueItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: Spacing.lg,
    },
    iconContainer: {
      width: 44,
      height: 44,
      borderRadius: Radius.full,
      backgroundColor: isDark ? Colors.white10 : "rgba(22,51,0,0.04)",
      alignItems: "center",
      justifyContent: "center",
      marginRight: Spacing.md,
    },
    issueTextContainer: {
      flex: 1,
    },
    issueTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: Colors.textPrimary,
      marginBottom: 4,
    },
    issueSubtitle: {
      fontSize: 14,
      fontWeight: "400",
      color: Colors.textSecondary,
    },
    bottomSheetBackdrop: {
      ...StyleSheet.absoluteFill,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
    },
    bottomSheetContainer: {
      backgroundColor: isDark ? Colors.surface : "#ffffff",
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: 48,
    },
    bottomSheetHeader: {
      flexDirection: "row",
      justifyContent: "flex-start",
      marginBottom: 16,
    },
    closeButton: {
      backgroundColor: isDark ? Colors.white10 : "#F3F4F6",
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    bottomSheetTitle: {
      fontSize: 28,
      fontWeight: "700",
      color: Colors.textPrimary,
      marginBottom: 8,
      letterSpacing: -0.5,
    },
    bottomSheetDescription: {
      fontSize: 16,
      color: Colors.textPrimary,
      lineHeight: 22,
      marginBottom: 20,
    },
    bottomSheetDivider: {
      height: 1,
      backgroundColor: Colors.border,
      marginBottom: 24,
    },
  });
}
