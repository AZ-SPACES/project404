import React, { useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@react-native-vector-icons/feather';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';
import { ChatMessageBubble } from '../../../components/chat/ChatMessageBubble';
import { BackButton } from '../../../components/ui/BackButton';
import { useStarredMessagesStore, StarredEntry } from '../../../store/starredMessagesStore';
import { useChatStore } from '../../../store/chatStore';
import type { RootStackParamList } from '../../../navigation/types';

export default function StarredMessagesScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const load = useStarredMessagesStore(s => s.load);
  const entries = useStarredMessagesStore(s => s.entries);
  const unstar = useStarredMessagesStore(s => s.unstar);
  const chats = useChatStore(s => s.chats);

  useEffect(() => {
    load();
  }, [load]);

  const handleJumpToChat = useCallback((entry: StarredEntry) => {
    const chat = chats[entry.chatId];
    if (!chat) return;
    navigation.navigate('ChatScreen', {
      id: chat.otherUserId,
      name: chat.otherUserName,
      avatar: chat.otherUserAvatar ?? '',
      online: false,
    });
  }, [chats, navigation]);

  const handleUnstar = useCallback((messageId: string) => {
    unstar(messageId).catch(() => {});
  }, [unstar]);

  const renderItem = ({ item }: { item: StarredEntry }) => {
    const chat = chats[item.chatId];
    const chatName = chat?.otherUserName ?? item.chatName;
    const chatAvatar = chat?.otherUserAvatar;
    const initials = chatName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

    return (
      <View style={styles.entryWrapper}>
        {/* Chat context row */}
        <TouchableOpacity
          style={styles.contextRow}
          activeOpacity={0.7}
          onPress={() => handleJumpToChat(item)}
        >
          {chatAvatar ? (
            <Image source={{ uri: chatAvatar }} style={styles.contextAvatar} />
          ) : (
            <View style={[styles.contextAvatar, styles.contextAvatarFallback]}>
              <Text style={styles.contextAvatarInitials}>{initials}</Text>
            </View>
          )}
          <View style={styles.contextInfo}>
            <Text style={styles.contextName}>{chatName}</Text>
            <Text style={styles.contextDate}>
              {new Date(item.starredAt).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              })}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => handleUnstar(item.messageId)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.unstarButton}
          >
            <Feather name="star" size={18} color="#F59E0B" />
          </TouchableOpacity>
        </TouchableOpacity>

        {/* Message bubble */}
        <View style={styles.bubbleWrapper}>
          <ChatMessageBubble message={item.message} />
        </View>

        <View style={styles.divider} />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar
        barStyle={Colors.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={Colors.background}
      />

      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Starred Messages</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={entries}
        renderItem={renderItem}
        keyExtractor={item => item.messageId}
        contentContainerStyle={entries.length === 0 ? styles.emptyContent : styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Feather name="star" size={32} color={Colors.textSecondary} />
            </View>
            <Text style={styles.emptyTitle}>No Starred Messages</Text>
            <Text style={styles.emptyDesc}>
              Long-press any message in a chat and tap Star to save it here.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const createStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: Colors.border,
    },
    headerTitle: { ...Typography.bodyLg, fontWeight: '600', color: Colors.textPrimary },

    listContent: { paddingBottom: Spacing.xl },
    emptyContent: { flex: 1 },

    entryWrapper: { paddingTop: Spacing.md },

    contextRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.sm,
      gap: Spacing.sm,
    },
    contextAvatar: {
      width: 34,
      height: 34,
      borderRadius: 17,
    },
    contextAvatarFallback: {
      backgroundColor: Colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    contextAvatarInitials: {
      fontSize: 13,
      fontWeight: '700',
      color: Colors.secondary,
    },
    contextInfo: { flex: 1 },
    contextName: { ...Typography.body, fontWeight: '600', color: Colors.textPrimary },
    contextDate: { ...Typography.caption, color: Colors.textSecondary },
    unstarButton: {
      padding: 4,
    },

    bubbleWrapper: {
      paddingHorizontal: Spacing.lg,
    },

    divider: {
      height: 1,
      backgroundColor: Colors.border,
      marginTop: Spacing.md,
    },

    // Empty state
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.xl * 2,
      marginTop: 120,
    },
    emptyIconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: Colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.lg,
    },
    emptyTitle: { ...Typography.h3, color: Colors.textPrimary, marginBottom: Spacing.sm },
    emptyDesc: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center' },
  });
