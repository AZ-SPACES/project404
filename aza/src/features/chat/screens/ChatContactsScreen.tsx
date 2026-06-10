import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  Animated,
  TextInput,
  Easing,
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
  Alert,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@react-native-vector-icons/feather";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";
import { useContactStore } from "../../../store/contactStore";
import { useChatStore } from "../../../store/chatStore";
import { usePresenceStore } from "../../../store/presenceStore";
import { usePinnedStore } from "../../../store/pinnedChatsStore";
import { useChatFiltersStore } from "../../../store/chatFiltersStore";
import { useDraftStore } from "../../../store/draftStore";
import { useSavedMessagesStore } from "../../../store/savedMessagesStore";
import { Contact } from "../../../features/contacts/types";
import { ChatMoreModal } from "../../../components/chat/ChatMoreModal";
import type { MoreAction, MenuAnchor } from "../../../components/chat/chatTypes";
import {
  useAppTheme,
  ThemeColors,
  Typography,
  Spacing,
  Radius,
} from "../../../theme";

// ─── Timestamp helper ─────────────────────────────────────────────────────────

function formatChatTimestamp(isoString: string | null | undefined): string {
  if (!isoString) return "";
  const raw = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(isoString)
    ? isoString
    : `${isoString}Z`;
  const ms = Date.parse(raw);
  if (isNaN(ms)) return "";

  const now = Date.now();
  const diff = now - ms;
  const date = new Date(ms);
  const today = new Date(now);

  if (diff < 60_000) return "now";
  if (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  )
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const yesterday = new Date(now - 86_400_000);
  if (
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()
  )
    return "Yesterday";

  if (diff < 7 * 86_400_000)
    return date.toLocaleDateString([], { weekday: "short" });

  return date.toLocaleDateString([], { day: "numeric", month: "short" });
}

// ─── Status ticks ─────────────────────────────────────────────────────────────

type MessageStatus = "pending" | "sent" | "delivered" | "read" | "failed";

function StatusTicks({ status, color }: { status: MessageStatus; color: string }) {
  if (status === "pending" || status === "failed")
    return <Feather name="clock" size={11} color={color} />;
  const tickColor = status === "read" ? "#3B82F6" : color;
  if (status === "sent")
    return <Feather name="check" size={12} color={tickColor} />;
  return (
    <View style={{ flexDirection: "row" }}>
      <Feather name="check" size={12} color={tickColor} style={{ marginRight: -5 }} />
      <Feather name="check" size={12} color={tickColor} />
    </View>
  );
}

// ─── Swipeable row ────────────────────────────────────────────────────────────

type SwipeableRowProps = {
  onArchive: (() => void) | undefined;
  onDelete: (() => void) | undefined;
  onPin: (() => void) | undefined;
  children: React.ReactNode;
};

const SwipeableRow = memo(function SwipeableRow({
  onArchive,
  onDelete,
  onPin,
  children,
}: SwipeableRowProps) {
  const renderRightActions = () => {
    if (!onArchive && !onDelete) return null;
    return (
      <View style={{ flexDirection: "row", alignItems: "stretch" }}>
        {onArchive && (
          <TouchableOpacity
            style={swipeActionStyles.archiveAction}
            onPress={onArchive}
            activeOpacity={0.85}
          >
            <Feather name="archive" size={22} color="#fff" />
            <Text style={swipeActionStyles.actionLabel}>Archive</Text>
          </TouchableOpacity>
        )}
        {onDelete && (
          <TouchableOpacity
            style={swipeActionStyles.deleteAction}
            onPress={onDelete}
            activeOpacity={0.85}
          >
            <Feather name="trash-2" size={22} color="#fff" />
            <Text style={swipeActionStyles.actionLabel}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderLeftActions = () => {
    if (!onPin) return null;
    return (
      <TouchableOpacity
        style={swipeActionStyles.pinAction}
        onPress={onPin}
        activeOpacity={0.85}
      >
        <Feather name="bookmark" size={22} color="#fff" />
        <Text style={swipeActionStyles.actionLabel}>Pin</Text>
      </TouchableOpacity>
    );
  };

  return (
    <Swipeable
      renderRightActions={renderRightActions}
      renderLeftActions={renderLeftActions}
      friction={2}
      overshootRight={false}
      overshootLeft={false}
    >
      {children}
    </Swipeable>
  );
});

const swipeActionStyles = StyleSheet.create({
  archiveAction: {
    width: 80,
    backgroundColor: "#F59E0B",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  deleteAction: {
    width: 80,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  pinAction: {
    width: 80,
    backgroundColor: "#22C55E",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  actionLabel: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
});

// ─── Pinned section ───────────────────────────────────────────────────────────

type PinnedSectionProps = {
  contacts: Contact[];
  chatByPeer: Record<string, any>;
  isOnline: (id: string) => boolean;
  onPress: (c: Contact) => void;
  onLongPress: (peerId: string) => void;
  styles: ReturnType<typeof createStyles>;
  Colors: ThemeColors;
};

const PinnedSection = memo(function PinnedSection({
  contacts,
  chatByPeer,
  isOnline,
  onPress,
  onLongPress,
  styles,
  Colors,
}: PinnedSectionProps) {
  if (contacts.length === 0) return null;

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pinnedList}
      >
        {contacts.map((contact) => {
          const peerId = contact.contactUserId || contact.id;
          const chat = chatByPeer[peerId];
          const online = isOnline(peerId);
          const unread = chat?.unreadCount ?? 0;

          return (
            <TouchableOpacity
              key={contact.id}
              style={styles.pinnedItem}
              activeOpacity={0.7}
              onPress={() => onPress(contact)}
              onLongPress={() => onLongPress(peerId)}
              delayLongPress={400}
            >
              <View style={styles.pinnedAvatarWrap}>
                {contact.profileImageUrl ? (
                  <Image
                    source={{ uri: contact.profileImageUrl }}
                    style={styles.pinnedAvatar}
                  />
                ) : (
                  <View style={[styles.pinnedAvatar, styles.pinnedAvatarPlaceholder]}>
                    <Text style={styles.pinnedAvatarInitial}>
                      {contact.displayName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                {online && <View style={styles.pinnedOnlineDot} />}
                {unread > 0 && (
                  <View style={styles.pinnedBadge}>
                    <Text style={styles.pinnedBadgeText}>
                      {unread > 9 ? "9+" : String(unread)}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.pinnedName} numberOfLines={1}>
                {contact.displayName.split(" ")[0]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <View style={styles.pinnedDivider} />
    </View>
  );
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ChatContactsScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);

  const [activeFilter, setActiveFilter] = useState("All");

  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchAnim = React.useRef(new Animated.Value(0)).current;

  // Header more-menu
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [moreMenuAnchor, setMoreMenuAnchor] = useState<MenuAnchor | null>(null);
  const moreButtonRef = useRef<React.ElementRef<typeof TouchableOpacity>>(null);

  // Long-press context menu
  const [contextContact, setContextContact] = useState<Contact | null>(null);
  const [contextMenuAnchor, setContextMenuAnchor] = useState<MenuAnchor | null>(null);

  // Select mode
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Custom filter creation/rename — false = hidden, true = create, string = rename (filter ID)
  const [showCreateFilter, setShowCreateFilter] = useState<boolean | string>(false);
  const [newFilterName, setNewFilterName] = useState("");

  const { contacts, isLoading, fetchContacts } = useContactStore();
  const chats = useChatStore((s) => s.chats);
  const fetchChats = useChatStore((s) => s.fetchChats);
  const markRead = useChatStore((s) => s.markRead);
  const archiveChat = useChatStore((s) => s.archiveChat);
  const muteChat = useChatStore((s) => s.muteChat);
  const clearChatMessages = useChatStore((s) => s.clearChatMessages);
  const isOnline = usePresenceStore((s) => s.isOnline);
  const { pinnedIds, load: loadPins, pin, unpin, isPinned } = usePinnedStore();
  const {
    filters: customFilters,
    load: loadFilters,
    create: createFilter,
    rename: renameFilter,
    delete: deleteFilter,
    addPeer,
    removePeer,
  } = useChatFiltersStore();

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const getDraft = useDraftStore(s => s.getDraft);
  const drafts = useDraftStore(s => s.drafts);
  const savedMessages = useSavedMessagesStore((s) => s.messages);

  useEffect(() => {
    fetchContacts();
    fetchChats().catch(() => {});
    loadPins();
    loadFilters();
  }, []);

  // peerId → ChatSummary
  const chatByPeer = React.useMemo(() => {
    const out: Record<string, (typeof chats)[string]> = {};
    for (const c of Object.values(chats)) out[c.otherUserId] = c;
    return out;
  }, [chats]);

  // Pinned contacts (preserve pin order)
  const pinnedContacts = React.useMemo((): Contact[] => {
    return pinnedIds
      .map((peerId) => {
        const existing = contacts.find((c) => (c.contactUserId || c.id) === peerId);
        if (existing) return existing;
        const chat = chatByPeer[peerId];
        if (!chat) return null;
        return {
          id: peerId,
          contactUserId: peerId,
          displayName: chat.otherUserName,
          handle: chat.otherUserHandle,
          profileImageUrl: chat.otherUserAvatar,
          isAzaUser: true,
          isFavorite: false,
        } as Contact;
      })
      .filter((c): c is Contact => c !== null);
  }, [pinnedIds, contacts, chatByPeer]);

  // Archived: pull from chatStore; synthesise Contact for unknown peers
  const archivedItems = React.useMemo((): Contact[] => {
    return Object.values(chats)
      .filter((c) => c.isArchived)
      .map((chat) => {
        const existing = contacts.find(
          (c) => (c.contactUserId || c.id) === chat.otherUserId,
        );
        if (existing) return existing;
        return {
          id: chat.otherUserId,
          contactUserId: chat.otherUserId,
          displayName: chat.otherUserName,
          handle: chat.otherUserHandle,
          profileImageUrl: chat.otherUserAvatar,
          isAzaUser: true,
          isFavorite: false,
        } as Contact;
      });
  }, [chats, contacts]);

  // ── Select mode ────────────────────────────────────────────────────────────

  const enterSelectMode = useCallback(() => {
    setShowMoreMenu(false);
    setSelectMode(true);
    setSelectedIds(new Set());
  }, []);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleSelect = useCallback((peerId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(peerId) ? next.delete(peerId) : next.add(peerId);
      return next;
    });
  }, []);

  // ── Search ─────────────────────────────────────────────────────────────────

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

  const handleMorePress = () => {
    moreButtonRef.current?.measure((_x, _y, width, height, pageX, pageY) => {
      const sw = Dimensions.get("window").width;
      setMoreMenuAnchor({ top: pageY + height + 6, right: sw - pageX - width });
      setShowMoreMenu(true);
    });
  };

  const applySearch = (list: Contact[]): Contact[] => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((c) => {
      if (c.displayName.toLowerCase().includes(q)) return true;
      if (c.handle && c.handle.toLowerCase().includes(q)) return true;
      const chat = chatByPeer[c.contactUserId || c.id];
      if (chat?.lastMessagePreview?.toLowerCase().includes(q)) return true;
      return false;
    });
  };

  // ── Filtered contacts ──────────────────────────────────────────────────────

  const filteredContacts = React.useMemo(() => {
    // Custom filter
    const customFilter = customFilters.find((f) => f.id === activeFilter);
    if (customFilter) {
      const inFilter = contacts.filter((c) =>
        customFilter.peerIds.includes(c.contactUserId || c.id),
      );
      return applySearch(inFilter);
    }

    if (activeFilter === "Archived") return applySearch(archivedItems);

    if (activeFilter === "Favorites")
      return applySearch(contacts.filter((c) => c.isFavorite));

    if (activeFilter === "Unread") {
      const withUnread = contacts
        .filter((c) => {
          const chat = chatByPeer[c.contactUserId || c.id];
          return chat && chat.unreadCount > 0 && !chat.isArchived;
        })
        .sort((a, b) => {
          const aU = chatByPeer[a.contactUserId || a.id]?.unreadCount ?? 0;
          const bU = chatByPeer[b.contactUserId || b.id]?.unreadCount ?? 0;
          return bU - aU;
        });
      return applySearch(withUnread);
    }

    if (activeFilter === "Muted") {
      return applySearch(contacts.filter((c) => {
        const chat = chatByPeer[c.contactUserId || c.id];
        return chat?.isMuted === true && !chat.isArchived;
      }));
    }

    if (activeFilter === "Recent") {
      const withChats = contacts
        .filter((c) => {
          const chat = chatByPeer[c.contactUserId || c.id];
          return !!chat?.lastMessageAt && !chat.isArchived;
        })
        .sort((a, b) => {
          const aTs = chatByPeer[a.contactUserId || a.id]?.lastMessageAt;
          const bTs = chatByPeer[b.contactUserId || b.id]?.lastMessageAt;
          return (
            Date.parse(bTs ? `${bTs}Z` : "0") -
            Date.parse(aTs ? `${aTs}Z` : "0")
          );
        });
      return applySearch(withChats);
    }

    // "All" — exclude archived, contacts with recent chats bubble to top
    const sorted = [...contacts]
      .filter((c) => !chatByPeer[c.contactUserId || c.id]?.isArchived)
      .sort((a, b) => {
        const aChat = chatByPeer[a.contactUserId || a.id];
        const bChat = chatByPeer[b.contactUserId || b.id];
        const aTs = aChat?.lastMessageAt ? Date.parse(`${aChat.lastMessageAt}Z`) : 0;
        const bTs = bChat?.lastMessageAt ? Date.parse(`${bChat.lastMessageAt}Z`) : 0;
        if (bTs !== aTs) return bTs - aTs;
        return a.displayName.localeCompare(b.displayName);
      });
    return applySearch(sorted);
  }, [contacts, activeFilter, searchQuery, chatByPeer, archivedItems, customFilters]);

  // ── Header more-menu actions ───────────────────────────────────────────────

  const headerMoreActions: MoreAction[] = React.useMemo(
    () => [
      { icon: "check-square", label: "Select chats", onPress: enterSelectMode },
      {
        icon: "check-circle",
        label: "Mark all as read",
        onPress: () => {
          setShowMoreMenu(false);
          Object.values(chats)
            .filter((c) => c.unreadCount > 0)
            .forEach((c) => markRead(c.id).catch(() => {}));
        },
      },
      {
        icon: "archive",
        label: "Archived chats",
        onPress: () => {
          setShowMoreMenu(false);
          setActiveFilter("Archived");
        },
      },
    ],
    [chats, markRead, enterSelectMode],
  );

  // ── Long-press context menu actions ───────────────────────────────────────

  const contextMenuActions: MoreAction[] = React.useMemo(() => {
    if (!contextContact) return [];
    const peerId = contextContact.contactUserId || contextContact.id;
    const chat = chatByPeer[peerId];
    const pinned = isPinned(peerId);
    const actions: MoreAction[] = [];

    actions.push({
      icon: "map-pin",
      label: pinned ? "Unpin" : "Pin",
      onPress: () => {
        setContextContact(null);
        pinned ? unpin(peerId) : pin(peerId);
      },
    });

    if (chat) {
      if (chat.unreadCount > 0) {
        actions.push({
          icon: "check",
          label: "Mark as read",
          onPress: () => {
            setContextContact(null);
            markRead(chat.id).catch(() => {});
          },
        });
      }
      actions.push({
        icon: chat.isMuted ? "bell" : "bell-off",
        label: chat.isMuted ? "Unmute" : "Mute",
        onPress: () => {
          setContextContact(null);
          if (chat.isMuted) {
            muteChat(chat.id, false).catch(() => {});
          } else {
            Alert.alert("Mute Notifications", "For how long?", [
              { text: "1 hour",  onPress: () => muteChat(chat.id, true).catch(() => {}) },
              { text: "8 hours", onPress: () => muteChat(chat.id, true).catch(() => {}) },
              { text: "1 week",  onPress: () => muteChat(chat.id, true).catch(() => {}) },
              { text: "Always",  onPress: () => muteChat(chat.id, true).catch(() => {}) },
              { text: "Cancel",  style: "cancel" },
            ]);
          }
        },
      });
      actions.push({
        icon: "archive",
        label: chat.isArchived ? "Unarchive" : "Archive",
        onPress: () => {
          setContextContact(null);
          archiveChat(chat.id, !chat.isArchived).catch(() => {});
        },
      });
      actions.push({
        icon: "trash",
        label: "Clear Chat",
        color: "#F59E0B",
        onPress: () => {
          setContextContact(null);
          Alert.alert(
            "Clear Chat",
            `Clear all messages with ${contextContact?.displayName ?? "this contact"}? They can be reloaded from the server.`,
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Clear",
                style: "destructive",
                onPress: () => clearChatMessages(chat.id),
              },
            ]
          );
        },
      });
    }

    // Custom filter actions
    const activeCustomFilter = customFilters.find((f) => f.id === activeFilter);
    if (activeCustomFilter) {
      // In a custom filter view — offer removal
      actions.push({
        icon: "tag",
        label: `Remove from "${activeCustomFilter.name}"`,
        onPress: () => {
          setContextContact(null);
          removePeer(activeCustomFilter.id, peerId);
        },
      });
    } else if (customFilters.length > 0) {
      // Not in a custom filter — offer adding to any filter that doesn't already have this peer
      customFilters.forEach((f) => {
        if (!f.peerIds.includes(peerId)) {
          actions.push({
            icon: "tag",
            label: `Add to "${f.name}"`,
            onPress: () => {
              setContextContact(null);
              addPeer(f.id, peerId);
            },
          });
        }
      });
    }

    return actions;
  }, [contextContact, chatByPeer, isPinned, pin, unpin, markRead, muteChat, archiveChat, clearChatMessages, customFilters, activeFilter, addPeer, removePeer]);

  // ── Bulk actions ───────────────────────────────────────────────────────────

  const handleBulkMarkRead = useCallback(() => {
    selectedIds.forEach((peerId) => {
      const chat = chatByPeer[peerId];
      if (chat && chat.unreadCount > 0) markRead(chat.id).catch(() => {});
    });
    exitSelectMode();
  }, [selectedIds, chatByPeer, markRead, exitSelectMode]);

  const handleBulkArchive = useCallback(() => {
    selectedIds.forEach((peerId) => {
      const chat = chatByPeer[peerId];
      if (chat && !chat.isArchived) archiveChat(chat.id, true).catch(() => {});
    });
    exitSelectMode();
  }, [selectedIds, chatByPeer, archiveChat, exitSelectMode]);

  const handleBulkMute = useCallback(() => {
    const selected = Array.from(selectedIds)
      .map((p) => chatByPeer[p])
      .filter(Boolean) as (typeof chats)[string][];
    const anyUnmuted = selected.some((c) => !c.isMuted);
    if (anyUnmuted) {
      Alert.alert("Mute Notifications", "For how long?", [
        { text: "1 hour",  onPress: () => { selected.forEach((c) => { if (!c.isMuted) muteChat(c.id, true).catch(() => {}); }); exitSelectMode(); } },
        { text: "8 hours", onPress: () => { selected.forEach((c) => { if (!c.isMuted) muteChat(c.id, true).catch(() => {}); }); exitSelectMode(); } },
        { text: "1 week",  onPress: () => { selected.forEach((c) => { if (!c.isMuted) muteChat(c.id, true).catch(() => {}); }); exitSelectMode(); } },
        { text: "Always",  onPress: () => { selected.forEach((c) => { if (!c.isMuted) muteChat(c.id, true).catch(() => {}); }); exitSelectMode(); } },
        { text: "Cancel",  style: "cancel" },
      ]);
    } else {
      selected.forEach((c) => muteChat(c.id, false).catch(() => {}));
      exitSelectMode();
    }
  }, [selectedIds, chatByPeer, muteChat, exitSelectMode]);

  const BUILTIN_FILTERS = ["All", "Favorites", "Recent", "Unread", "Muted", "Archived"];

  type FilterItem =
    | { type: "builtin"; id: string; label: string }
    | { type: "custom"; id: string; label: string }
    | { type: "add" };

  const allFilterItems: FilterItem[] = [
    ...BUILTIN_FILTERS.map((f) => ({ type: "builtin" as const, id: f, label: f })),
    ...customFilters.map((f) => ({ type: "custom" as const, id: f.id, label: f.name })),
    { type: "add" as const },
  ];

  // ── Pinned: navigate to chat ───────────────────────────────────────────────

  const handlePinnedPress = useCallback(
    (contact: Contact) => {
      const peerId = contact.contactUserId || contact.id;
      const chat = chatByPeer[peerId];
      const payId = chat?.otherUserHandle || contact.handle || contact.phoneNumber || contact.email;
      navigation.navigate("ChatScreen", {
        id: peerId,
        name: contact.displayName,
        avatar: contact.profileImageUrl ?? "",
        online: isOnline(peerId),
        ...(payId ? { payIdentifier: payId } : {}),
      });
    },
    [navigation, isOnline, chatByPeer],
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  const renderFilter = ({ item }: { item: FilterItem }) => {
    if (item.type === "add") {
      return (
        <TouchableOpacity
          style={styles.filterPillAdd}
          onPress={() => { setNewFilterName(""); setShowCreateFilter(true); }}
          activeOpacity={0.8}
        >
          <Feather name="plus" size={16} color={Colors.primary} />
        </TouchableOpacity>
      );
    }

    const isActive = activeFilter === item.id;
    return (
      <TouchableOpacity
        style={[styles.filterPill, isActive && styles.filterPillActive]}
        onPress={() => setActiveFilter(item.id)}
        onLongPress={
          item.type === "custom"
            ? () => {
                Alert.alert(item.label, undefined, [
                  {
                    text: "Rename",
                    onPress: () => {
                      setNewFilterName(item.label);
                      setShowCreateFilter(item.id as any);
                    },
                  },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => {
                      if (activeFilter === item.id) setActiveFilter("All");
                      deleteFilter(item.id);
                    },
                  },
                  { text: "Cancel", style: "cancel" },
                ]);
              }
            : undefined
        }
        delayLongPress={400}
        activeOpacity={0.8}
      >
        <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderContact = ({ item }: { item: Contact }) => {
    const peerId = item.contactUserId || item.id;
    const chat = chatByPeer[peerId];
    const online = isOnline(peerId);
    const isSelected = selectedIds.has(peerId);
    const draftText = chat ? drafts[chat.id] : undefined;

    let subtitle: string;
    let subtitleIsDraft = false;
    if (draftText) {
      subtitle = draftText;
      subtitleIsDraft = true;
    } else if (chat?.lastMessagePreview) {
      subtitle = chat.lastMessageIsSelf
        ? `You: ${chat.lastMessagePreview}`
        : chat.lastMessagePreview;
    } else if (item.handle) {
      subtitle = `@${item.handle}`;
    } else {
      subtitle = "Tap to start a conversation";
    }

    const row = (
      <TouchableOpacity
        style={[styles.contactRow, isSelected && styles.contactRowSelected]}
        activeOpacity={0.7}
        onPress={() => {
          if (selectMode) {
            toggleSelect(peerId);
            return;
          }
          const payId = chat?.otherUserHandle || item.handle || item.phoneNumber || item.email;
          navigation.navigate("ChatScreen", {
            id: peerId,
            name: item.displayName,
            avatar: item.profileImageUrl ?? "",
            online,
            ...(payId ? { payIdentifier: payId } : {}),
          });
        }}
        onLongPress={(e) => {
          if (selectMode) return;
          const { pageY } = e.nativeEvent;
          const sw = Dimensions.get("window").width;
          setContextContact(item);
          setContextMenuAnchor({ top: pageY, right: Spacing.lg });
          if (!chat) {
            enterSelectMode();
            toggleSelect(peerId);
          }
        }}
        delayLongPress={350}
      >
        {selectMode ? (
          <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
            {isSelected && <Feather name="check" size={14} color="#fff" />}
          </View>
        ) : (
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
            {online && <View style={styles.onlineDot} />}
          </View>
        )}

        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{item.displayName}</Text>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {subtitleIsDraft && (
              <Text style={[styles.lastMessage, { color: "#EF4444", fontWeight: "600", marginRight: 3 }]}>
                Draft:
              </Text>
            )}
            <Text style={styles.lastMessage} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
        </View>

        {!selectMode && (
          <View style={styles.chatMeta}>
            <View style={styles.metaTop}>
              {chat?.lastMessageAt && (
                <Text style={styles.timestamp}>
                  {formatChatTimestamp(chat.lastMessageAt)}
                </Text>
              )}
            </View>
            <View style={styles.metaBottom}>
              {chat?.isMuted && !chat.unreadCount && (
                <Feather
                  name="bell-off"
                  size={13}
                  color={Colors.textSecondary}
                  style={{ marginRight: 2 }}
                />
              )}
              {chat?.lastMessageIsSelf && chat.lastMessageStatus && !chat.unreadCount ? (
                <StatusTicks
                  status={chat.lastMessageStatus}
                  color={Colors.textSecondary}
                />
              ) : null}
              {chat && chat.unreadCount > 0 ? (
                <View style={[styles.unreadBadge, chat.isMuted && styles.unreadBadgeMuted]}>
                  <Text style={styles.unreadBadgeText}>
                    {chat.unreadCount > 99 ? "99+" : String(chat.unreadCount)}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        )}
      </TouchableOpacity>
    );

    if (selectMode) return row;

    const handleDelete = chat
      ? () => {
          Alert.alert(
            "Delete Chat",
            `Delete your conversation with ${item.displayName}? This cannot be undone.`,
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: () => clearChatMessages(chat.id),
              },
            ],
          );
        }
      : undefined;

    const handlePin = () => {
      if (isPinned(peerId)) {
        unpin(peerId);
      } else {
        pin(peerId);
      }
    };

    return (
      <SwipeableRow
        onArchive={
          chat && !chat.isArchived
            ? () => archiveChat(chat.id, true).catch(() => {})
            : undefined
        }
        onDelete={handleDelete}
        onPin={handlePin}
      >
        {row}
      </SwipeableRow>
    );
  };

  const showPinned =
    !selectMode &&
    pinnedContacts.length > 0 &&
    (activeFilter === "All" || activeFilter === "Recent");

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* Header */}
      <View style={styles.header}>
        {selectMode ? (
          <>
            <TouchableOpacity onPress={exitSelectMode} style={styles.selectCancelBtn}>
              <Text style={styles.selectCancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.selectTitle}>
              {selectedIds.size > 0 ? `${selectedIds.size} selected` : "Select chats"}
            </Text>
            <TouchableOpacity
              onPress={() =>
                setSelectedIds(
                  new Set(filteredContacts.map((c) => c.contactUserId || c.id)),
                )
              }
              style={styles.selectAllBtn}
            >
              <Text style={styles.selectAllText}>All</Text>
            </TouchableOpacity>
          </>
        ) : !searchActive ? (
          <>
            <Text style={[Typography.h1, styles.headerTitle]}>Chats</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.iconButton}
                activeOpacity={0.8}
                onPress={toggleSearch}
              >
                <Feather name="search" size={20} color={Colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconButton}
                activeOpacity={0.8}
                onPress={() => navigation.navigate("BroadcastScreen", {})}
              >
                <Feather name="radio" size={20} color={Colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity
                ref={moreButtonRef}
                style={[styles.iconButton, showMoreMenu && styles.iconButtonActive]}
                activeOpacity={0.8}
                onPress={handleMorePress}
              >
                <Feather
                  name="more-horizontal"
                  size={20}
                  color={showMoreMenu ? Colors.primary : Colors.textPrimary}
                />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <Animated.View
            style={[
              styles.searchContainer,
              { opacity: searchAnim, transform: [{ scaleX: searchAnim }] },
            ]}
          >
            <View style={styles.searchInputWrapper}>
              <Feather
                name="search"
                size={18}
                color={Colors.textSecondary}
                style={{ marginRight: 8 }}
              />
              <TextInput
                underlineColorAndroid="transparent"
                style={styles.searchInput}
                placeholder="Search contacts..."
                placeholderTextColor={Colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchQuery("")}
                  activeOpacity={0.7}
                  style={{ padding: 4 }}
                >
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

      {/* Filter pills */}
      {!selectMode && (
        <View style={styles.filtersContainer}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={allFilterItems}
            renderItem={renderFilter}
            keyExtractor={(item) => (item.type === "add" ? "__add__" : item.id)}
            contentContainerStyle={styles.filtersListContent}
          />
        </View>
      )}

      {/* Pinned section */}
      {showPinned && (
        <PinnedSection
          contacts={pinnedContacts}
          chatByPeer={chatByPeer}
          isOnline={isOnline}
          onPress={handlePinnedPress}
          onLongPress={(peerId) => unpin(peerId)}
          styles={styles}
          Colors={Colors}
        />
      )}

      {/* Contact list */}
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
          ListHeaderComponent={
            !selectMode ? (
              <TouchableOpacity
                style={styles.savedMessagesRow}
                activeOpacity={0.7}
                onPress={() => navigation.navigate("SavedMessagesScreen")}
              >
                <View style={styles.savedMessagesAvatarWrap}>
                  <Feather name="bookmark" size={24} color={Colors.secondary} />
                </View>
                <View style={styles.savedMessagesInfo}>
                  <Text style={styles.savedMessagesName}>Saved Messages</Text>
                  <Text style={styles.savedMessagesSubtitle} numberOfLines={1}>
                    {(() => {
                      const last = (savedMessages ?? [])[savedMessages?.length ? savedMessages.length - 1 : 0];
                      return last ? (last.text || "Media message") : "Tap to save messages, links...";
                    })()}
                  </Text>
                </View>
              </TouchableOpacity>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="users" size={52} color={Colors.textSecondary} />
              <Text style={styles.emptyTitle}>
                {customFilters.find((f) => f.id === activeFilter)
                  ? "No contacts in this list"
                  : activeFilter === "Favorites"
                  ? "No favorites yet"
                  : activeFilter === "Archived"
                  ? "No archived chats"
                  : activeFilter === "Recent"
                  ? "No recent chats"
                  : activeFilter === "Unread"
                  ? "All caught up"
                  : activeFilter === "Muted"
                  ? "No muted chats"
                  : searchQuery.trim()
                  ? "No results found"
                  : "No contacts yet"}
              </Text>
              <Text style={styles.emptyText}>
                {customFilters.find((f) => f.id === activeFilter)
                  ? `Long-press a contact and choose "Add to list" to add them here.`
                  : activeFilter === "Favorites"
                  ? "Mark contacts as favorites to find them here."
                  : activeFilter === "Archived"
                  ? "Archived conversations will appear here."
                  : activeFilter === "Recent"
                  ? "Start a conversation to see it here."
                  : activeFilter === "Unread"
                  ? "No unread conversations right now."
                  : activeFilter === "Muted"
                  ? "Mute a chat to silence it and find it here."
                  : searchQuery.trim()
                  ? `No contacts match "${searchQuery}".`
                  : "Add contacts from the Contacts tab to start chatting."}
              </Text>
            </View>
          }
        />
      )}

      {/* Bulk action bar */}
      {selectMode && selectedIds.size > 0 && (
        <View style={styles.bulkBar}>
          <TouchableOpacity style={styles.bulkAction} onPress={handleBulkMarkRead}>
            <Feather name="check-circle" size={22} color={Colors.primary} />
            <Text style={styles.bulkActionLabel}>Read</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bulkAction} onPress={handleBulkMute}>
            <Feather name="bell-off" size={22} color={Colors.primary} />
            <Text style={styles.bulkActionLabel}>Mute</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bulkAction} onPress={handleBulkArchive}>
            <Feather name="archive" size={22} color={Colors.primary} />
            <Text style={styles.bulkActionLabel}>Archive</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* New chat FAB */}
      {!selectMode && (
        <TouchableOpacity
          style={styles.fab}
          activeOpacity={0.85}
          onPress={() => (navigation as any).getParent()?.navigate("Contacts")}
        >
          <Feather name="edit-2" size={22} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Header more-menu */}
      <ChatMoreModal
        visible={showMoreMenu}
        isDark={isDark}
        isMuted={false}
        contactName=""
        anchor={moreMenuAnchor}
        onClose={() => setShowMoreMenu(false)}
        actions={headerMoreActions}
      />

      {/* Long-press context menu */}
      <ChatMoreModal
        visible={!!contextContact && contextMenuActions.length > 0}
        isDark={isDark}
        isMuted={false}
        contactName=""
        anchor={contextMenuAnchor}
        onClose={() => setContextContact(null)}
        actions={contextMenuActions}
      />

      {/* Create / Rename filter modal */}
      <Modal
        visible={!!showCreateFilter}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreateFilter(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowCreateFilter(false)}
        >
          <Pressable style={[styles.modalSheet, { backgroundColor: isDark ? Colors.surface : Colors.white }]} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              {typeof showCreateFilter === "string" ? "Rename list" : "New list"}
            </Text>
            <TextInput
              underlineColorAndroid="transparent"
              style={[styles.modalInput, { color: Colors.textPrimary, borderColor: Colors.border }]}
              placeholder="List name (e.g. Work, Family)"
              placeholderTextColor={Colors.textSecondary}
              value={newFilterName}
              onChangeText={setNewFilterName}
              autoFocus
              maxLength={24}
              returnKeyType="done"
              onSubmitEditing={() => {
                if (!newFilterName.trim()) return;
                if (typeof showCreateFilter === "string") {
                  renameFilter(showCreateFilter, newFilterName.trim());
                } else {
                  createFilter(newFilterName.trim()).then((f) => setActiveFilter(f.id));
                }
                setShowCreateFilter(false);
              }}
            />
            <TouchableOpacity
              style={[
                styles.modalBtn,
                { backgroundColor: Colors.primary, opacity: newFilterName.trim() ? 1 : 0.4 },
              ]}
              activeOpacity={0.8}
              disabled={!newFilterName.trim()}
              onPress={() => {
                if (!newFilterName.trim()) return;
                if (typeof showCreateFilter === "string") {
                  renameFilter(showCreateFilter, newFilterName.trim());
                } else {
                  createFilter(newFilterName.trim()).then((f) => setActiveFilter(f.id));
                }
                setShowCreateFilter(false);
              }}
            >
              <Text style={styles.modalBtnText}>
                {typeof showCreateFilter === "string" ? "Rename" : "Create"}
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },

    // ── Header ──
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      marginBottom: Spacing.md,
      minHeight: 52,
    },
    headerTitle: { color: Colors.textPrimary, fontWeight: "700", fontSize: 28 },
    headerActions: { flexDirection: "row", gap: Spacing.sm },
    iconButton: {
      width: 44,
      height: 44,
      borderRadius: Radius.full,
      backgroundColor: isDark ? Colors.surface : "#F3F4F6",
      alignItems: "center",
      justifyContent: "center",
    },
    iconButtonActive: {
      backgroundColor: isDark ? Colors.primary + "22" : Colors.primary + "15",
      borderColor: Colors.primary,
      borderWidth: 1,
    },

    // ── Select mode header ──
    selectCancelBtn: { paddingVertical: Spacing.xs, paddingRight: Spacing.sm },
    selectCancelText: { ...Typography.body, color: Colors.primary, fontWeight: "500" },
    selectTitle: { ...Typography.bodyLg, color: Colors.textPrimary, fontWeight: "700" },
    selectAllBtn: { paddingVertical: Spacing.xs, paddingLeft: Spacing.sm },
    selectAllText: { ...Typography.body, color: Colors.primary, fontWeight: "500" },

    // ── Search ──
    searchContainer: { flex: 1, flexDirection: "row", alignItems: "center", height: 44 },
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
    cancelSearchBtn: { marginLeft: Spacing.sm, paddingHorizontal: Spacing.xs },
    cancelSearchText: { ...Typography.body, color: Colors.primary, fontWeight: "500" },

    // ── Filter pills ──
    filtersContainer: { marginBottom: Spacing.md },
    filtersListContent: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
    filterPill: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.full,
      backgroundColor: isDark ? Colors.surface : "#F3F4F6",
      justifyContent: "center",
      alignItems: "center",
    },
    filterPillActive: { backgroundColor: Colors.primary },
    filterPillAdd: {
      width: 36,
      height: 34,
      borderRadius: Radius.full,
      backgroundColor: isDark ? Colors.surface : "#F3F4F6",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
      borderStyle: "dashed" as const,
      borderColor: Colors.primary,
    },
    filterText: { ...Typography.body, fontWeight: "500", color: Colors.textSecondary },
    filterTextActive: { color: Colors.secondary },

    // ── Pinned section ──
    pinnedList: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.md,
      gap: Spacing.lg,
    },
    pinnedItem: { alignItems: "center", width: 60 },
    pinnedAvatarWrap: { position: "relative", marginBottom: 5 },
    pinnedAvatar: { width: 54, height: 54, borderRadius: 27 },
    pinnedAvatarPlaceholder: {
      backgroundColor: Colors.primary + "33",
      alignItems: "center",
      justifyContent: "center",
    },
    pinnedAvatarInitial: { fontSize: 20, fontWeight: "700", color: Colors.primary },
    pinnedOnlineDot: {
      position: "absolute",
      bottom: 1,
      right: 1,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: "#22C55E",
      borderWidth: 2,
      borderColor: Colors.background,
    },
    pinnedBadge: {
      position: "absolute",
      top: -2,
      right: -2,
      minWidth: 18,
      height: 18,
      paddingHorizontal: 4,
      borderRadius: 9,
      backgroundColor: Colors.primary,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
      borderColor: Colors.background,
    },
    pinnedBadgeText: { color: Colors.secondary, fontSize: 10, fontWeight: "700" },
    pinnedName: {
      fontSize: 11,
      color: Colors.textPrimary,
      fontWeight: "500",
      textAlign: "center",
    },
    pinnedDivider: {
      height: 1,
      backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#F3F4F6",
      marginHorizontal: Spacing.lg,
      marginBottom: Spacing.sm,
    },

    // ── Contact list ──
    contactsListContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl * 2 },
    contactsListEmpty: { flex: 1 },
    loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },

    // ── Contact row ──
    contactRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: Spacing.sm,
      marginBottom: Spacing.xs,
      borderRadius: Radius.md,
    },
    contactRowSelected: {
      backgroundColor: isDark ? Colors.primary + "18" : Colors.primary + "10",
    },
    checkbox: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 2,
      borderColor: Colors.textSecondary,
      marginRight: Spacing.md,
      alignItems: "center",
      justifyContent: "center",
    },
    checkboxSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    avatarContainer: { position: "relative", marginRight: Spacing.md },
    avatar: { width: 50, height: 50, borderRadius: Radius.full },
    avatarPlaceholder: {
      backgroundColor: Colors.primary + "33",
      alignItems: "center",
      justifyContent: "center",
    },
    avatarInitial: { fontSize: 20, fontWeight: "700", color: Colors.primary },
    onlineDot: {
      position: "absolute",
      bottom: 1,
      right: 1,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: "#22C55E",
      borderWidth: 2,
      borderColor: Colors.background,
    },
    contactInfo: { flex: 1, justifyContent: "center" },
    contactName: { fontWeight: "700", color: Colors.textPrimary, marginBottom: 2, fontSize: 16 },
    lastMessage: { ...Typography.body, color: Colors.textSecondary },

    // ── Chat meta ──
    chatMeta: {
      alignItems: "flex-end",
      justifyContent: "space-between",
      minWidth: 52,
      paddingVertical: 2,
      alignSelf: "stretch",
    },
    metaTop: { alignItems: "flex-end" },
    metaBottom: { flexDirection: "row", alignItems: "center", gap: 3 },
    timestamp: { fontSize: 11, color: Colors.textSecondary, fontWeight: "500" },
    unreadBadge: {
      minWidth: 22,
      height: 22,
      paddingHorizontal: 6,
      borderRadius: 11,
      backgroundColor: Colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    unreadBadgeMuted: { backgroundColor: Colors.textSecondary },
    unreadBadgeText: { color: Colors.secondary, fontSize: 11, fontWeight: "700" },

    // ── Empty state ──
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

    // ── Bulk bar ──
    bulkBar: {
      flexDirection: "row",
      justifyContent: "space-around",
      alignItems: "center",
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      borderTopWidth: 1,
      borderTopColor: isDark ? "rgba(255,255,255,0.06)" : "#E5E7EB",
      backgroundColor: Colors.background,
    },
    bulkAction: { alignItems: "center", gap: 4, flex: 1 },
    bulkActionLabel: { fontSize: 11, color: Colors.primary, fontWeight: "600" },

    // ── Create filter modal ──
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "flex-end",
    },
    modalSheet: {
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: Spacing.lg,
      paddingBottom: 40,
    },
    modalHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: Colors.border,
      alignSelf: "center",
      marginBottom: Spacing.lg,
    },
    modalTitle: {
      ...Typography.h3,
      fontWeight: "700",
      color: Colors.textPrimary,
      marginBottom: Spacing.md,
    },
    modalInput: {
      borderWidth: 1,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: 12,
      fontSize: 16,
      marginBottom: Spacing.lg,
      backgroundColor: isDark ? Colors.background : "#F9FAFB",
    },
    modalBtn: {
      borderRadius: Radius.md,
      paddingVertical: 14,
      alignItems: "center",
    },
    modalBtnText: {
      color: "#fff",
      fontWeight: "700",
      fontSize: 15,
    },

    // ── Saved Messages row ──
    savedMessagesRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: Spacing.sm,
      marginBottom: Spacing.sm,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6",
    },
    savedMessagesAvatarWrap: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: Colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginRight: Spacing.md,
    },
    savedMessagesInfo: { flex: 1 },
    savedMessagesName: { fontWeight: "700", color: Colors.textPrimary, fontSize: 16, marginBottom: 2 },
    savedMessagesSubtitle: { ...Typography.body, color: Colors.textSecondary },

    // ── FAB ──
    fab: {
      position: "absolute",
      bottom: Spacing.xl + 4,
      right: Spacing.lg,
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: Colors.primary,
      alignItems: "center",
      justifyContent: "center",
      elevation: 6,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
    },
  });
}
