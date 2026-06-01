import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  StatusBar,
  Animated,
  TextInput,
  Easing,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from '@react-native-vector-icons/feather';
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";
import { useContactStore } from "../../../store/contactStore";
import { useChatStore } from "../../../store/chatStore";
import { usePresenceStore } from "../../../store/presenceStore";
import { Contact } from "../../../features/contacts/types";
import {
  useAppTheme,
  ThemeColors,
  Typography,
  Spacing,
  Radius,
} from "../../../theme";



export default function ChatContactsScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchAnim = React.useRef(new Animated.Value(0)).current;

  const { contacts, isLoading, fetchContacts } = useContactStore();
  const chats = useChatStore((s) => s.chats);
  const fetchChats = useChatStore((s) => s.fetchChats);
  const isOnline = usePresenceStore((s) => s.isOnline);

  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  useEffect(() => {
    fetchContacts();
    fetchChats().catch(() => {});
  }, []);

  // Build a quick lookup: otherUserId → most-recent chat summary.
  const chatByPeer = React.useMemo(() => {
    const out: Record<string, (typeof chats)[string]> = {};
    for (const c of Object.values(chats)) out[c.otherUserId] = c;
    return out;
  }, [chats]);

  const toggleSearch = () => {
    if (searchActive) {
      Animated.timing(searchAnim, {
        toValue: 0,
        duration: 250,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }).start(() => {
        setSearchActive(false);
        setSearchQuery("");
      });
    } else {
      setSearchActive(true);
      Animated.timing(searchAnim, {
        toValue: 1,
        duration: 250,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }).start();
    }
  };

  const filteredContacts = React.useMemo(() => {
    let result = contacts;
    if (activeFilter === "Favorites") {
      result = result.filter(c => c.isFavorite);
    } else if (activeFilter === "Archived") {
      return [];
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        c =>
          c.displayName.toLowerCase().includes(q) ||
          (c.handle && c.handle.toLowerCase().includes(q))
      );
    }
    return result;
  }, [contacts, activeFilter, searchQuery]);

  const FILTERS = ["All", "Favorites", "Recent", "Archived"];

  const renderFilter = ({ item }: { item: string }) => {
    const isActive = activeFilter === item;
    return (
      <TouchableOpacity
        style={[styles.filterPill, isActive && styles.filterPillActive]}
        onPress={() => setActiveFilter(item)}
        activeOpacity={0.8}
      >
        <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
          {item}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderContact = ({ item }: { item: Contact }) => {
    const peerId = item.contactUserId || item.id;
    const chat = chatByPeer[peerId];
    // The hook routes off the peer's userId; chat resource resolves on open.
    const subtitle = chat?.lastMessageAt
      ? "Tap to open conversation"
      : item.handle
        ? `@${item.handle}`
        : "Tap to start a conversation";

    return (
      <TouchableOpacity
        style={styles.contactRow}
        activeOpacity={0.7}
        onPress={() =>
          navigation.navigate("ChatScreen", {
            id: peerId,
            name: item.displayName,
            avatar: item.profileImageUrl ?? "",
            online: isOnline(peerId),
          })
        }
      >
        <View style={styles.avatarContainer}>
          {item.profileImageUrl ? (
            <Image source={{ uri: item.profileImageUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>
                {item.displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{item.displayName}</Text>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        {chat && chat.unreadCount > 0 ? (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>
              {chat.unreadCount > 99 ? "99+" : String(chat.unreadCount)}
            </Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      <View style={styles.header}>
        {!searchActive ? (
          <>
            <Text style={[Typography.h1, styles.headerTitle]}>Chats</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.iconButton} activeOpacity={0.8} onPress={toggleSearch}>
                <Feather name="search" size={20} color={Colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconButton} activeOpacity={0.8}>
                <Feather
                  name="more-horizontal"
                  size={20}
                  color={Colors.textPrimary}
                />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <Animated.View style={[styles.searchContainer, { opacity: searchAnim, transform: [{ scaleX: searchAnim }] }]}>
            <View style={styles.searchInputWrapper}>
              <Feather name="search" size={18} color={Colors.textSecondary} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search contacts..."
                placeholderTextColor={Colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")} activeOpacity={0.7} style={{ padding: 4 }}>
                  <Feather name="x-circle" size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity onPress={toggleSearch} style={styles.cancelSearchBtn}>
              <Text style={styles.cancelSearchText}>Cancel</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>

      <View style={styles.filtersContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTERS}
          renderItem={renderFilter}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.filtersListContent}
        />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredContacts}
          renderItem={renderContact}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.contactsListContent,
            filteredContacts.length === 0 && styles.contactsListEmpty,
          ]}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="users" size={52} color={Colors.textSecondary} />
              <Text style={styles.emptyTitle}>
                {activeFilter === "Favorites"
                  ? "No favorites yet"
                  : activeFilter === "Archived"
                  ? "No archived chats"
                  : searchQuery.trim()
                  ? "No results found"
                  : "No contacts yet"}
              </Text>
              <Text style={styles.emptyText}>
                {activeFilter === "Favorites"
                  ? "Mark contacts as favorites to find them here."
                  : activeFilter === "Archived"
                  ? "Archived conversations will appear here."
                  : searchQuery.trim()
                  ? `No contacts match "${searchQuery}".`
                  : "Add contacts from the Contacts tab to start chatting."}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
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
    headerTitle: {
      color: Colors.textPrimary,
      fontWeight: "700",
      fontSize: 28,
    },
    headerActions: {
      flexDirection: "row",
      gap: Spacing.sm,
    },
    iconButton: {
      width: 44,
      height: 44,
      borderRadius: Radius.full,
      backgroundColor: isDark ? Colors.surface : "#F3F4F6",
      alignItems: "center",
      justifyContent: "center",
    },
    searchContainer: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      height: 44,
    },
    searchInputWrapper: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDark ? Colors.surface : "#F3F4F6",
      borderRadius: Radius.full,
      paddingHorizontal: Spacing.md,
      height: "100%",
    },
    searchInput: {
      flex: 1,
      ...Typography.body,
      color: Colors.textPrimary,
      paddingVertical: 0,
    },
    cancelSearchBtn: {
      marginLeft: Spacing.sm,
      paddingHorizontal: Spacing.xs,
    },
    cancelSearchText: {
      ...Typography.body,
      color: Colors.primary,
      fontWeight: "500",
    },
    filtersContainer: {
      marginBottom: Spacing.md,
    },
    filtersListContent: {
      paddingHorizontal: Spacing.lg,
      gap: Spacing.sm,
    },
    filterPill: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.full,
      backgroundColor: isDark ? Colors.surface : "#F3F4F6",
      justifyContent: "center",
      alignItems: "center",
    },
    filterPillActive: {
      backgroundColor: Colors.primary,
    },
    filterText: {
      ...Typography.body,
      fontWeight: "500",
      color: Colors.textSecondary,
    },
    filterTextActive: {
      color: Colors.secondary,
    },
    contactsListContent: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.xl * 2,
    },
    contactsListEmpty: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    contactRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: Spacing.sm,
      marginBottom: Spacing.xs,
    },
    avatarContainer: {
      position: "relative",
      marginRight: Spacing.md,
    },
    avatar: {
      width: 50,
      height: 50,
      borderRadius: Radius.full,
    },
    avatarPlaceholder: {
      backgroundColor: Colors.primary + "33",
      alignItems: "center",
      justifyContent: "center",
    },
    avatarInitial: {
      fontSize: 20,
      fontWeight: "700",
      color: Colors.primary,
    },
    contactInfo: {
      flex: 1,
      justifyContent: "center",
    },
    contactName: {
      fontWeight: "700",
      color: Colors.textPrimary,
      marginBottom: 2,
      fontSize: 16,
    },
    lastMessage: {
      ...Typography.body,
      color: Colors.textSecondary,
    },
    emptyContainer: {
      flex: 1,
      padding: Spacing.xl * 2,
      alignItems: "center",
      justifyContent: "center",
      gap: Spacing.sm,
    },
    emptyTitle: {
      ...Typography.h2,
      color: Colors.textPrimary,
      fontWeight: "700",
      textAlign: "center",
      marginTop: Spacing.md,
    },
    emptyText: {
      ...Typography.body,
      color: Colors.textSecondary,
      textAlign: "center",
      lineHeight: 22,
    },
    unreadBadge: {
      minWidth: 22,
      height: 22,
      paddingHorizontal: 6,
      borderRadius: 11,
      backgroundColor: Colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: Spacing.sm,
    },
    unreadBadgeText: {
      color: Colors.secondary,
      fontSize: 11,
      fontWeight: "700",
    },
  });
}
