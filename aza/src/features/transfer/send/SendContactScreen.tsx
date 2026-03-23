import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  FlatList,
  ScrollView,
  TextInput,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius } from '../../../theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';

type SendScreenProps = NativeStackScreenProps<RootStackParamList, 'Send'>;

type Contact = {
  id: string;
  name: string;
  username: string;
  avatar: string;
};

const RECENT_CONTACTS: Contact[] = [
  {
    id: '1',
    name: 'Ruth Akosua',
    username: '@rakosua',
    avatar: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&h=200&fit=crop&crop=face',
  },
  {
    id: '2',
    name: 'Keren Dussey',
    username: '@kdussey',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face',
  },
  {
    id: '3',
    name: 'Reuel Agyapong',
    username: '@ragyapong',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face',
  },
];

const ALL_CONTACTS: Contact[] = [
  {
    id: '4',
    name: 'Paapa Cobbold',
    username: '@pcobbold',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=face',
  },
  {
    id: '5',
    name: 'Davies Opoku',
    username: '@dopoku',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face',
  },
  {
    id: '6',
    name: 'Ibrahim Mahama',
    username: '@ibmahama',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop&crop=face',
  },
  {
    id: '7',
    name: 'Charlotte Osei',
    username: '@cosei',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=face',
  },
  {
    id: '8',
    name: 'Kevin Okyere',
    username: '@kokyere',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&h=200&fit=crop&crop=face',
  },
  {
    id: '9',
    name: 'Shirley Ayorkor Botchwey',
    username: '@sabotchwey',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop&crop=face',
  },
  {
    id: '10',
    name: 'Richard Nii Armah Quaye',
    username: '@rnaquaye',
    avatar: 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=200&h=200&fit=crop&crop=face',
  },
];

type RecentContactItemProps = {
  contact: Contact;
  onPress: (contact: Contact) => void;
};

const RecentContactItem = ({ contact, onPress }: RecentContactItemProps) => (
  <TouchableOpacity
    style={styles.recentItem}
    activeOpacity={0.7}
    onPress={() => onPress(contact)}
  >
    <Image source={{ uri: contact.avatar }} style={styles.recentAvatar} />
    <Text style={styles.recentName} numberOfLines={1}>
      {contact.name}
    </Text>
    <Text style={styles.recentUsername} numberOfLines={1}>
      {contact.username}
    </Text>
  </TouchableOpacity>
);

type ContactRowProps = {
  contact: Contact;
  onPress: (contact: Contact) => void;
};

const ContactRow = ({ contact, onPress }: ContactRowProps) => (
  <TouchableOpacity
    style={styles.contactRow}
    activeOpacity={0.7}
    onPress={() => onPress(contact)}
  >
    <Image source={{ uri: contact.avatar }} style={styles.contactAvatar} />
    <View style={styles.contactInfo}>
      <Text style={styles.contactName}>{contact.name}</Text>
      <Text style={styles.contactUsername}>{contact.username}</Text>
    </View>
    <Feather name="chevron-right" size={20} color={Colors.textSecondary} />
  </TouchableOpacity>
);

export default function SendScreen({ navigation }: SendScreenProps) {
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleContactPress = (contact: Contact) => {
    navigation.navigate('SendAmount', {
      name: contact.name,
      username: contact.username,
      avatar: contact.avatar,
    });
  };

  const filteredContacts = searchQuery
    ? ALL_CONTACTS.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.username.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : ALL_CONTACTS;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="chevron-left" size={24} color={Colors.textPrimary} style={styles.backicon} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.addButton} activeOpacity={0.7}>
          <Feather name="plus" size={16} color={Colors.white} />
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <Text style={styles.title}>Who are you sending to?</Text>

        {/* Recents Section */}
        <Text style={styles.sectionLabel}>Recents</Text>
        <FlatList
          data={RECENT_CONTACTS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.recentsContainer}
          renderItem={({ item }) => (
            <RecentContactItem contact={item} onPress={handleContactPress} />
          )}
        />

        {/* All Section Header */}
        <View style={styles.allHeader}>
          <Text style={styles.sectionLabel}>All</Text>
          <TouchableOpacity
            style={styles.searchButton}
            activeOpacity={0.7}
            onPress={() => setSearchVisible(!searchVisible)}
          >
            <Feather name="search" size={16} color={Colors.textPrimary} />
            <Text style={styles.searchButtonText}>Search</Text>
          </TouchableOpacity>
        </View>

        {/* Search Input */}
        {searchVisible && (
          <View style={styles.searchInputContainer}>
            <Feather
              name="search"
              size={16}
              color={Colors.textSecondary}
              style={styles.searchInputIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search contacts..."
              placeholderTextColor={Colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Feather name="x" size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Contact List */}
        <View style={styles.contactList}>
          {filteredContacts.map((contact) => (
            <ContactRow
              key={contact.id}
              contact={contact}
              onPress={handleContactPress}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const AVATAR_SIZE = 64;
const CONTACT_ROW_AVATAR = 44;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 50,
    backgroundColor: "rgba(22,51,0,0.07)",
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backicon: {
    fontSize: 28,
    color: Colors.textPrimary,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 40,
  },
  addButtonText: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.white,
  },
  scrollView: {
    flex: 1,
  },
  title: {
    ...Typography.h2,
    color: Colors.textPrimary,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
    alignSelf: 'center',
  },
  sectionLabel: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.textPrimary,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  recentsContainer: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  recentItem: {
    alignItems: 'center',
    width: 80,
  },
  recentAvatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: Colors.surface,
    marginBottom: Spacing.xs,
  },
  recentName: {
    ...Typography.caption,
    fontWeight: '500',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  recentUsername: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  allHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: Spacing.lg,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 40,
    backgroundColor: Colors.background,
    borderColor: Colors.border,
  },
  searchButtonText: {
    ...Typography.body,
    color: Colors.textPrimary,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: 30,
    backgroundColor: Colors.surface,
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
  contactList: {
    paddingHorizontal: Spacing.lg,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surface,
  },
  contactAvatar: {
    width: CONTACT_ROW_AVATAR,
    height: CONTACT_ROW_AVATAR,
    borderRadius: CONTACT_ROW_AVATAR / 2,
    backgroundColor: Colors.surface,
    marginRight: Spacing.md,
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
});
