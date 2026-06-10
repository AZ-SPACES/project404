import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StatusBar,
  Image,
  DeviceEventEmitter,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@react-native-vector-icons/feather';
import { useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';
import { useContactStore } from '../../../store/contactStore';
import { Contact } from '../../../features/contacts/types';
import type { RootStackParamList } from '../../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'BroadcastScreen'>;

export default function BroadcastScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<Props['route']>();

  const preselected = route.params?.preselected ?? [];

  const { contacts } = useContactStore();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(preselected));
  const [searchQuery, setSearchQuery] = useState('');
  const [messageText, setMessageText] = useState('');

  const filteredContacts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.displayName.toLowerCase().includes(q) ||
        (c.handle && c.handle.toLowerCase().includes(q)),
    );
  }, [contacts, searchQuery]);

  const toggleContact = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const canSend = selectedIds.size > 0 && messageText.trim().length > 0;

  const handleSend = useCallback(() => {
    if (!canSend) return;
    const count = selectedIds.size;
    Alert.alert(
      'Send Broadcast',
      `Send this message to ${count} contact${count === 1 ? '' : 's'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: () => {
            DeviceEventEmitter.emit('broadcast_send', {
              contactIds: Array.from(selectedIds),
              text: messageText.trim(),
            });
            navigation.goBack();
          },
        },
      ],
    );
  }, [canSend, selectedIds, messageText, navigation]);

  const renderContact = useCallback(
    ({ item }: { item: Contact }) => {
      const peerId = item.contactUserId ?? item.id;
      const isSelected = selectedIds.has(peerId);
      return (
        <TouchableOpacity
          style={[styles.contactRow, isSelected && styles.contactRowSelected]}
          onPress={() => toggleContact(peerId)}
          activeOpacity={0.7}
        >
          <View style={styles.avatarWrap}>
            {item.profileImageUrl ? (
              <Image source={{ uri: item.profileImageUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitial}>
                  {item.displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            {isSelected && (
              <View style={styles.checkOverlay}>
                <Feather name="check" size={14} color="#fff" />
              </View>
            )}
          </View>
          <View style={styles.contactInfo}>
            <Text style={styles.contactName}>{item.displayName}</Text>
            {item.handle ? (
              <Text style={styles.contactHandle}>@{item.handle}</Text>
            ) : null}
          </View>
          <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
            {isSelected && <Feather name="check" size={14} color="#fff" />}
          </View>
        </TouchableOpacity>
      );
    },
    [selectedIds, toggleContact, styles],
  );

  const keyExtractor = useCallback((item: Contact) => item.id, []);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={Colors.background}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="arrow-left" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>New Broadcast</Text>
          {selectedIds.size > 0 && (
            <View style={styles.selectedBadge}>
              <Text style={styles.selectedBadgeText}>{selectedIds.size} selected</Text>
            </View>
          )}
        </View>
      </View>

      {/* Search bar */}
      <View style={[styles.searchBar, { backgroundColor: isDark ? Colors.surface : '#F3F4F6' }]}>
        <Feather name="search" size={16} color={Colors.textSecondary} style={{ marginRight: 8 }} />
        <TextInput
          style={[styles.searchInput, { color: Colors.textPrimary }]}
          placeholder="Search contacts..."
          placeholderTextColor={Colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          underlineColorAndroid="transparent"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
            <Feather name="x-circle" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Contact list */}
        <FlatList
          data={filteredContacts}
          keyExtractor={keyExtractor}
          renderItem={renderContact}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="users" size={40} color={Colors.textSecondary} />
              <Text style={styles.emptyText}>No contacts found</Text>
            </View>
          }
        />

        {/* Compose bar */}
        <View style={[styles.composeBar, { borderTopColor: Colors.border, backgroundColor: Colors.background }]}>
          <TextInput
            style={[
              styles.composeInput,
              { color: Colors.textPrimary, backgroundColor: isDark ? Colors.surface : '#F3F4F6' },
            ]}
            placeholder="Type a message..."
            placeholderTextColor={Colors.textSecondary}
            value={messageText}
            onChangeText={setMessageText}
            multiline
            maxLength={4000}
            underlineColorAndroid="transparent"
          />
          <TouchableOpacity
            style={[styles.sendButton, { backgroundColor: canSend ? Colors.primary : Colors.border }]}
            onPress={handleSend}
            disabled={!canSend}
            activeOpacity={0.8}
          >
            <Feather
              name="send"
              size={18}
              color={canSend ? Colors.secondary : Colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
    flex: { flex: 1 },
    container: { flex: 1, backgroundColor: Colors.background },

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : Colors.border,
      minHeight: 60,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: Spacing.sm,
    },
    headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    headerTitle: {
      ...Typography.bodyLg,
      fontWeight: '700',
      color: Colors.textPrimary,
      fontSize: 17,
    },
    selectedBadge: {
      backgroundColor: Colors.primary,
      borderRadius: Radius.full,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    selectedBadgeText: {
      color: Colors.secondary,
      fontSize: 12,
      fontWeight: '700',
    },

    // Search
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: Spacing.lg,
      marginVertical: Spacing.sm,
      borderRadius: Radius.full,
      paddingHorizontal: Spacing.md,
      paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    },
    searchInput: {
      flex: 1,
      ...Typography.body,
      fontSize: 15,
      paddingVertical: 0,
    },

    // Contact list
    listContent: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.xl,
    },
    contactRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: Spacing.sm,
      marginBottom: Spacing.xs,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.xs,
    },
    contactRowSelected: {
      backgroundColor: isDark ? Colors.primary + '18' : Colors.primary + '10',
    },
    avatarWrap: { position: 'relative', marginRight: Spacing.md },
    avatar: { width: 48, height: 48, borderRadius: 24 },
    avatarFallback: {
      backgroundColor: Colors.primary + '33',
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitial: { fontSize: 18, fontWeight: '700', color: Colors.primary },
    checkOverlay: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: Colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: Colors.background,
    },
    contactInfo: { flex: 1 },
    contactName: { fontWeight: '600', color: Colors.textPrimary, fontSize: 15 },
    contactHandle: { ...Typography.caption, color: Colors.textSecondary, marginTop: 1 },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: Colors.textSecondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },

    // Empty
    emptyContainer: { alignItems: 'center', paddingTop: Spacing.xl * 2, gap: Spacing.md },
    emptyText: { ...Typography.body, color: Colors.textSecondary },

    // Compose bar
    composeBar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderTopWidth: 1,
      gap: Spacing.sm,
    },
    composeInput: {
      flex: 1,
      borderRadius: Radius.lg,
      paddingHorizontal: Spacing.md,
      paddingVertical: Platform.OS === 'ios' ? 10 : 8,
      maxHeight: 120,
      ...Typography.body,
      fontSize: 15,
    },
    sendButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
