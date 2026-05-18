import React, { useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';
import { ChatMessageBubble } from '../../../components/chat/ChatMessageBubble';
import { Message, formatTime } from '../../../components/chat/chatTypes';

const MOCK_STARRED: Message[] = [
  {
    id: 's1',
    text: 'This is a very important message that I starred.',
    sender: 'other',
    time: formatTime(),
    timestamp: Date.now() - 86400000,
    status: 'read',
    type: 'text',
    isStarred: true,
  },
];

export default function StarredMessagesScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation();

  const renderItem = ({ item }: { item: Message }) => (
    <View style={styles.messageWrapper}>
      <View style={styles.messageHeader}>
        <Text style={styles.senderName}>{item.sender === 'me' ? 'You' : 'Contact Name'}</Text>
        <Feather name="chevron-right" size={16} color={Colors.textSecondary} />
      </View>
      <ChatMessageBubble message={item} />
      <View style={styles.divider} />
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle={Colors.isDark ? 'light-content' : 'dark-content'} backgroundColor={Colors.background} />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Starred Messages</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={MOCK_STARRED}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Feather name="star" size={32} color={Colors.textSecondary} />
            </View>
            <Text style={styles.emptyTitle}>No Starred Messages</Text>
            <Text style={styles.emptyDesc}>
              Tap and hold on any message in a chat to star it, so you can easily find it later.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const createStyles = (Colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: Spacing.xs,
    marginLeft: -Spacing.xs,
  },
  headerTitle: {
    ...Typography.bodyLg,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  listContent: {
    paddingBottom: Spacing.xl,
  },
  messageWrapper: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  senderName: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginTop: Spacing.lg,
  },
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
  emptyTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  emptyDesc: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
