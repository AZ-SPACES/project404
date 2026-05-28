import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { Feather } from '@react-native-vector-icons/feather';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme, Typography, Spacing, Radius, ThemeColors } from '../../../theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { useContactStore } from '../../../store/contactStore';
import { ContactRequest, SentContactRequest } from '../types';
import { BackButton } from '../../../components/ui/BackButton';

type RequestPendingScreenProps = NativeStackScreenProps<RootStackParamList, 'RequestPending'>;

type Tab = 'received' | 'sent';

export default function RequestPendingScreen({ navigation }: RequestPendingScreenProps) {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const isDark = Colors.isDark;

  const {
    contactRequests,
    sentContactRequests,
    fetchContactRequests,
    fetchSentContactRequests,
    approveContactRequest,
    rejectContactRequest,
    isLoading,
  } = useContactStore();

  const [activeTab, setActiveTab] = useState<Tab>('received');
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    fetchContactRequests();
    fetchSentContactRequests();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchContactRequests(), fetchSentContactRequests()]);
    setRefreshing(false);
  }, [fetchContactRequests, fetchSentContactRequests]);

  const handleApprove = useCallback(
    async (requestId: string) => {
      setActionId(requestId);
      try {
        await approveContactRequest(requestId);
      } finally {
        setActionId(null);
      }
    },
    [approveContactRequest],
  );

  const handleDecline = useCallback(
    async (requestId: string) => {
      setActionId(requestId);
      try {
        await rejectContactRequest(requestId);
      } finally {
        setActionId(null);
      }
    },
    [rejectContactRequest],
  );

  const renderReceivedItem = useCallback(
    ({ item }: { item: ContactRequest }) => {
      const avatarUri =
        item.senderProfileImageUrl ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(item.senderDisplayName)}&background=random`;
      const isActing = actionId === item.id;

      return (
        <View style={styles.requestRow}>
          <Image source={{ uri: avatarUri }} style={styles.requestAvatar} />
          <View style={styles.requestInfo}>
            <Text style={styles.requestName} numberOfLines={1}>
              {item.senderDisplayName}
            </Text>
            <Text style={styles.requestHandle} numberOfLines={1}>
              @{item.senderUsername}
            </Text>
            <Text style={styles.requestTime}>{formatTime(item.createdAt)}</Text>
          </View>
          <View style={styles.requestActions}>
            <TouchableOpacity
              style={styles.declineBtn}
              activeOpacity={0.7}
              onPress={() => handleDecline(item.id)}
              disabled={!!actionId}
              accessibilityLabel="Decline request"
            >
              {isActing ? (
                <ActivityIndicator size="small" color={Colors.textSecondary} />
              ) : (
                <Feather name="x" size={16} color={Colors.textSecondary} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.acceptBtn}
              activeOpacity={0.7}
              onPress={() => handleApprove(item.id)}
              disabled={!!actionId}
              accessibilityLabel="Accept request"
            >
              {isActing ? (
                <ActivityIndicator size="small" color={Colors.secondary} />
              ) : (
                <Feather name="check" size={16} color={Colors.secondary} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [actionId, Colors, styles, handleApprove, handleDecline],
  );

  const renderSentItem = useCallback(
    ({ item }: { item: SentContactRequest }) => {
      const avatarUri =
        item.receiverProfileImageUrl ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(item.receiverDisplayName)}&background=random`;

      return (
        <View style={styles.requestRow}>
          <Image source={{ uri: avatarUri }} style={styles.requestAvatar} />
          <View style={styles.requestInfo}>
            <Text style={styles.requestName} numberOfLines={1}>
              {item.receiverDisplayName}
            </Text>
            <Text style={styles.requestHandle} numberOfLines={1}>
              @{item.receiverUsername}
            </Text>
            <Text style={styles.requestTime}>{formatTime(item.createdAt)}</Text>
          </View>
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingBadgeText}>Pending</Text>
          </View>
        </View>
      );
    },
    [styles],
  );

  const receivedCount = contactRequests.length;
  const sentCount = sentContactRequests.length;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
      />

      {/* Header */}
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Friend Requests</Text>
        <TouchableOpacity
          style={styles.addMoreBtn}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('AddFriends')}
          accessibilityLabel="Add more friends"
        >
          <Feather name="user-plus" size={18} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Tab Pills */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'received' && styles.tabActive]}
          activeOpacity={0.7}
          onPress={() => setActiveTab('received')}
        >
          <Text style={[styles.tabText, activeTab === 'received' && styles.tabTextActive]}>
            Received
          </Text>
          {receivedCount > 0 && (
            <View style={[styles.tabBadge, activeTab === 'received' && styles.tabBadgeActive]}>
              <Text style={[styles.tabBadgeText, activeTab === 'received' && styles.tabBadgeTextActive]}>
                {receivedCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'sent' && styles.tabActive]}
          activeOpacity={0.7}
          onPress={() => setActiveTab('sent')}
        >
          <Text style={[styles.tabText, activeTab === 'sent' && styles.tabTextActive]}>
            Sent
          </Text>
          {sentCount > 0 && (
            <View style={[styles.tabBadge, activeTab === 'sent' && styles.tabBadgeActive]}>
              <Text style={[styles.tabBadgeText, activeTab === 'sent' && styles.tabBadgeTextActive]}>
                {sentCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Content */}
      {isLoading && !refreshing ? (
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : activeTab === 'received' ? (
        <FlatList
          data={contactRequests}
          keyExtractor={item => item.id}
          renderItem={renderReceivedItem}
          contentContainerStyle={[
            styles.listContent,
            contactRequests.length === 0 && styles.emptyListContent,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrapper}>
                <Feather name="inbox" size={40} color={Colors.primary} style={{ opacity: 0.25 }} />
              </View>
              <Text style={styles.emptyTitle}>No requests yet</Text>
              <Text style={styles.emptySubtitle}>
                When someone sends you a friend request, it'll show up here
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={sentContactRequests}
          keyExtractor={item => item.id}
          renderItem={renderSentItem}
          contentContainerStyle={[
            styles.listContent,
            sentContactRequests.length === 0 && styles.emptyListContent,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrapper}>
                <Feather name="send" size={40} color={Colors.primary} style={{ opacity: 0.25 }} />
              </View>
              <Text style={styles.emptyTitle}>No pending requests</Text>
              <Text style={styles.emptySubtitle}>
                Requests you send will appear here while waiting for acceptance
              </Text>
              <TouchableOpacity
                style={styles.addFriendsBtn}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('AddFriends')}
              >
                <Feather name="user-plus" size={16} color={Colors.secondary} />
                <Text style={styles.addFriendsBtnText}>Add Friends</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
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
    addMoreBtn: {
      width: 44,
      height: 44,
      borderRadius: 50,
      backgroundColor: isDark ? Colors.surface : Colors.accent,
      borderWidth: 1,
      borderColor: Colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabContainer: {
      flexDirection: 'row',
      marginHorizontal: Spacing.lg,
      marginTop: Spacing.sm,
      marginBottom: Spacing.md,
      backgroundColor: isDark ? Colors.surface : Colors.white,
      borderRadius: Radius.full,
      padding: 4,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: Radius.full,
    },
    tabActive: {
      backgroundColor: Colors.primary,
    },
    tabText: {
      ...Typography.body,
      fontWeight: '600',
      color: Colors.textSecondary,
    },
    tabTextActive: {
      color: Colors.secondary,
    },
    tabBadge: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: Colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 5,
    },
    tabBadgeActive: {
      backgroundColor: Colors.secondary,
    },
    tabBadgeText: {
      ...Typography.caption,
      fontWeight: '700',
      color: Colors.textSecondary,
    },
    tabBadgeTextActive: {
      color: Colors.primary,
    },
    centeredState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    listContent: {
      paddingHorizontal: Spacing.lg,
    },
    emptyListContent: {
      flex: 1,
    },
    emptyState: {
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
      marginBottom: Spacing.lg,
    },
    addFriendsBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: Colors.primary,
      paddingVertical: 14,
      paddingHorizontal: Spacing.xl,
      borderRadius: Radius.full,
    },
    addFriendsBtnText: {
      ...Typography.body,
      fontWeight: '600',
      color: Colors.secondary,
    },
    requestRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: Spacing.sm + 2,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? Colors.border : Colors.surface,
    },
    requestAvatar: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: AVATAR_SIZE / 2,
      backgroundColor: Colors.surface,
      marginRight: Spacing.md,
    },
    requestInfo: {
      flex: 1,
    },
    requestName: {
      ...Typography.bodyLg,
      fontWeight: '600',
      color: Colors.textPrimary,
    },
    requestHandle: {
      ...Typography.caption,
      color: Colors.primary,
      fontWeight: '500',
      marginTop: 2,
    },
    requestTime: {
      ...Typography.caption,
      color: Colors.textSecondary,
      marginTop: 2,
    },
    requestActions: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    declineBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: isDark ? Colors.surface : Colors.background,
      borderWidth: 1.5,
      borderColor: Colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    acceptBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: Colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pendingBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: Radius.full,
      backgroundColor: isDark ? Colors.surface : Colors.accent,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    pendingBadgeText: {
      ...Typography.caption,
      fontWeight: '600',
      color: Colors.textSecondary,
    },
  });
}
