import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SectionList,
  Image,
  TextInput,
  TouchableOpacity,
  StatusBar,
  Modal,
  TouchableWithoutFeedback,
  Share,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import {
  Feather,
  MaterialCommunityIcons,
  AntDesign,
} from "@expo/vector-icons";
import {
  useAppTheme,
  ThemeColors,
  Typography,
  Spacing,
  Radius,
} from "../../../theme";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";
import * as Contacts from "expo-contacts";
import Button from "../../../components/ui/Button";
import { useContactStore } from "../../../store/contactStore";
import { useProfile } from "../../../providers/ProfileProvider";
import { Contact as BackendContact } from "../types";

const AZA_ICON = require("../../../assets/aza-z.png");

// Type definitions - mapping backend contact to UI recipient if needed, 
// but better to use BackendContact directly where possible.
export type Recipient = {
  id: string;
  name: string;
  username: string;
  avatar: string;
  isOnAza?: boolean;
  isFavorite?: boolean;
  phoneNumber?: string | undefined;
  email?: string | undefined;
  isRequest?: boolean;
  userId?: string;
};

// Mock data is no longer needed but kept for reference if needed
export const INITIAL_RECIPIENTS: Recipient[] = [];

export default function ContactsScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const { 
    contacts: backendContacts, 
    fetchContacts, 
    syncDeviceContacts, 
    isLoading, 
    isSyncing,
    toggleFavorite,
    addContactByUserId,
    findUserByHandle,
    searchGlobal,
    blockedUsers,
    fetchBlockedUsers,
    unblockUser,
    contactRequests,
    fetchContactRequests,
    approveContactRequest,
    rejectContactRequest
  } = useContactStore();
  const { syncContacts: isSyncAllowed } = useProfile();

  useEffect(() => {
    fetchContacts();
    fetchContactRequests();
  }, []);

  useEffect(() => {
    // Only sync if the user has enabled the setting in Privacy settings
    if (!isSyncAllowed) return;

    (async () => {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status === "granted") {
        const { data } = await Contacts.getContactsAsync({
          fields: [
            Contacts.Fields.FirstName,
            Contacts.Fields.LastName,
            Contacts.Fields.PhoneNumbers,
            Contacts.Fields.Emails,
          ],
        });

        if (data.length > 0) {
          const deviceContacts = data
            .filter((c) => c.name || (c.firstName || c.lastName))
            .map((c) => ({
              displayName: c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim(),
              phoneNumber: c.phoneNumbers?.[0]?.number,
              email: c.emails?.[0]?.email,
            }));

          // Sync with backend
          await syncDeviceContacts(deviceContacts);
        }
      }
    })();
  }, [isSyncAllowed]);

  // Deduplicate by id — backend may return the same contact more than once
  // (e.g. matched by both phone and email during sync)
  const uniqueContacts = React.useMemo(() => {
    const seen = new Set<string>();
    return backendContacts.filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  }, [backendContacts]);

  // Map backend contacts to UI Recipients
  const contactsList: Recipient[] = uniqueContacts.map(c => ({
    id: c.id,
    name: c.displayName,
    username: c.handle ? `@${c.handle}` : (c.phoneNumber || c.email || ''),
    avatar: c.profileImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.displayName)}&background=random`,
    isOnAza: c.isAzaUser,
    isFavorite: c.isFavorite,
    phoneNumber: c.phoneNumber,
    email: c.email
  }));

  const [searchQuery, setSearchQuery] = useState("");
  const [inviteQuery, setInviteQuery] = useState("");
  const [addUserQuery, setAddUserQuery] = useState("");
  const [selectedRecipient, setSelectedRecipient] = useState<Recipient | null>(
    null,
  );
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [globalSearchResults, setGlobalSearchResults] = useState<any[]>([]);
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);

  useEffect(() => {
    if (showBlockedModal) {
      fetchBlockedUsers();
    }
  }, [showBlockedModal]);

  // Simple filter logic
  const filteredRecipients = contactsList.filter(
    (r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.phoneNumber && r.phoneNumber.includes(searchQuery)) ||
      (r.email && r.email.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  const favorites = filteredRecipients.filter((r) => r.isFavorite);
  const azaUsers = filteredRecipients.filter((r) => r.isOnAza);
  const otherContacts = filteredRecipients.filter((r) => !r.isOnAza);

  const requestRecipients: Recipient[] = (contactRequests || []).map(r => ({
    id: r.id, // the requestId
    userId: r.senderUserId,
    name: r.senderDisplayName,
    username: `@${r.senderUsername}`,
    avatar: r.senderProfileImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(r.senderDisplayName)}&background=random`,
    isRequest: true,
  }));

  const sections = [
    ...(requestRecipients.length > 0 && !searchQuery ? [{ title: "Pending Requests", data: requestRecipients }] : []),
    { title: "On Aza", data: azaUsers },
  ].filter((section) => section.data.length > 0);

  const handleRefresh = async () => {
    await fetchContacts();
    await fetchContactRequests();
  };

  const openSheet = (recipient: Recipient) => {
    setSelectedRecipient(recipient);
  };

  const closeSheet = () => {
    setSelectedRecipient(null);
  };

  const handleSend = () => {
    if (selectedRecipient) {
      closeSheet();
      navigation.navigate("SendAmount", {
        id: selectedRecipient.id,
        name: selectedRecipient.name,
        username: selectedRecipient.username,
        avatar: selectedRecipient.avatar,
      });
    }
  };

  const handleRequest = () => {
    if (selectedRecipient) {
      closeSheet();
      navigation.navigate("RequestAmount", {
        id: selectedRecipient.id,
        name: selectedRecipient.name,
        username: selectedRecipient.username,
        avatar: selectedRecipient.avatar,
      });
    }
  };

  const renderItem = ({ item }: { item: Recipient }) => {
    if (item.isRequest) {
      return (
        <View style={[styles.row, { justifyContent: 'space-between', alignItems: 'center' }]}>
          <TouchableOpacity 
            style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
            onPress={() => {
              if (item.userId) {
                navigation.navigate("ContactsProfile", {
                  id: item.userId,
                  name: item.name,
                  username: item.username,
                  avatar: item.avatar,
                });
              }
            }}
            activeOpacity={0.7}
          >
            <Image source={{ uri: item.avatar }} style={styles.avatar} />
            <View style={[styles.rowInfo, { marginLeft: 12, flex: 1 }]}>
              <Text style={[Typography.bodyLg, styles.rowName]}>{item.name}</Text>
              <Text style={[Typography.body, styles.rowUsername]}>{item.username}</Text>
            </View>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity 
              style={{ backgroundColor: Colors.surface, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 }}
              onPress={() => rejectContactRequest(item.id)}
            >
              <Text style={[Typography.body, { color: Colors.textPrimary, fontWeight: '600' }]}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={{ backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 }}
              onPress={() => approveContactRequest(item.id)}
            >
              <Text style={[Typography.body, { color: Colors.secondary, fontWeight: '600' }]}>Accept</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.7}
        onPress={() => openSheet(item)}
      >
        <View style={styles.avatarContainer}>
          <Image source={{ uri: item.avatar }} style={styles.avatar} />
          {item.isOnAza && (
            <View style={styles.azaBadge}>
              <Image
                source={AZA_ICON}
                style={{ width: 10, height: 10, tintColor: "#FFFFFF" }}
                resizeMode="contain"
              />
            </View>
          )}
        </View>
        <View style={styles.rowInfo}>
          <View style={styles.nameRow}>
            <Text style={[Typography.bodyLg, styles.rowName]}>{item.name}</Text>
          </View>
          <Text style={[Typography.body, styles.rowUsername]}>
            {item.username}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderFavorite = ({ item }: { item: Recipient }) => (
    <TouchableOpacity
      style={styles.favoriteItem}
      activeOpacity={0.8}
      onPress={() => openSheet(item)}
    >
      <View style={styles.favoriteAvatarContainer}>
        <Image source={{ uri: item.avatar }} style={styles.favoriteAvatar} />
        <View style={styles.favoriteBadge}>
          <Image
            source={AZA_ICON}
            style={{ width: 12, height: 12, tintColor: "#FFFFFF" }}
            resizeMode="contain"
          />
        </View>
      </View>
      <Text style={styles.favoriteName} numberOfLines={1}>
        {item.name.split(" ")[0]}
      </Text>
    </TouchableOpacity>
  );

  return (
    <>
      <SafeAreaView style={styles.container}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={Colors.background}
        />

        {/* Header */}
        <View style={styles.header}>
          <Text style={[Typography.h1, styles.title]}>Contacts</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {/* Blocked users */}
            <TouchableOpacity
              style={styles.headerIconButton}
              activeOpacity={0.8}
              onPress={() => setShowBlockedModal(true)}
              accessibilityLabel="Blocked users"
            >
              <Feather name="slash" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
            {/* Pending requests badge */}
            <TouchableOpacity
              style={styles.requestsBadgeButton}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('RequestPending')}
              accessibilityLabel={`Friend requests${
                contactRequests.length > 0 ? `, ${contactRequests.length} pending` : ''
              }`}
            >
              <Feather name="user-check" size={20} color={Colors.textSecondary} />
              {contactRequests.length > 0 && (
                <View style={styles.requestsBadge}>
                  <Text style={styles.requestsBadgeText}>
                    {contactRequests.length > 9 ? '9+' : contactRequests.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            {/* Invite */}
            <TouchableOpacity
              style={styles.inviteButton}
              activeOpacity={0.8}
              onPress={() => setShowInviteModal(true)}
            >
              <MaterialCommunityIcons
                name="party-popper"
                size={20}
                color={Colors.secondary}
              />
              <Text style={styles.inviteButtonText}>Invite</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar Row */}
        <View style={styles.searchRow}>
          <View style={styles.searchContainer}>
            <Feather
              name="search"
              size={20}
              color={Colors.textSecondary}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Name, tag, email, phone number"
              placeholderTextColor={Colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <TouchableOpacity
            style={styles.addButton}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('AddFriends')}
          >
            <Feather name="plus" size={24} color={Colors.secondary} />
          </TouchableOpacity>
        </View>

        {/* Favorites Header */}
        {favorites.length > 0 && !searchQuery && (
          <View style={styles.favoritesSection}>
            <Text style={styles.sectionTitle}>Frequent</Text>
            <FlatList
              horizontal
              data={favorites}
              keyExtractor={(item) => `fav-${item.id}`}
              renderItem={renderFavorite}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.favoritesList}
            />
          </View>
        )}

        {/* List */}
        {isLoading && contactsList.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : sections.length === 0 && !searchQuery ? (
          <View style={styles.emptyContainer}>
            <Feather name="users" size={48} color={Colors.textSecondary} />
            <Text style={[Typography.bodyLg, styles.emptyTitle]}>No contacts yet</Text>
            <Text style={[Typography.body, styles.emptySubtitle]}>
              Sync your phone contacts or add people by their @tag
            </Text>
          </View>
        ) : sections.length === 0 && searchQuery ? (
          <View style={styles.emptyContainer}>
            <Feather name="search" size={48} color={Colors.textSecondary} />
            <Text style={[Typography.bodyLg, styles.emptyTitle]}>No results</Text>
            <Text style={[Typography.body, styles.emptySubtitle]}>
              No contacts match "{searchQuery}"
            </Text>
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            renderItem={renderItem}
            renderSectionHeader={({ section: { title } }) => (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>{title}</Text>
              </View>
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled={false}
            refreshControl={
              <RefreshControl
                refreshing={isLoading && contactsList.length > 0}
                onRefresh={handleRefresh}
                tintColor={Colors.primary}
              />
            }
          />
        )}
      </SafeAreaView>

      {/* Detail Bottom Sheet Modal manually managed via native Modal component */}
      <Modal
        visible={!!selectedRecipient}
        animationType="slide"
        transparent={true}
        onRequestClose={closeSheet}
      >
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={closeSheet}>
            <View style={styles.bottomSheetBackdrop} />
          </TouchableWithoutFeedback>

          <View style={styles.bottomSheetContainer}>
            <View style={styles.bottomSheetHeader}>
              <TouchableOpacity style={styles.closeButton} onPress={closeSheet}>
                <AntDesign name="close" size={20} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {selectedRecipient && (
              <View style={styles.sheetContent}>
                <Image
                  source={{ uri: selectedRecipient.avatar }}
                  style={styles.sheetAvatar}
                />
                <Text style={[Typography.h3, styles.sheetName]}>
                  {selectedRecipient.name}
                </Text>
                <Text style={[Typography.body, styles.sheetUsername]}>
                  {selectedRecipient.username}
                </Text>

                <View style={styles.bottomSheetDivider} />

                <View style={styles.sheetActions}>
                  <View style={styles.actionItem}>
                    <TouchableOpacity
                      style={styles.actionCircleButton}
                      activeOpacity={0.8}
                      onPress={handleSend}
                    >
                      <Feather
                        name="arrow-up"
                        size={24}
                        color={Colors.secondary}
                      />
                    </TouchableOpacity>
                    <Text style={styles.actionLabel}>Send</Text>
                  </View>

                  <View style={styles.actionItem}>
                    <TouchableOpacity
                      style={styles.actionCircleButton}
                      activeOpacity={0.8}
                      onPress={handleRequest}
                    >
                      <Feather
                        name="arrow-down"
                        size={24}
                        color={Colors.secondary}
                      />
                    </TouchableOpacity>
                    <Text style={styles.actionLabel}>Request</Text>
                  </View>

                  <View style={styles.actionItem}>
                    <TouchableOpacity
                      style={styles.actionCircleButton}
                      activeOpacity={0.8}
                      onPress={() => {
                        if (selectedRecipient) {
                          closeSheet();
                          navigation.navigate("ContactsProfile", {
                            id: selectedRecipient.id,
                            name: selectedRecipient.name,
                            username: selectedRecipient.username,
                            avatar: selectedRecipient.avatar,
                          });
                        }
                      }}
                    >
                      <Feather name="user" size={24} color={Colors.secondary} />
                    </TouchableOpacity>
                    <Text style={styles.actionLabel}>View</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Invite Friends Modal */}
      <Modal
        visible={showInviteModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowInviteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setShowInviteModal(false)}>
            <View style={styles.bottomSheetBackdrop} />
          </TouchableWithoutFeedback>

          <View
            style={[styles.bottomSheetContainer, styles.inviteSheetContainer]}
          >
            <View style={styles.bottomSheetHeader}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowInviteModal(false)}
              >
                <AntDesign name="close" size={20} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.inviteContent}>
              <View style={styles.stackedAvatars}>
                <Image
                  source={{ uri: INITIAL_RECIPIENTS[0]?.avatar }}
                  style={[styles.stackedAvatar, { zIndex: 3 }]}
                />
                <Image
                  source={{ uri: INITIAL_RECIPIENTS[1]?.avatar }}
                  style={[styles.stackedAvatar, { zIndex: 2, marginLeft: -12 }]}
                />
                <Image
                  source={{ uri: INITIAL_RECIPIENTS[2]?.avatar }}
                  style={[styles.stackedAvatar, { zIndex: 1, marginLeft: -12 }]}
                />
              </View>

              <Text style={[Typography.h1, styles.inviteTitle]}>
                Invite friends
              </Text>
              <Text style={[Typography.body, styles.inviteDescription]}>
                Let's grow our community together! Every friend you invite helps
                make Aza better.
              </Text>

              <View style={styles.inviteInputRow}>
                <TextInput
                  style={styles.inviteInput}
                  placeholder="Email or Username"
                  placeholderTextColor={Colors.textSecondary}
                  value={inviteQuery}
                  onChangeText={setInviteQuery}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={styles.sendInviteButton}
                  onPress={() => {
                    Alert.alert(
                      "Invite Sent",
                      `We've sent an invitation to ${inviteQuery}`,
                    );
                    setInviteQuery("");
                  }}
                >
                  <Text style={styles.sendInviteText}>Send invite</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inviteActionsRow}>
                <Button
                  title="Copy link"
                  onPress={() => {
                    Alert.alert(
                      "Link Copied",
                      "Referral link copied to clipboard",
                    );
                  }}
                  leftIcon={
                    <Feather name="link" size={18} color={Colors.white} />
                  }
                  width="48%"
                  paddingVertical={12}
                  borderRadius={10}
                />
                <Button
                  title="Share"
                  onPress={async () => {
                    try {
                      await Share.share({
                        message:
                          "Join me on Aza ! https://aza.app/invite/user123",
                      });
                    } catch (e) {
                      console.log(e);
                    }
                  }}
                  width="48%"
                  paddingVertical={12}
                  borderRadius={10}
                  backgroundColor={Colors.secondary}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>


      {/* Blocked Users Modal */}
      <Modal
        visible={showBlockedModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowBlockedModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setShowBlockedModal(false)}>
            <View style={styles.bottomSheetBackdrop} />
          </TouchableWithoutFeedback>

          <View style={[styles.bottomSheetContainer, { maxHeight: '80%', paddingBottom: Spacing.xl }]}>
            <View style={[styles.bottomSheetHeader, { justifyContent: 'space-between', alignItems: 'center' }]}>
              <Text style={[Typography.h3, { color: Colors.textPrimary }]}>Blocked Contacts</Text>
              <TouchableOpacity style={styles.closeButton} onPress={() => setShowBlockedModal(false)}>
                <AntDesign name="close" size={20} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {isLoading && blockedUsers.length === 0 ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
              </View>
            ) : blockedUsers.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Feather name="shield" size={48} color={Colors.textSecondary} />
                <Text style={[Typography.bodyLg, styles.emptyTitle, { marginTop: 16 }]}>No blocked users</Text>
                <Text style={[Typography.body, styles.emptySubtitle, { textAlign: 'center' }]}>
                  When you block someone, they will appear here.
                </Text>
              </View>
            ) : (
              <FlatList
                data={blockedUsers}
                keyExtractor={(item) => item.blockedUserId}
                renderItem={({ item }) => (
                  <View style={styles.blockedUserRow}>
                    <View style={styles.blockedUserInfo}>
                      <Image 
                        source={{ uri: item.profileImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.displayName)}&background=random` }} 
                        style={styles.blockedAvatar} 
                      />
                      <View style={{ marginLeft: 12 }}>
                        <Text style={[Typography.bodyLg, { fontWeight: '600', color: Colors.textPrimary }]}>{item.displayName}</Text>
                        {item.handle && <Text style={[Typography.body, { color: Colors.textSecondary }]}>@{item.handle}</Text>}
                      </View>
                    </View>
                    <TouchableOpacity 
                      style={styles.unblockButton}
                      onPress={() => {
                        Alert.alert("Unblock", `Are you sure you want to unblock ${item.displayName}?`, [
                          { text: "Cancel", style: "cancel" },
                          { text: "Unblock", onPress: () => unblockUser(item.blockedUserId) }
                        ]);
                      }}
                    >
                      <Text style={styles.unblockButtonText}>Unblock</Text>
                    </TouchableOpacity>
                  </View>
                )}
                contentContainerStyle={{ padding: Spacing.lg }}
              />
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      marginBottom: Spacing.md,
    },
    title: {
      color: Colors.textPrimary,
      fontWeight: "700",
      fontSize: 28,
    },
    headerIconButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: Spacing.xs,
    },
    requestsBadgeButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: Spacing.xs,
    },
    requestsBadge: {
      position: 'absolute',
      top: 6,
      right: 4,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: Colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
      borderWidth: 1.5,
      borderColor: Colors.background,
    },
    requestsBadgeText: {
      fontSize: 9,
      fontWeight: '700',
      color: Colors.secondary,
      lineHeight: 13,
    },
    othersEmptyPlaceholder: {
      alignItems: 'center',
      paddingVertical: Spacing.xl,
      paddingHorizontal: Spacing.lg,
    },
    othersEmptyText: {
      color: Colors.textSecondary,
      fontWeight: '600',
      marginTop: Spacing.sm,
      textAlign: 'center',
    },
    othersEmptySubText: {
      color: Colors.textSecondary,
      textAlign: 'center',
      marginTop: 4,
      lineHeight: 18,
    },
    inviteButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: Colors.primary,
      height: 44,
      paddingHorizontal: Spacing.md,
      borderRadius: Radius.full,
    },
    inviteButtonText: {
      ...Typography.button,
      color: Colors.secondary,
      marginLeft: 6,
      fontSize: 15,
    },
    searchRow: {
      flexDirection: "row",
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.lg,
      alignItems: "center",
    },
    searchContainer: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDark ? Colors.surface : "#EBEBEB",
      borderRadius: Radius.full, // Precise pill shape matching design
      paddingHorizontal: Spacing.md,
      height: 48,
    },
    searchIcon: {
      marginRight: Spacing.xs,
    },
    searchInput: {
      flex: 1,
      ...Typography.body,
      fontSize: 15,
      color: Colors.textPrimary,
      height: "100%",
    },
    addButton: {
      width: 44,
      height: 44,
      borderRadius: Radius.full,
      backgroundColor: Colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: Spacing.sm,
    },
    listContent: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.xl * 2,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: Spacing.sm,
      marginBottom: Spacing.xs,
    },
    avatar: {
      width: 50,
      height: 50,
      borderRadius: Radius.full,
    },
    rowInfo: {
      flex: 1,
      marginLeft: Spacing.md,
    },
    rowName: {
      fontWeight: "700",
      color: Colors.textPrimary,
      marginBottom: 2,
      fontSize: 16,
    },
    rowUsername: {
      color: Colors.primary,
      fontWeight: "500",
    },
    modalOverlay: {
      flex: 1,
      justifyContent: "flex-end",
    },
    bottomSheetBackdrop: {
      ...StyleSheet.absoluteFill,
      backgroundColor: Colors.black70,
    },
    bottomSheetContainer: {
      backgroundColor: Colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.xl * 2,
    },
    bottomSheetHeader: {
      flexDirection: "row",
      justifyContent: "flex-start",
      marginBottom: 10,
    },
    closeButton: {
      backgroundColor: isDark ? Colors.surface : "#F3F4F6",
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    sheetContent: {
      alignItems: "center",
      marginTop: 0,
    },
    sheetAvatar: {
      width: 90,
      height: 90,
      borderRadius: Radius.full,
      marginBottom: Spacing.md,
    },
    sheetName: {
      color: Colors.textPrimary,
      fontWeight: "700",
      marginBottom: 2,
      fontSize: 18,
    },
    sheetUsername: {
      color: Colors.primary,
      fontWeight: "600",
    },
    bottomSheetDivider: {
      height: 1,
      width: "100%",
      backgroundColor: Colors.border,
      marginTop: Spacing.lg,
      marginBottom: Spacing.lg,
    },
    sheetActions: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 40,
      width: "100%",
    },
    actionItem: {
      alignItems: "center",
      width: 80,
    },
    actionCircleButton: {
      width: 60,
      height: 60,
      borderRadius: Radius.full,
      backgroundColor: Colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: Spacing.sm,
    },
    actionLabel: {
      ...Typography.body,
      fontWeight: "700",
      color: Colors.primary,
    },
    inviteSheetContainer: {
      paddingBottom: Spacing.xl,
      maxHeight: "90%",
    },
    inviteContent: {
      alignItems: "flex-start",
      marginTop: Spacing.sm,
    },
    stackedAvatars: {
      flexDirection: "row",
      marginBottom: Spacing.md,
    },
    stackedAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: Colors.background,
    },
    inviteTitle: {
      color: Colors.textPrimary,
      fontSize: 24,
      lineHeight: 28,
      marginBottom: Spacing.sm,
    },
    inviteDescription: {
      color: Colors.textSecondary,
      marginBottom: Spacing.lg,
      lineHeight: 20,
    },
    inviteInputRow: {
      flexDirection: "row",
      width: "100%",
      height: 52,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: 12,
      overflow: "hidden",
      marginBottom: Spacing.xl,
    },
    inviteInput: {
      flex: 1,
      paddingHorizontal: Spacing.md,
      ...Typography.body,
      color: Colors.textPrimary,
    },
    sendInviteButton: {
      backgroundColor: Colors.white,
      paddingHorizontal: Spacing.md,
      justifyContent: "center",
      borderLeftWidth: 1,
      borderLeftColor: Colors.border,
    },
    sendInviteText: {
      ...Typography.body,
      fontWeight: "600",
      color: Colors.textPrimary,
    },
    inviteActionsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      width: "100%",
    },
    avatarContainer: {
      position: "relative",
    },
    azaBadge: {
      position: "absolute",
      bottom: -2,
      right: -2,
      backgroundColor: Colors.primary,
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 2,
      borderColor: Colors.background,
      alignItems: "center",
      justifyContent: "center",
    },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    favoritesSection: {
      paddingLeft: Spacing.lg,
      marginBottom: Spacing.lg,
    },
    sectionTitle: {
      ...Typography.caption,
      fontWeight: "700",
      color: Colors.textSecondary,
      marginBottom: Spacing.sm,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    favoritesList: {
      paddingRight: Spacing.lg,
    },
    favoriteItem: {
      alignItems: "center",
      marginRight: 20,
      width: 64,
    },
    favoriteAvatarContainer: {
      position: "relative",
      marginBottom: 6,
    },
    favoriteAvatar: {
      width: 60,
      height: 60,
      borderRadius: 30,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    favoriteBadge: {
      position: "absolute",
      bottom: 0,
      right: 0,
      backgroundColor: Colors.primary,
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: Colors.background,
      alignItems: "center",
      justifyContent: "center",
    },
    favoriteName: {
      ...Typography.caption,
      fontWeight: "600",
      color: Colors.textPrimary,
      textAlign: "center",
    },
    sectionHeader: {
      backgroundColor: Colors.background,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
    },
    sectionHeaderText: {
      ...Typography.caption,
      fontWeight: "700",
      color: Colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    addUserModalContainer: {
      width: "100%",
      paddingHorizontal: Spacing.lg,
      marginBottom: 40,
    },
    addUserContent: {
      backgroundColor: Colors.background,
      borderRadius: 16,
      padding: Spacing.lg,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 5,
    },
    addUserHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: Spacing.md,
    },
    addUserSubtitle: {
      color: Colors.textSecondary,
      marginBottom: Spacing.lg,
      lineHeight: 20,
    },
    addUserInputContainer: {
      width: "100%",
      height: 52,
      backgroundColor: Colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Colors.border,
      paddingHorizontal: Spacing.md,
      justifyContent: "center",
      marginBottom: Spacing.lg,
    },
    addUserInput: {
      ...Typography.body,
      color: Colors.textPrimary,
    },
    globalSearchResults: {
      marginTop: -Spacing.md,
      marginBottom: Spacing.md,
    },
    globalSearchButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDark ? Colors.surface : "#F3F4F6",
      padding: Spacing.sm,
      borderRadius: Radius.md,
    },
    globalSearchButtonText: {
      ...Typography.caption,
      color: Colors.primary,
      marginLeft: Spacing.xs,
      fontWeight: "600",
    },
    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingTop: Spacing.xl * 2,
    },
    emptyContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingTop: Spacing.xl * 2,
      paddingHorizontal: Spacing.xl,
    },
    emptyTitle: {
      fontWeight: "700",
      color: Colors.textPrimary,
      marginTop: Spacing.md,
      marginBottom: Spacing.xs,
      textAlign: "center",
    },
    emptySubtitle: {
      color: Colors.textSecondary,
      textAlign: "center",
      lineHeight: 20,
    },
    blockedUserRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: Colors.border,
    },
    blockedUserInfo: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
    blockedAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
    },
    unblockButton: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      backgroundColor: isDark ? Colors.surface : "#f3f4f6",
      borderRadius: Radius.full,
    },
    unblockButtonText: {
      ...Typography.caption,
      fontWeight: "600",
      color: Colors.textPrimary,
    },
  });
}
