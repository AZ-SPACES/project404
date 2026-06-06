import React, { memo, useState, useCallback, useMemo, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, FlatList, TouchableOpacity,
  Image, StyleSheet, ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@react-native-vector-icons/feather';
import { useAppTheme, Typography, Spacing, Radius } from '../../theme';
import { useContactStore } from '../../store/contactStore';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (name: string, avatar: string, handle: string) => void;
};

export const ContactPickerSheet = memo(function ContactPickerSheet({ visible, onClose, onSelect }: Props) {
  const { colors: Colors, isDark } = useAppTheme();
  const [query, setQuery] = useState('');

  const contacts = useContactStore((s) => s.contacts);
  const fetchContacts = useContactStore((s) => s.fetchContacts);
  const isLoading = useContactStore((s) => s.isLoading);

  useEffect(() => {
    if (visible && contacts.length === 0) {
      fetchContacts().catch(() => {});
    }
  }, [visible, contacts.length, fetchContacts]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return contacts;
    return contacts.filter(
      (c) => c.displayName.toLowerCase().includes(q) || c.handle?.toLowerCase().includes(q),
    );
  }, [contacts, query]);

  const handleSelect = useCallback((name: string, avatar: string, handle: string) => {
    onSelect(name, avatar, handle);
    onClose();
    setQuery('');
  }, [onSelect, onClose]);

  const renderItem = useCallback(({ item }: { item: typeof contacts[number] }) => {
    const avatar = item.profileImageUrl ?? '';
    const handle = item.handle ?? '';
    return (
      <TouchableOpacity
        style={[styles.row, { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}
        activeOpacity={0.75}
        onPress={() => handleSelect(item.displayName, avatar, handle)}
      >
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: Colors.primary + '22' }]}>
            <Text style={[styles.avatarInitial, { color: Colors.primary }]}>
              {item.displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.info}>
          <Text style={[styles.name, { color: Colors.textPrimary }]} numberOfLines={1}>
            {item.displayName}
          </Text>
          {handle ? (
            <Text style={[styles.handle, { color: Colors.textSecondary }]} numberOfLines={1}>
              @{handle}
            </Text>
          ) : null}
        </View>
        <Feather name="chevron-right" size={16} color={Colors.textSecondary} />
      </TouchableOpacity>
    );
  }, [isDark, Colors, handleSelect]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <BlurView intensity={30} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      <View style={[styles.sheet, { backgroundColor: isDark ? '#1a1a1a' : '#fff' }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: Colors.textPrimary }]}>Share Contact</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="x" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <View style={[styles.searchRow, { backgroundColor: isDark ? Colors.surface : '#F3F4F6', borderColor: Colors.border }]}>
          <Feather name="search" size={16} color={Colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.input, { color: Colors.textPrimary }]}
            placeholder="Search contacts…"
            placeholderTextColor={Colors.textSecondary}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
          />
        </View>
        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} />
        ) : filtered.length === 0 ? (
          <Text style={[styles.empty, { color: Colors.textSecondary }]}>
            {query ? 'No contacts found' : 'No contacts yet'}
          </Text>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(c) => c.id}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 }}
          />
        )}
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    marginTop: 80,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  title: { fontSize: 17, fontWeight: '700' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  input: { flex: 1, fontSize: 15 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 18, fontWeight: '700' },
  info: { flex: 1 },
  name: { ...Typography.body, fontWeight: '600', fontSize: 15 },
  handle: { ...Typography.caption, fontSize: 13, marginTop: 1 },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 14 },
});
