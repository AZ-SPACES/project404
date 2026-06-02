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
  ActivityIndicator,
} from "react-native";
import { Feather } from '@react-native-vector-icons/feather';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from "../../../theme";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";
import { useContactStore } from "../../../store/contactStore";
import { getContactDetails } from "../../../services/api";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "../../../lib/queryClient";
import { queryKeys } from "../../../lib/queryKeys";
import { Contact } from "../types";
import { BackButton } from '../../../components/ui/BackButton';
import { extractErrorMessage } from '../../../utils/errorUtils';

type ContactsProfileRouteProp = RouteProp<RootStackParamList, "ContactsProfile">;

type DetailRowProps = {
  label: string;
  value: string;
  Colors: ThemeColors;
};

function DetailRow({ label, value, Colors }: DetailRowProps) {
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: Colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: Colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

export default function ContactsProfileScreen() {
  const { colors: Colors } = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<ContactsProfileRouteProp>();
  const { id, name = "User", username = "", avatar } = route.params || {};

  const { blockUser, toggleFavorite } = useContactStore();

  const { data: contact, isLoading: loading } = useQuery({
    queryKey: queryKeys.contactDetails(id!),
    queryFn: async () => {
      const { data } = await getContactDetails(id!);
      return (data.data ?? data) as Contact;
    },
    enabled: !!id,
    staleTime: 60_000,
  });

  const displayName = contact?.displayName ?? name;
  const displayHandle = contact?.handle ? `@${contact.handle}` : username;
  const displayAvatar =
    contact?.profileImageUrl ??
    avatar ??
    `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`;
  const isFavorite = contact?.isFavorite ?? false;
  // contactUserId is the actual Aza user ID behind this contact entry
  const targetUserId = contact?.contactUserId ?? id;

  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleSend = () => {
    if (!targetUserId) return;
    navigation.navigate("SendAmount", {
      id: targetUserId,
      name: displayName,
      username: displayHandle,
      avatar: displayAvatar,
      identifier: displayHandle,
    });
  };

  const handleRequest = () => {
    if (!targetUserId) return;
    navigation.navigate("RequestAmount", {
      id: targetUserId,
      name: displayName,
      username: displayHandle,
      avatar: displayAvatar,
      identifier: displayHandle,
    });
  };

  const handleChat = () =>
    navigation.navigate("ChatScreen", {
      id: displayHandle,
      name: displayName,
      avatar: displayAvatar,
      online: true,
    });

  const handleToggleFavorite = async () => {
    if (!id) return;
    try {
      await toggleFavorite(id, isFavorite);
      queryClient.invalidateQueries({ queryKey: queryKeys.contactDetails(id) });
    } catch {
      Alert.alert("Error", "Could not update favorite status.");
    }
  };

  const handleBlock = () => {
    Alert.alert("Block Contact", `Are you sure you want to block ${displayName}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Block",
        style: "destructive",
        onPress: async () => {
          if (targetUserId) {
            await blockUser(targetUserId);
            navigation.goBack();
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: Colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors.background }]}>
      <StatusBar barStyle={Colors.isDark ? "light-content" : "dark-content"} />

      {/* Header */}
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} size={28} />
        <TouchableOpacity
          style={styles.headerIcon}
          onPress={handleToggleFavorite}
          accessibilityLabel={isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          <Ionicons
            name={isFavorite ? "star" : "star-outline"}
            size={24}
            color={isFavorite ? "#F59E0B" : Colors.textPrimary}
          />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Avatar */}
        <View style={styles.profileSection}>
          {displayAvatar ? (
            <Image source={{ uri: displayAvatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: Colors.primary }]}>
              <Text style={[styles.avatarInitials, { color: Colors.secondary }]}>{initials}</Text>
            </View>
          )}
          <Text style={[styles.profileName, { color: Colors.textPrimary }]}>{displayName}</Text>
          {!!displayHandle && (
            <Text style={[styles.profileHandle, { color: Colors.primary }]}>{displayHandle}</Text>
          )}
        </View>

        {/* Action Buttons */}
        {contact ? (
          <View style={styles.actionRow}>
            <ActionItem icon="arrow-up" label="Send" onPress={handleSend} Colors={Colors} />
            <ActionItem icon="arrow-down" label="Request" onPress={handleRequest} Colors={Colors} />
            <ActionItem icon="message-circle" label="Chat" onPress={handleChat} Colors={Colors} />
          </View>
        ) : (
          targetUserId && (
            <TouchableOpacity 
              style={[styles.addContactButton, { backgroundColor: Colors.primary }]} 
              onPress={async () => {
                try {
                  await useContactStore.getState().requestContact(targetUserId);
                  Alert.alert("Success", "Contact request sent.");
                } catch (error: unknown) {
                  Alert.alert("Error", extractErrorMessage(error, "Failed to send contact request."));
                }
              }}
            >
              <Feather name="user-plus" size={20} color={Colors.secondary} />
              <Text style={[styles.addContactText, { color: Colors.secondary }]}>Request to add to contacts</Text>
            </TouchableOpacity>
          )
        )}

        {/* Contact Details */}
        {(contact?.email || contact?.phoneNumber) && (
          <View style={[styles.detailsCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
            <Text style={[styles.cardTitle, { color: Colors.textSecondary }]}>Contact info</Text>
            {contact.email && <DetailRow label="Email" value={contact.email} Colors={Colors} />}
            {contact.phoneNumber && <DetailRow label="Phone" value={contact.phoneNumber} Colors={Colors} />}
          </View>
        )}

        {/* Username */}
        {contact?.handle && (
          <View style={[styles.detailsCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
            <Text style={[styles.cardTitle, { color: Colors.textSecondary }]}>Aza info</Text>
            <DetailRow label="Username" value={`@${contact.handle}`} Colors={Colors} />
            <View style={[styles.azaBadgeRow]}>
              <View style={[styles.azaPill, { backgroundColor: Colors.primary }]}>
                <Text style={[styles.azaPillText, { color: Colors.secondary }]}>On Aza</Text>
              </View>
            </View>
          </View>
        )}

        {/* Block */}
        <TouchableOpacity style={styles.blockButton} onPress={handleBlock} activeOpacity={0.7}>
          <Text style={[styles.blockText, { color: Colors.error }]}>Block {displayName}</Text>
          <Ionicons name="remove-circle-outline" size={24} color={Colors.error} />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionItem({
  icon,
  label,
  onPress,
  Colors,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  Colors: ThemeColors;
}) {
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
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    height: 56,
  },
  headerIcon: { padding: 4 },
  scrollContent: { paddingBottom: Spacing.xl * 2 },
  profileSection: {
    alignItems: "center",
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: Spacing.md,
  },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarInitials: { fontSize: 40, fontWeight: "700" },
  profileName: { ...Typography.h2, fontWeight: "700" },
  profileHandle: { ...Typography.bodyLg, fontWeight: "600", marginTop: 2 },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xl,
  },
  actionItem: { alignItems: "center" },
  actionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  actionLabel: { ...Typography.caption, fontWeight: "600" },
  detailsCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
  },
  cardTitle: {
    ...Typography.caption,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  detailLabel: { ...Typography.body },
  detailValue: { ...Typography.body, fontWeight: "600" },
  azaBadgeRow: { marginTop: Spacing.xs },
  azaPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  azaPillText: { fontSize: 12, fontWeight: "600" },
  blockButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xl,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "#FEE2E2",
  },
  blockText: { ...Typography.bodyLg, fontWeight: "600" },
  addContactButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
  },
  addContactText: {
    ...Typography.bodyLg,
    fontWeight: "700",
    marginLeft: Spacing.sm,
  },
});
