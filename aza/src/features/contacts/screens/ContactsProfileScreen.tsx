import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  StatusBar,
  Alert,
  Clipboard,
} from "react-native";
import { Feather, MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from "../../../theme";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";

// ─── Types ──────────────────────────────────────────────────────────
type ContactsProfileParams = {
  name: string;
  username: string;
  avatar: string;
  phone?: string;
  status?: string;
  accountProvider?: string;
};

type ContactsProfileRouteProp = RouteProp<
  { ContactsProfile: ContactsProfileParams },
  "ContactsProfile"
>;

// ─── Row component for settings-style items ─────────────────────────
type SettingsRowProps = {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onPress?: () => void;
  Colors: ThemeColors;
};

function SettingsRow({ icon, label, value, onPress, Colors }: SettingsRowProps) {
  return (
    <TouchableOpacity
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
        paddingHorizontal: Spacing.lg,
      }}
      activeOpacity={0.7}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={{ width: 28, alignItems: "center" }}>{icon}</View>
      <Text
        style={{
          ...Typography.bodyLg,
          color: Colors.textPrimary,
          flex: 1,
          marginLeft: 12,
        }}
      >
        {label}
      </Text>
      {value ? (
        <Text
          style={{
            ...Typography.body,
            color: Colors.textSecondary,
            marginRight: 4,
          }}
        >
          {value}
        </Text>
      ) : null}
      <Feather name="chevron-right" size={18} color={Colors.textSecondary} />
    </TouchableOpacity>
  );
}

// ─── Detail row for account info ────────────────────────────────────
type DetailRowProps = {
  label: string;
  value: string;
  copyable?: boolean;
  Colors: ThemeColors;
};

function DetailRow({ label, value, copyable, Colors }: DetailRowProps) {
  const handleCopy = () => {
    Clipboard.setString(value);
    Alert.alert("Copied", `${label} copied to clipboard`);
  };

  return (
    <View
      style={{
        paddingVertical: 14,
        paddingHorizontal: Spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
      }}
    >
      <Text
        style={{
          ...Typography.caption,
          color: Colors.textSecondary,
          marginBottom: 4,
        }}
      >
        {label}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text
          style={{
            ...Typography.bodyLg,
            color: Colors.textPrimary,
            fontWeight: "500",
            flex: 1,
          }}
        >
          {value}
        </Text>
        {copyable ? (
          <TouchableOpacity onPress={handleCopy} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="copy" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

// ─── Main Screen ────────────────────────────────────────────────────
export default function ContactsProfileScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<ContactsProfileRouteProp>();

  const {
    name,
    username,
    avatar,
    phone = "+233 55 219 4339",
    status = "Available",
    accountProvider = "Aza Finance",
  } = route.params;

  const [nickname, setNickname] = useState<string | null>(null);

  // Derive initials for fallback avatar
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleSend = () => {
    navigation.navigate("SendAmount", { name, username, avatar });
  };

  const handleRequest = () => {
    navigation.navigate("RequestAmount", { name, username, avatar });
  };

  const handleShare = () => {
    Alert.alert("Share", `Share ${name}'s profile`);
  };

  const handleDeleteRecipient = () => {
    Alert.alert(
      "Delete recipient",
      `Are you sure you want to remove ${name} from your contacts?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => navigation.goBack(),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={Colors.isDark ? "light-content" : "dark-content"}
        backgroundColor={Colors.background}
      />

      {/* ── Header bar ────────────────────────────────── */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="arrow-left" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Contact info</Text>
        <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.editText}>Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Avatar & identity ───────────────────────── */}
        <View style={styles.profileSection}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
          )}
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.username}>{username}</Text>
          <Text style={styles.phoneNumber}>{phone}</Text>
          {status ? <Text style={styles.status}>{status}</Text> : null}
        </View>

        {/* ── Action buttons ──────────────────────────── */}
        <View style={styles.actionsRow}>
          <View style={styles.actionItem}>
            <TouchableOpacity
              style={styles.actionCircle}
              activeOpacity={0.8}
              onPress={handleSend}
            >
              <Feather name="arrow-up" size={22} color={Colors.secondary} />
            </TouchableOpacity>
            <Text style={styles.actionLabel}>Send</Text>
          </View>

          <View style={styles.actionItem}>
            <TouchableOpacity
              style={styles.actionCircle}
              activeOpacity={0.8}
              onPress={handleRequest}
            >
              <Feather name="arrow-down" size={22} color={Colors.secondary} />
            </TouchableOpacity>
            <Text style={styles.actionLabel}>Request</Text>
          </View>

          <View style={styles.actionItem}>
            <TouchableOpacity
              style={styles.actionCircle}
              activeOpacity={0.8}
              onPress={handleShare}
            >
              <Feather name="share" size={22} color={Colors.secondary} />
            </TouchableOpacity>
            <Text style={styles.actionLabel}>Share</Text>
          </View>
        </View>

        {/* ── Account details section ─────────────────── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>Account details</Text>
          <DetailRow
            label="Account holder name"
            value={name}
            copyable
            Colors={Colors}
          />
          <DetailRow
            label="Username"
            value={username}
            copyable
            Colors={Colors}
          />
        </View>

        {/* ── Media & storage section ─────────────────── */}
        <View style={styles.sectionCard}>
          <SettingsRow
            icon={<Ionicons name="images-outline" size={20} color={Colors.textPrimary} />}
            label="Media, links and docs"
            value="111"
            Colors={Colors}
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            icon={<Feather name="hard-drive" size={20} color={Colors.textPrimary} />}
            label="Manage storage"
            value="71.7 MB"
            Colors={Colors}
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            icon={<Feather name="star" size={20} color={Colors.textPrimary} />}
            label="Starred"
            value="None"
            Colors={Colors}
          />
        </View>

        {/* ── Settings section ────────────────────────── */}
        <View style={styles.sectionCard}>
          <SettingsRow
            icon={<Ionicons name="notifications-outline" size={20} color={Colors.textPrimary} />}
            label="Notifications"
            Colors={Colors}
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            icon={<MaterialCommunityIcons name="palette-outline" size={20} color={Colors.textPrimary} />}
            label="Chat theme"
            Colors={Colors}
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            icon={<Feather name="download" size={20} color={Colors.textPrimary} />}
            label="Save to Photos"
            value="Default"
            Colors={Colors}
          />
        </View>

        {/* ── Privacy section ─────────────────────────── */}
        <View style={styles.sectionCard}>
          <SettingsRow
            icon={<Ionicons name="timer-outline" size={20} color={Colors.textPrimary} />}
            label="Disappearing messages"
            value="Off"
            Colors={Colors}
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            icon={<Feather name="file-text" size={20} color={Colors.textPrimary} />}
            label="Transcript language"
            value="English"
            Colors={Colors}
          />
        </View>

        {/* ── Account settings / delete ───────────────── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>Account settings</Text>
          <TouchableOpacity
            style={styles.deleteButton}
            activeOpacity={0.8}
            onPress={handleDeleteRecipient}
          >
            <Text style={styles.deleteButtonText}>Delete recipient</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: Spacing.xl * 2 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────
function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },

    // Header
    headerBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: Spacing.lg,
      paddingVertical: 12,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: isDark ? Colors.surface : Colors.white,
    },
    headerTitle: {
      ...Typography.bodyLg,
      fontWeight: "600",
      color: Colors.textPrimary,
    },
    editText: {
      ...Typography.bodyLg,
      fontWeight: "600",
      color: Colors.primary,
    },

    scrollContent: {
      paddingBottom: Spacing.xl,
    },

    // Profile identity
    profileSection: {
      alignItems: "center",
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.md,
    },
    avatar: {
      width: 96,
      height: 96,
      borderRadius: 48,
      marginBottom: Spacing.md,
    },
    avatarFallback: {
      backgroundColor: Colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarInitials: {
      fontSize: 32,
      fontWeight: "700",
      color: Colors.secondary,
    },
    name: {
      ...Typography.h2,
      color: Colors.textPrimary,
      fontWeight: "700",
      marginBottom: 2,
    },
    username: {
      ...Typography.body,
      color: Colors.primary,
      fontWeight: "600",
      marginBottom: 4,
    },
    phoneNumber: {
      ...Typography.body,
      color: Colors.textSecondary,
      marginBottom: 2,
    },
    status: {
      ...Typography.caption,
      color: Colors.textSecondary,
      marginTop: 2,
    },

    // Action circles
    actionsRow: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 32,
      paddingVertical: Spacing.lg,
    },
    actionItem: {
      alignItems: "center",
      width: 72,
    },
    actionCircle: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: Colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 6,
    },
    actionLabel: {
      ...Typography.caption,
      fontWeight: "600",
      color: Colors.primary,
    },

    // Section cards
    sectionCard: {
      backgroundColor: isDark ? Colors.surface : Colors.white,
      marginHorizontal: Spacing.lg,
      marginTop: Spacing.md,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: Colors.border,
      overflow: "hidden",
    },
    sectionHeader: {
      ...Typography.caption,
      color: Colors.textSecondary,
      fontWeight: "500",
      paddingHorizontal: Spacing.lg,
      paddingTop: 14,
      paddingBottom: 4,
    },
    rowDivider: {
      height: 1,
      backgroundColor: Colors.border,
      marginLeft: Spacing.lg + 28 + 12, // icon width + gap
    },

    // Nickname button
    nicknameButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
      backgroundColor: Colors.primary,
    },
    nicknameButtonText: {
      ...Typography.caption,
      fontWeight: "600",
      color: Colors.secondary,
    },

    // Delete
    deleteButton: {
      marginHorizontal: Spacing.md,
      marginVertical: Spacing.md,
      paddingVertical: 14,
      borderRadius: 8,
      alignItems: "center",
      backgroundColor: isDark ? "rgba(234,67,53,0.15)" : "rgba(234,67,53,0.1)",
    },
    deleteButtonText: {
      ...Typography.button,
      color: Colors.error,
      fontWeight: "600",
    },
  });
}
