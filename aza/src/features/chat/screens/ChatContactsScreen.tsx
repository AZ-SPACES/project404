import React, { useState } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";
import { Contact, CONTACTS } from "../../../components/chat/chatTypes";
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

  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

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
    let result = CONTACTS;
    if (activeFilter === "Favorites") {
      result = result.filter(c => c.isFavorite);
    } else if (activeFilter === "Archived") {
      result = result.filter(c => c.isArchived);
    } else {
      // "All" or "Recent" - hide archived by default
      result = result.filter(c => !c.isArchived);
    }

    if (searchQuery.trim()) {
      result = result.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return result;
  }, [activeFilter, searchQuery]);

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
    return (
      <TouchableOpacity
        style={styles.contactRow}
        activeOpacity={0.7}
        onPress={() =>
          navigation.navigate("ChatScreen", {
            id: item.id,
            name: item.name,
            avatar: item.avatar,
            online: item.online,
          })
        }
      >
        <View style={styles.avatarContainer}>
          <Image source={{ uri: item.avatar }} style={styles.avatar} />
          {item.online && <View style={styles.onlineIndicator} />}
        </View>
        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{item.name}</Text>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.lastMessage}
          </Text>
        </View>
        <View style={styles.contactMeta}>
          {item.unread > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unread}</Text>
            </View>
          ) : (
            <Text style={styles.timeText}>{item.time}</Text>
          )}
        </View>
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

      <FlatList
        data={filteredContacts}
        renderItem={renderContact}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contactsListContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No contacts found</Text>
          </View>
        }
      />
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
    onlineIndicator: {
      position: "absolute",
      bottom: 0,
      right: 0,
      width: 14,
      height: 14,
      borderRadius: Radius.full,
      backgroundColor: Colors.primary, // Using primary color for consistency
      borderWidth: 2,
      borderColor: Colors.background,
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
    contactMeta: {
      alignItems: "flex-end",
      justifyContent: "center",
      marginLeft: Spacing.sm,
    },
    timeText: {
      ...Typography.body,
      color: Colors.textSecondary,
    },
    unreadBadge: {
      backgroundColor: Colors.primary,
      borderRadius: 12,
      minWidth: 24,
      height: 24,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 6,
    },
    unreadText: {
      ...Typography.caption,
      color: Colors.white,
      fontWeight: "600",
    },
    emptyContainer: {
      padding: Spacing.xl * 2,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyText: {
      ...Typography.body,
      color: Colors.textSecondary,
    },
  });
}
