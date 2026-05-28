import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Share,
  Clipboard,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from '@react-native-vector-icons/feather';
import { MaterialDesignIcons as MaterialCommunityIcons } from '@react-native-vector-icons/material-design-icons';
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from "../../../theme";
import Button from "../../../components/ui/Button";
import { useToast } from "../../../providers/ToastProvider";

export default function RecoveryCodesScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "RecoveryCodes">>();
  const { showToast } = useToast();

  const { codes } = route.params;

  const handleCopy = () => {
    Clipboard.setString(codes.join("\n"));
    showToast("Recovery codes copied to clipboard", "success");
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `My AZA Recovery Codes:\n\n${codes.join("\n")}\n\nKeep these codes in a safe place.`,
      });
    } catch (err) {
      showToast("Failed to share codes", "error");
    }
  };

  const handleDone = () => {
    navigation.popToTop();
    navigation.navigate("SecurityAndPrivacy");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Save recovery codes</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons name="shield-check" size={64} color={Colors.primary} />
        </View>

        <Text style={styles.title}>You're all set!</Text>
        <Text style={styles.description}>
          2-step verification is now enabled. If you lose access to your authenticator app, you can use these recovery codes to sign in.
        </Text>

        <View style={styles.warningBox}>
          <Feather name="alert-triangle" size={20} color="#B45309" />
          <Text style={styles.warningText}>
            Keep these in a safe place. Each code can only be used once.
          </Text>
        </View>

        <View style={styles.codesContainer}>
          <View style={styles.codesGrid}>
            {codes.map((code, index) => (
              <View key={index} style={styles.codeItem}>
                <Text style={styles.codeText}>{code}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.actionButton} onPress={handleCopy}>
            <Feather name="copy" size={20} color={Colors.textPrimary} />
            <Text style={styles.actionText}>Copy codes</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
            <Feather name="download" size={20} color={Colors.textPrimary} />
            <Text style={styles.actionText}>Save as text</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="Done"
          onPress={handleDone}
          backgroundColor={Colors.primary}
          textColor={Colors.secondary}
          borderRadius={Radius.full}
          paddingVertical={16}
        />
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
      height: 56,
      justifyContent: "center",
      alignItems: "center",
      borderBottomWidth: 1,
      borderBottomColor: Colors.border,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: Colors.textPrimary,
    },
    scrollContent: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.xl,
      paddingBottom: 40,
    },
    iconContainer: {
      alignItems: "center",
      marginBottom: Spacing.lg,
    },
    title: {
      fontSize: 28,
      fontWeight: "700",
      color: Colors.textPrimary,
      textAlign: "center",
      marginBottom: Spacing.sm,
    },
    description: {
      fontSize: 16,
      color: Colors.textSecondary,
      textAlign: "center",
      lineHeight: 24,
      marginBottom: Spacing.xl,
    },
    warningBox: {
      flexDirection: "row",
      backgroundColor: "#FFFBEB",
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "#FEF3C7",
      marginBottom: Spacing.xl,
      alignItems: "center",
    },
    warningText: {
      fontSize: 14,
      color: "#92400E",
      marginLeft: 12,
      flex: 1,
    },
    codesContainer: {
      backgroundColor: isDark ? Colors.surface : "#F9FAFB",
      borderRadius: 16,
      padding: 24,
      borderWidth: 1,
      borderColor: Colors.border,
      marginBottom: Spacing.xl,
    },
    codesGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
    },
    codeItem: {
      width: "48%",
      marginBottom: 12,
    },
    codeText: {
      fontSize: 18,
      fontWeight: "600",
      color: Colors.textPrimary,
      fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    },
    actionsContainer: {
      flexDirection: "row",
      justifyContent: "center",
      gap: Spacing.xl,
    },
    actionButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    actionText: {
      fontSize: 16,
      fontWeight: "600",
      color: Colors.textPrimary,
    },
    footer: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.xl,
    },
  });
}
