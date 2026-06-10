import React, { useState, useRef, useCallback, useMemo } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@react-native-vector-icons/feather';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';
import { ChatMessageBubble } from '../../../components/chat/ChatMessageBubble';
import type { Message } from '../../../components/chat/chatTypes';
import { useSavedMessagesStore } from '../../../store/savedMessagesStore';
import type { RootStackParamList } from '../../../navigation/types';

export default function SavedMessagesScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const messages = useSavedMessagesStore((s) => s.messages);
  const addMessage = useSavedMessagesStore((s) => s.addMessage);
  const deleteMessage = useSavedMessagesStore((s) => s.deleteMessage);
  const clearAll = useSavedMessagesStore((s) => s.clearAll);

  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList<Message>>(null);

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text) return;
    const now = Date.now();
    const msg: Message = {
      id: `saved_${now}_${Math.random().toString(36).slice(2)}`,
      text,
      sender: 'me',
      time: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: now,
      status: 'read',
      type: 'text',
    };
    addMessage(msg);
    setInputText('');
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [inputText, addMessage]);

  const handleLongPress = useCallback(
    (msg: Message) => {
      Alert.alert('Delete Message', 'Remove this saved message?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMessage(msg.id),
        },
      ]);
    },
    [deleteMessage],
  );

  const handleClearAll = useCallback(() => {
    Alert.alert('Clear All', 'Delete all saved messages?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear All', style: 'destructive', onPress: clearAll },
    ]);
  }, [clearAll]);

  const renderItem = useCallback(
    ({ item }: { item: Message }) => (
      <ChatMessageBubble
        message={item}
        onLongPress={() => handleLongPress(item)}
        isLastInGroup
      />
    ),
    [handleLongPress],
  );

  const keyExtractor = useCallback((item: Message) => item.id, []);

  const listHeader = useMemo(
    () => (
      <View style={styles.listHeader}>
        <Feather name="bookmark" size={32} color={Colors.primary} />
        <Text style={styles.listHeaderTitle}>Saved Messages</Text>
        <Text style={styles.listHeaderSubtitle}>
          Save notes, links, and ideas for yourself. Only you can see these.
        </Text>
      </View>
    ),
    [Colors.primary, styles],
  );

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
          <Text style={styles.headerTitle}>Saved Messages</Text>
          <Text style={styles.headerSubtitle}>
            {messages.length === 0 ? 'No messages yet' : `${messages.length} message${messages.length === 1 ? '' : 's'}`}
          </Text>
        </View>
        {messages.length > 0 && (
          <TouchableOpacity
            onPress={handleClearAll}
            style={styles.clearButton}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="trash-2" size={20} color="#EF4444" />
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                Type something below to save your first note!
              </Text>
            </View>
          }
        />

        {/* Input bar */}
        <View style={[styles.inputBar, { borderTopColor: Colors.border }]}>
          <TextInput
            style={[styles.input, { color: Colors.textPrimary, backgroundColor: isDark ? Colors.surface : '#F3F4F6' }]}
            placeholder="Write a note..."
            placeholderTextColor={Colors.textSecondary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={4000}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[styles.sendButton, { backgroundColor: inputText.trim() ? Colors.primary : Colors.border }]}
            onPress={handleSend}
            disabled={!inputText.trim()}
            activeOpacity={0.8}
          >
            <Feather name="send" size={18} color={inputText.trim() ? Colors.secondary : Colors.textSecondary} />
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
    headerCenter: { flex: 1 },
    headerTitle: {
      ...Typography.bodyLg,
      fontWeight: '700',
      color: Colors.textPrimary,
      fontSize: 17,
    },
    headerSubtitle: {
      ...Typography.caption,
      color: Colors.textSecondary,
      marginTop: 1,
    },
    clearButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // List
    messageList: {
      paddingHorizontal: Spacing.sm,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.xl,
      gap: 4,
    },
    listHeader: {
      alignItems: 'center',
      paddingVertical: Spacing.xl,
      gap: Spacing.sm,
    },
    listHeaderTitle: {
      ...Typography.h3,
      fontWeight: '700',
      color: Colors.textPrimary,
    },
    listHeaderSubtitle: {
      ...Typography.body,
      color: Colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      paddingHorizontal: Spacing.xl,
    },

    // Empty
    emptyContainer: {
      alignItems: 'center',
      paddingTop: Spacing.md,
    },
    emptyText: {
      ...Typography.body,
      color: Colors.textSecondary,
      textAlign: 'center',
    },

    // Input bar
    inputBar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderTopWidth: 1,
      backgroundColor: Colors.background,
      gap: Spacing.sm,
    },
    input: {
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
      marginBottom: Platform.OS === 'ios' ? 0 : 2,
    },
  });
}
