import React from "react";
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
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from "../../../theme";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";
import { useContactStore } from "../../../store/contactStore";

// ─── Types ──────────────────────────────────────────────────────────
type ContactsProfileRouteProp = RouteProp<RootStackParamList, "ContactsProfile">;

// ─── Detail Row Component ───────────────────────────────────────────
type DetailRowProps = {
  label: string;
  value: string;
  valueColor?: string;
  copyable?: boolean;
  Colors: ThemeColors;
};

function DetailRow({ label, value, valueColor, copyable, Colors }: DetailRowProps) {
  const handleCopy = () => {
    Clipboard.setString(value);
    Alert.alert("Copied", `${label} copied to clipboard`);
  };

  return (
    <View style={styles.detailRow}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.detailLabel, { color: Colors.textSecondary }]}>
          {label}
        </Text>
        <Text
          style={[
            styles.detailValue,
            { color: valueColor || Colors.textPrimary },
          ]}
        >
          {value}
        </Text>
      </View>
      {copyable && (
        <TouchableOpacity onPress={handleCopy} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="copy" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Simple Row Component ───────────────────────────────────────────
type SimpleRowProps = {
  label: string;
  value: string;
  valueColor?: string;
  Colors: ThemeColors;
};

function SimpleRow({ label, value, valueColor, Colors }: SimpleRowProps) {
  return (
    <View style={styles.simpleRow}>
      <Text style={[styles.simpleRowLabel, { color: Colors.textSecondary }]}>
        {label}
      </Text>
      <Text
        style={[
          styles.simpleRowValue,
          { color: valueColor || Colors.textPrimary },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

// ─── Main Screen ────────────────────────────────────────────────────
export default function ContactsProfileScreen() {
  const { colors: Colors } = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<ContactsProfileRouteProp>();

  const {
    id,
    name = "User",
    username = "@user",
    avatar,
  } = route.params || {};

  const { blockUser } = useContactStore();

  // Derive initials for fallback avatar
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleBack = () => navigation.goBack();
  const handleSend = () => navigation.navigate("SendAmount", { name, username, avatar: avatar || "" });
  const handleReceive = () => navigation.navigate("RequestAmount", { name, username, avatar: avatar || "" });
  const handleChat = () => navigation.navigate("ChatScreen", { id: username, name, avatar: avatar || "", online: true });
  const handleShare = () => Alert.alert("Share", `Share ${name}'s profile`);
  const handleBlock = () => {
    Alert.alert("Block Contact", `Are you sure you want to block ${name}?`, [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Block", 
        style: "destructive", 
        onPress: async () => {
          if (id) {
            await blockUser(id);
            navigation.goBack();
          }
        } 
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors.background }]}>
      <StatusBar barStyle={Colors.isDark ? "light-content" : "dark-content"} />

      {/* ── Header ───────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.headerIcon}>
          <Feather name="chevron-left" size={28} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerIcon}>
            <Ionicons name="shield-outline" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.headerIcon, { marginLeft: Spacing.md }]}>
            <Feather name="upload" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ── Profile Section ────────────────────────── */}
        <View style={styles.profileSection}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: Colors.primary }]}>
              <Text style={[styles.avatarInitials, { color: Colors.secondary }]}>{initials}</Text>
            </View>
          )}
          <Text style={[styles.profileName, { color: Colors.textPrimary }]}>{name}</Text>
          <Text style={[styles.profileUsername, { color: Colors.primary }]}>{username}</Text>
        </View>

        {/* ── Action Buttons ─────────────────────────── */}
        <View style={styles.actionRow}>
          <ActionItem icon="arrow-up" label="Send" onPress={handleSend} Colors={Colors} />
          <ActionItem icon="arrow-down" label="Receive" onPress={handleReceive} Colors={Colors} />
          <ActionItem icon="message-circle" label="Chat" onPress={handleChat} Colors={Colors} />
          <ActionItem icon="upload" label="Share" onPress={handleShare} Colors={Colors} />
        </View>

        {/* ── Details Section ────────────────────────── */}
        <View style={styles.detailsContainer}>
          <Text style={[styles.sectionHeader, { color: Colors.textPrimary }]}>Account details</Text>
          <View style={[styles.divider, { backgroundColor: Colors.border }]} />

          <DetailRow
            label="Account holder name"
            value="Paapa Cobbold"
            copyable
            Colors={Colors}
          />

          <View style={{ marginTop: Spacing.md }}>
            <SimpleRow
              label="Tag"
              value={username}
              valueColor={Colors.primary}
              Colors={Colors}
            />
            <SimpleRow
              label="Total sent"
              value="GH₵ 0.00"
              Colors={Colors}
            />
            <SimpleRow
              label="Total received"
              value="GH₵ 1000.00"
              Colors={Colors}
            />
          </View>

          {/* ── Block Button ─────────────────────────── */}
          <TouchableOpacity
            style={styles.blockButton}
            onPress={handleBlock}
            activeOpacity={0.7}
          >
            <Text style={[styles.blockText, { color: Colors.error }]}>Block {name}</Text>
            <Ionicons name="remove-circle-outline" size={24} color={Colors.error} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionItem({ icon, label, onPress, Colors }: { icon: string; label: string; onPress: () => void; Colors: ThemeColors }) {
  return (
    <TouchableOpacity style={styles.actionItem} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.actionIconContainer, { backgroundColor: Colors.primary }]}>
        <Feather name={icon as any} size={24} color={Colors.secondary} />
      </View>
      <Text style={[styles.actionLabel, { color: Colors.primary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    height: 56,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerIcon: {
    padding: 4,
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
  },
  profileSection: {
    alignItems: "center",
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: Spacing.md,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontSize: 48,
    fontWeight: "700",
  },
  profileName: {
    ...Typography.h2,
    fontWeight: "700",
  },
  profileUsername: {
    ...Typography.bodyLg,
    fontWeight: "600",
    marginTop: 2,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xl,
  },
  actionItem: {
    alignItems: "center",
  },
  actionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  actionLabel: {
    ...Typography.caption,
    fontWeight: "600",
  },
  detailsContainer: {
    paddingHorizontal: Spacing.lg,
  },
  sectionHeader: {
    ...Typography.h3,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  divider: {
    height: 1,
    width: "100%",
    marginBottom: Spacing.md,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  detailLabel: {
    ...Typography.body,
    marginBottom: 2,
  },
  detailValue: {
    ...Typography.bodyLg,
    fontWeight: "600",
  },
  simpleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
  },
  simpleRowLabel: {
    ...Typography.body,
  },
  simpleRowValue: {
    ...Typography.body,
    fontWeight: "700",
  },
  blockButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  blockText: {
    ...Typography.bodyLg,
    fontWeight: "600",
  },
});
