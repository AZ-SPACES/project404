import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@react-native-vector-icons/feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../theme';
import { Contact, CONTACTS, Message } from './chatTypes';

interface ForwardModalProps {
  visible: boolean;
  message: Message | null;
  onClose: () => void;
  onForward: (contacts: Contact[], message: Message) => void;
}

export const ForwardModal = ({ visible, message, onClose, onForward }: ForwardModalProps) => {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.background === '#121212';
  const styles = useMemo(() => createStyles(Colors, isDark), [Colors, isDark]);
  const insets = useSafeAreaInsets();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Reset state when opened
  React.useEffect(() => {
    if (visible) {
      setSearchQuery('');
      setSelectedIds(new Set());
    }
  }, [visible]);

  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return CONTACTS;
    return CONTACTS.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [searchQuery]);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleForward = () => {
    if (selectedIds.size === 0 || !message) return;
    const selectedContacts = CONTACTS.filter(c => selectedIds.has(c.id));
    onForward(selectedContacts, message);
  };

  const renderContact = ({ item }: { item: Contact }) => {
    const isSelected = selectedIds.has(item.id);
    return (
      <TouchableOpacity
        style={styles.contactRow}
        activeOpacity={0.7}
        onPress={() => toggleSelection(item.id)}
      >
        <Image source={{ uri: item.avatar }} style={styles.avatar} />
        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{item.name}</Text>
          <Text style={styles.contactStatus} numberOfLines={1}>
            {item.online ? 'Online' : 'Offline'}
          </Text>
        </View>
        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
          {isSelected && <Feather name="check" size={14} color={Colors.white} />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.backdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        </View>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
              <Feather name="x" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.title}>Forward to...</Text>
            <View style={styles.iconBtn} />
          </View>

          {/* Search */}
          <View style={styles.searchContainer}>
            <Feather name="search" size={18} color={Colors.textSecondary} />
            <TextInput
              underlineColorAndroid="transparent"
              style={styles.searchInput}
              placeholder="Search contacts"
              placeholderTextColor={Colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Feather name="x-circle" size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* List */}
          <FlatList
            data={filteredContacts}
            keyExtractor={item => item.id}
            renderItem={renderContact}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          />

          {/* Footer Action */}
          {selectedIds.size > 0 && (
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.forwardButton}
                activeOpacity={0.8}
                onPress={handleForward}
              >
                <Text style={styles.forwardButtonText}>
                  Send {selectedIds.size > 1 ? `(${selectedIds.size})` : ''}
                </Text>
                <Feather name="send" size={18} color={Colors.white} style={{ marginLeft: 8 }} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const createStyles = (Colors: ThemeColors, isDark: boolean) => StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    minHeight: '50%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    ...Typography.bodyLg,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  iconBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? Colors.surface : '#F3F4F6',
    margin: Spacing.md,
    paddingHorizontal: Spacing.md,
    height: 40,
    borderRadius: Radius.full,
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.sm,
    color: Colors.textPrimary,
    ...Typography.body,
  },
  listContent: {
    paddingHorizontal: Spacing.md,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
  },
  contactInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  contactName: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  contactStatus: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  footer: {
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  forwardButton: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    height: 48,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forwardButtonText: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.white,
  },
});
