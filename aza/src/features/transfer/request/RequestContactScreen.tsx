import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  FlatList,
  TextInput,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme, Typography, Spacing, ThemeColors } from '../../../theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { useFocusEffect } from '@react-navigation/native';
import { useContactStore } from '../../../store/contactStore';
import { Contact } from '../../contacts/types';

type ReceiveScreenProps = NativeStackScreenProps<RootStackParamList, 'Receive'>;

type ListContact = {
  id: string;
  name: string;
  username: string;
  avatar: string;
  /** Value sent as fromIdentifier to the backend money-request endpoint */
  identifier: string;
};

function toListContact(c: Contact): ListContact | null {
  // Show any accepted contact that has a usable identifier
  const identifier = c.handle || c.phoneNumber || c.email || '';
  if (!identifier) return null;
  return {
    id: c.id,
    name: c.displayName,
    username: c.handle ? `@${c.handle}` : (c.phoneNumber ?? c.email ?? ''),
    avatar: c.profileImageUrl ?? '',
    identifier,
  };
}

type ContactItemProps = { contact: ListContact; onPress: (contact: ListContact) => void };

function ContactRow({ contact, onPress }: ContactItemProps) {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  return (
    <TouchableOpacity
      style={styles.contactRow}
      activeOpacity={0.7}
      onPress={() => onPress(contact)}
      accessibilityLabel={contact.name}
    >
      {contact.avatar ? (
        <Image source={{ uri: contact.avatar }} style={styles.contactAvatar} accessibilityLabel={contact.name} />
      ) : (
        <View style={[styles.contactAvatar, styles.avatarFallback]}>
          <Text style={[styles.avatarInitial, { color: Colors.textPrimary }]}>
            {contact.name.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{contact.name}</Text>
        <Text style={styles.contactUsername}>{contact.username}</Text>
      </View>
      <Feather name="chevron-right" size={20} color={Colors.textSecondary} />
    </TouchableOpacity>
  );
}

export default function RequestContactScreen({ navigation }: ReceiveScreenProps) {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const isDark = Colors.isDark;

  const { contacts, isLoading, error, fetchContacts } = useContactStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Re-fetch every time this screen gains focus (matches ContactsScreen behaviour)
  useFocusEffect(
    useCallback(() => {
      fetchContacts(0, 200);
    }, [fetchContacts]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchContacts(0, 200);
    setRefreshing(false);
  }, [fetchContacts]);

  const listContacts = React.useMemo<ListContact[]>(
    () => contacts.flatMap(c => { const l = toListContact(c); return l ? [l] : []; }),
    [contacts],
  );

  const filteredContacts = searchQuery
    ? listContacts.filter(
        c =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.username.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : listContacts;

  const handleContactPress = useCallback(
    (contact: ListContact) => {
      navigation.navigate('RequestAmount', {
        name: contact.name,
        username: contact.username,
        avatar: contact.avatar,
        identifier: contact.identifier,
      });
    },
    [navigation],
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Go back"
        >
          <Feather name="chevron-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>Who are you requesting from?</Text>

      {/* Search */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchInputContainer}>
          <Feather name="search" size={16} color={Colors.textSecondary} style={styles.searchInputIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search contacts..."
            placeholderTextColor={Colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            accessibilityLabel="Search contacts"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} accessibilityLabel="Clear search">
              <Feather name="x" size={16} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Text style={styles.sectionLabel}>Contacts</Text>

      {/* Content */}
      {isLoading && listContacts.length === 0 ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.stateText}>Loading contacts…</Text>
        </View>
      ) : error && listContacts.length === 0 ? (
        <View style={styles.centerState}>
          <Feather name="wifi-off" size={32} color={Colors.textSecondary} style={{ marginBottom: 8 }} />
          <Text style={styles.stateText}>Failed to load contacts</Text>
          <TouchableOpacity onPress={() => fetchContacts(0, 200)} style={styles.retryButton}>
            <Text style={[styles.sectionLabel, { color: Colors.primary, marginBottom: 0 }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filteredContacts.length === 0 ? (
        <View style={styles.centerState}>
          <Feather name="users" size={32} color={Colors.textSecondary} style={{ marginBottom: 8 }} />
          <Text style={styles.stateText}>
            {searchQuery ? 'No contacts match your search.' : 'No accepted contacts yet.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredContacts}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => <ContactRow contact={item} onPress={handleContactPress} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const CONTACT_ROW_AVATAR = 44;

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
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: isDark ? Colors.surface : 'rgba(22,51,0,0.07)',
      borderWidth: 1,
      borderColor: Colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      ...Typography.h2,
      color: Colors.textPrimary,
      paddingHorizontal: Spacing.lg,
      marginTop: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    searchWrapper: {
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.md,
    },
    searchInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.sm,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: 10,
      backgroundColor: isDark ? Colors.surface : Colors.white,
    },
    searchInputIcon: {
      marginRight: Spacing.sm,
    },
    searchInput: {
      flex: 1,
      ...Typography.body,
      color: Colors.textPrimary,
      padding: 0,
    },
    sectionLabel: {
      ...Typography.body,
      fontWeight: '600',
      color: Colors.textPrimary,
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.sm,
    },
    contactRow: {
      paddingHorizontal: Spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: Spacing.sm + 2,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? Colors.border : Colors.surface,
    },
    contactAvatar: {
      width: CONTACT_ROW_AVATAR,
      height: CONTACT_ROW_AVATAR,
      borderRadius: CONTACT_ROW_AVATAR / 2,
      backgroundColor: Colors.surface,
      marginRight: Spacing.md,
    },
    avatarFallback: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors.border,
    },
    avatarInitial: {
      fontSize: 18,
      fontWeight: '600',
    },
    contactInfo: {
      flex: 1,
    },
    contactName: {
      ...Typography.body,
      fontWeight: '500',
      color: Colors.textPrimary,
    },
    contactUsername: {
      ...Typography.caption,
      color: Colors.textSecondary,
      marginTop: 2,
    },
    centerState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.xl,
    },
    stateText: {
      ...Typography.body,
      color: Colors.textSecondary,
      textAlign: 'center',
      marginTop: 4,
    },
    retryButton: {
      marginTop: Spacing.md,
      paddingVertical: Spacing.sm,
    },
  });
}
