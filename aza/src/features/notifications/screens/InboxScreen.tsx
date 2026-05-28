import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  StatusBar,
  Image,
  ActivityIndicator
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from '@react-native-vector-icons/feather';
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Notifications from 'expo-notifications';
import { RootStackParamList } from "../../../navigation/types";
import { useAppTheme, Typography, Spacing, Radius, ThemeColors } from "../../../theme";
import { useNotifications } from "../../../providers/NotificationProvider";
import { useToast } from "../../../providers/ToastProvider";

import { getNotifications, markAllNotificationsAsRead, markNotificationAsRead, deleteAllNotifications } from "../../../services/api";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Inbox">;

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  data: string;
  imageUrl?: string;
  isRead: boolean;
  createdAt: string;
}

type ScreenState = 
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'success'; data: NotificationItem[] };

const NotificationCard = ({ 
  item, 
  styles, 
  Colors,
  onPress
}: { 
  item: NotificationItem, 
  styles: ReturnType<typeof createStyles>, 
  Colors: ThemeColors,
  onPress: (id: string) => void
}) => {
  const date = new Date(item.createdAt);
  const formattedDate = !isNaN(date.getTime()) 
    ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : item.createdAt;

  return (
    <TouchableOpacity 
      style={[styles.notificationCard, !item.isRead && styles.notificationCardUnread]}
      onPress={() => onPress(item.id)}
      disabled={item.isRead}
    >
      <View style={styles.notificationHeader}>
        <View style={styles.titleContainer}>
          {!item.isRead && <View style={styles.unreadDot} />}
          <Text style={[Typography.h3, styles.notificationTitle]}>
            {item.title}
          </Text>
        </View>
        <Text style={[Typography.caption, styles.notificationDate]}>
          {formattedDate}
        </Text>
      </View>
      {item.imageUrl && (
        <Image 
          source={{ uri: item.imageUrl }} 
          style={styles.notificationImage} 
          resizeMode="cover"
        />
      )}
      <Text style={[Typography.body, styles.notificationContent]}>
        {item.body}
      </Text>
    </TouchableOpacity>
  );
};

export default function InboxScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const isDark = Colors.isDark;
  const navigation = useNavigation<NavigationProp>();
  const { fetchUnreadCount } = useNotifications();
  const { showToast } = useToast();
  
  const [screenState, setScreenState] = useState<ScreenState>({ status: 'idle' });

  const fetchNotifications = useCallback(async (isRefresh = false) => {
    if (!isRefresh) {
      setScreenState({ status: 'loading' });
    }
    try {
      const response = await getNotifications();
      if (response.data?.data?.content) {
        const mapped = response.data.data.content.map((n: any) => ({
          ...n,
          isRead: n.isRead !== undefined ? n.isRead : n.read
        }));
        setScreenState({ status: 'success', data: mapped });
      } else {
        setScreenState({ status: 'success', data: [] });
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      setScreenState({ status: 'error', error: 'Failed to load notifications' });
    }
  }, []);

  useEffect(() => {
    void fetchNotifications();

    const subscription = Notifications.addNotificationReceivedListener(() => {
      void fetchNotifications(true);
    });

    return () => subscription.remove();
  }, [fetchNotifications]);

  const handleClearNotifications = async () => {
    if (screenState.status !== 'success') return;
    try {
      await markAllNotificationsAsRead();
      setScreenState({
        status: 'success',
        data: screenState.data.map(n => ({ ...n, isRead: true }))
      });
      void fetchUnreadCount();
      showToast('All notifications marked as read', 'success');
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      showToast('Failed to mark notifications as read', 'error');
    }
  };

  const handleDeleteAllNotifications = async () => {
    if (screenState.status !== 'success') return;
    try {
      await deleteAllNotifications();
      setScreenState({ status: 'success', data: [] });
      void fetchUnreadCount();
      showToast('Notifications cleared', 'success');
    } catch (error) {
      console.error('Failed to delete all notifications:', error);
      showToast('Failed to clear notifications', 'error');
    }
  };

  const handleNotificationPress = async (id: string) => {
    if (screenState.status !== 'success') return;
    const notification = screenState.data.find(n => n.id === id);
    if (!notification) return;

    try {
      await markNotificationAsRead(id);
      setScreenState({
        status: 'success',
        data: screenState.data.map(n => n.id === id ? { ...n, isRead: true } : n)
      });
      void fetchUnreadCount();
    } catch (error) {
      console.error('Failed to handle notification action:', error);
      showToast('Failed to read notification', 'error');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Feather name="chevron-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        
        <View style={styles.headerActions}>
          {screenState.status === 'success' && screenState.data.length > 0 && (
            <TouchableOpacity
              style={styles.actionButtonOutline}
              onPress={() => void handleDeleteAllNotifications()}
            >
              <Text style={styles.actionButtonOutlineText}>Clear</Text>
            </TouchableOpacity>
          )}
          {screenState.status === 'success' && screenState.data.some(n => !n.isRead) && (
            <TouchableOpacity
              style={styles.actionButtonPrimary}
              onPress={() => void handleClearNotifications()}
            >
              <Text style={styles.actionButtonPrimaryText}>Mark read</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.titleSection}>
        <Text style={Typography.h1}>Inbox</Text>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={[Typography.body, styles.sectionTitle]}>
          Notifications
        </Text>
        <View style={styles.divider} />
      </View>

      {screenState.status === 'loading' && (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      )}

      {screenState.status === 'error' && (
        <View style={styles.centerContainer}>
          <Text style={[Typography.body, { color: Colors.error, marginBottom: Spacing.md }]}>
            {screenState.error}
          </Text>
          <TouchableOpacity 
            style={styles.actionButtonPrimary} 
            onPress={() => void fetchNotifications()}
          >
            <Text style={styles.actionButtonPrimaryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {screenState.status === 'success' && (
        <FlatList
          data={screenState.data}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <NotificationCard 
              item={item} 
              styles={styles} 
              Colors={Colors} 
              onPress={handleNotificationPress} 
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.iconCircle}>
                <Image
                  source={require("../../../assets/bell.png")}
                  style={styles.icon}
                  resizeMode="contain"
                />
              </View>
              <Text style={[Typography.h3, styles.emptyTitle]}>
                You're all caught up
              </Text>
              <Text style={[Typography.body, styles.emptyText]}>
                When you get notifications, they'll show up here.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background 
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.sm 
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.surface,
      justifyContent: "center",
      alignItems: "center" 
    },
    headerActions: {
      flexDirection: 'row', 
      gap: 12 
    },
    actionButtonPrimary: {
      backgroundColor: Colors.primary,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.md,
      justifyContent: 'center',
    },
    actionButtonPrimaryText: {
      ...Typography.body,
      fontWeight: "500",
      color: Colors.white 
    },
    actionButtonOutline: {
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.border,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.md,
      justifyContent: 'center',
    },
    actionButtonOutlineText: {
      ...Typography.body,
      fontWeight: "500",
      color: Colors.textPrimary 
    },
    titleSection: {
      paddingHorizontal: Spacing.lg,
      marginTop: Spacing.md,
      marginBottom: Spacing.lg 
    },
    sectionHeader: {
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.md 
    },
    sectionTitle: {
      color: Colors.textSecondary,
      marginBottom: Spacing.xs 
    },
    divider: {
      height: 1,
      backgroundColor: Colors.border,
      opacity: 0.5 
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: Spacing.xl,
    },
    listContent: {
      flexGrow: 1,
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.xl 
    },
    notificationCard: {
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: Radius.md,
      padding: Spacing.md,
      marginBottom: Spacing.md,
    },
    notificationCardUnread: {
      backgroundColor: isDark ? '#1F2937' : '#F9FAFB',
      borderColor: isDark ? '#374151' : '#E5E7EB',
    },
    notificationImage: {
      width: "100%",
      height: 160,
      borderRadius: Radius.sm,
      marginTop: Spacing.sm,
      marginBottom: Spacing.sm 
    },
    notificationHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: Spacing.xs 
    },
    titleContainer: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      paddingRight: Spacing.md 
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: Colors.primary,
      marginRight: Spacing.sm,
      marginTop: 2 
    },
    notificationTitle: {
      color: Colors.textPrimary,
      flexShrink: 1 
    },
    notificationDate: {
      color: Colors.textSecondary,
      textAlign: "right",
      minWidth: 80 
    },
    notificationContent: {
      color: Colors.textSecondary,
      lineHeight: 20,
    },
    emptyContainer: {
      paddingTop: 80,
      alignItems: "center",
      paddingHorizontal: Spacing.xl 
    },
    iconCircle: {
      alignItems: "center",
      justifyContent: "center",
      marginBottom: Spacing.lg 
    },
    icon: {
      width: 160,
      height: 160 
    },
    emptyTitle: {
      color: Colors.textPrimary,
      marginBottom: Spacing.sm,
      textAlign: "center" 
    },
    emptyText: {
      color: Colors.textSecondary,
      textAlign: "center",
      lineHeight: 20 
    }
  });
}
