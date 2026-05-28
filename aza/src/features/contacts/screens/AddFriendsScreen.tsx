import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { Feather } from '@react-native-vector-icons/feather';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme, Typography, Spacing, Radius, ThemeColors } from '../../../theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { useContactStore } from '../../../store/contactStore';
import { PublicProfile } from '../types';
import { BackButton } from '../../../components/ui/BackButton';

type AddFriendsScreenProps = NativeStackScreenProps<RootStackParamList, 'AddFriends'>;

export default function AddFriendsScreen({ navigation }: AddFriendsScreenProps) {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const isDark = Colors.isDark;

  const { searchGlobal, requestContact } = useContactStore();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PublicProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [sendingId, setSendingId] = useState<string | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (!query.trim() || query.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    debounceTimer.current = setTimeout(async () => {
      const found = await searchGlobal(query.trim());
      setResults(found);
      setIsSearching(false);
    }, 400);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query]);

  const handleAdd = useCallback(
    async (profile: PublicProfile) => {
      if (sentIds.has(profile.id) || sendingId === profile.id) return;
      setSendingId(profile.id);
      try {
        await requestContact(profile.id);
        setSentIds(prev => new Set([...prev, profile.id]));
        setTimeout(() => navigation.navigate('RequestPending'), 700);
      } catch {
        // error handled by store
      } finally {
        setSendingId(null);
      }
    },
    [sentIds, sendingId, requestContact, navigation],
  );

  const renderResult = useCallback(
    ({ item }: { item: PublicProfile }) => {
      const sent = sentIds.has(item.id);
      const sending = sendingId === item.id;
      const avatarUri =
        item.profileImageUrl ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(item.displayName)}&background=random`;

      return (
        <View style={styles.resultRow}>
          <Image source={{ uri: avatarUri }} style={styles.resultAvatar} />
          <View style={styles.resultInfo}>
            <Text style={styles.resultName} numberOfLines={1}>
              {item.displayName}
            </Text>
            <Text style={styles.resultHandle} numberOfLines={1}>
              @{item.handle}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.addBtn, sent && styles.addBtnSent]}
            activeOpacity={0.7}
            onPress={() => handleAdd(item)}
            disabled={sent || sending}
            accessibilityLabel={sent ? 'Request sent' : `Add ${item.displayName}`}
          >
            {sending ? (
              <ActivityIndicator size="small" color={Colors.secondary} />
            ) : sent ? (
              <>
                <Feather name="check" size={14} color={Colors.textSecondary} />
                <Text style={styles.addBtnSentText}>Sent</Text>
              </>
            ) : (
              <>
                <Feather name="user-plus" size={14} color={Colors.secondary} />
                <Text style={styles.addBtnText}>Add</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      );
    },
    [sentIds, sendingId, Colors, styles, handleAdd],
  );

  const showEmpty = !isSearching && query.length >= 2 && results.length === 0;
  const showInitial = query.length < 2;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
      />

      {/* Header */}
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Add Friends</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Feather
            name="search"
            size={18}
            color={query ? Colors.primary : Colors.textSecondary}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by @username"
            placeholderTextColor={Colors.textSecondary}
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search for friends"
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => setQuery('')}
              accessibilityLabel="Clear search"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="x-circle" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content */}
      {isSearching ? (
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.stateText}>Searching...</Text>
        </View>
      ) : showInitial ? (
        <View style={styles.centeredState}>
          <View style={styles.emptyIconWrapper}>
            <Feather name="users" size={40} color={Colors.primary} style={{ opacity: 0.3 }} />
          </View>
          <Text style={styles.emptyTitle}>Find People on Aza</Text>
          <Text style={styles.emptySubtitle}>
            Search by username to send a friend request
          </Text>
        </View>
      ) : showEmpty ? (
        <View style={styles.centeredState}>
          <View style={styles.emptyIconWrapper}>
            <Feather name="search" size={40} color={Colors.textSecondary} style={{ opacity: 0.3 }} />
          </View>
          <Text style={styles.emptyTitle}>No results for "{query}"</Text>
          <Text style={styles.emptySubtitle}>Try a different username</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={item => item.id}
          renderItem={renderResult}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </SafeAreaView>
  );
}

const AVATAR_SIZE = 52;

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 50,
      backgroundColor: isDark ? Colors.surface : 'rgba(22,51,0,0.07)',
      borderWidth: 1,
      borderColor: Colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      ...Typography.h3,
      color: Colors.textPrimary,
    },
    headerSpacer: {
      width: 44,
    },
    searchContainer: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.md,
    },
    searchInputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? Colors.surface : Colors.white,
      borderWidth: 1.5,
      borderColor: Colors.border,
      borderRadius: Radius.full,
      paddingHorizontal: Spacing.md,
      paddingVertical: 14,
    },
    searchIcon: {
      marginRight: Spacing.sm,
    },
    searchInput: {
      flex: 1,
      ...Typography.bodyLg,
      color: Colors.textPrimary,
      padding: 0,
    },
    centeredState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.xl,
      paddingBottom: 80,
    },
    emptyIconWrapper: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: isDark ? Colors.surface : Colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.lg,
    },
    emptyTitle: {
      ...Typography.h3,
      color: Colors.textPrimary,
      textAlign: 'center',
      marginBottom: Spacing.sm,
    },
    emptySubtitle: {
      ...Typography.body,
      color: Colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    stateText: {
      ...Typography.body,
      color: Colors.textSecondary,
      marginTop: Spacing.md,
    },
    listContent: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.xs,
    },
    resultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: Spacing.sm + 2,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? Colors.border : Colors.surface,
    },
    resultAvatar: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: AVATAR_SIZE / 2,
      backgroundColor: Colors.surface,
      marginRight: Spacing.md,
    },
    resultInfo: {
      flex: 1,
    },
    resultName: {
      ...Typography.bodyLg,
      fontWeight: '600',
      color: Colors.textPrimary,
    },
    resultHandle: {
      ...Typography.caption,
      color: Colors.primary,
      fontWeight: '500',
      marginTop: 2,
    },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: Colors.primary,
      paddingVertical: 9,
      paddingHorizontal: 16,
      borderRadius: Radius.full,
      minWidth: 80,
      justifyContent: 'center',
    },
    addBtnSent: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: Colors.border,
    },
    addBtnText: {
      ...Typography.caption,
      fontWeight: '600',
      color: Colors.secondary,
    },
    addBtnSentText: {
      ...Typography.caption,
      fontWeight: '600',
      color: Colors.textSecondary,
    },
  });
}
