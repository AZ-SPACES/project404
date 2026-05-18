import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  StatusBar,
  Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";
import { useAppTheme, Typography, Spacing, Radius } from "../../../theme";
import { useNotifications } from "../../../providers/NotificationProvider";

import { api, getNotifications, markAllNotificationsAsRead, markNotificationAsRead, deleteAllNotifications } from "../../../services/api";

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

const NotificationCard = ({ 
  item, 
  styles, 
  Colors,
  onPress
}: { 
  item: NotificationItem, 
  styles: any, 
  Colors: any,
  onPress: (id: string, approval?: boolean) => void
}) => {
  const date = new Date(item.createdAt);
  const formattedDate = !isNaN(date.getTime()) 
    ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : item.createdAt;

  return (
    <TouchableOpacity 
      style={styles.notificationItem}
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
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const isDark = Colors.isDark;
  const navigation = useNavigation<NavigationProp>();
  const { fetchUnreadCount } = useNotifications();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    fetchNotifications();

    const Notifications = require('expo-notifications');
    const subscription = Notifications.addNotificationReceivedListener(() => {
      fetchNotifications();
    });

    return () => subscription.remove();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await getNotifications();
      if (response.data?.data?.content) {
        const mapped = response.data.data.content.map((n: any) => ({
          ...n,
          isRead: n.isRead !== undefined ? n.isRead : n.read
        }));
        setNotifications(mapped);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClearNotifications = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      fetchUnreadCount();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleDeleteAllNotifications = async () => {
    try {
      await deleteAllNotifications();
      setNotifications([]);
      fetchUnreadCount();
    } catch (error) {
      console.error('Failed to delete all notifications:', error);
    }
  };

  const handleNotificationPress = async (id: string, approval?: boolean) => {
    const notification = notifications.find(n => n.id === id);
    if (!notification) return;

    try {
      await markNotificationAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      fetchUnreadCount();
    } catch (error) {
      console.error('Failed to handle notification action:', error);
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
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {notifications.length > 0 && (
            <TouchableOpacity
              style={[styles.clearButton, { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border }]}
              onPress={handleDeleteAllNotifications}
            >
              <Text style={[styles.clearButtonText, { color: Colors.textPrimary }]}>Clear</Text>
            </TouchableOpacity>
          )}
          {notifications.some(n => !n.isRead) && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={handleClearNotifications}
            >
              <Text style={styles.clearButtonText}>Mark all as read</Text>
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

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <NotificationCard item={item} styles={styles} Colors={Colors} onPress={handleNotificationPress} />}
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
    </SafeAreaView>
  );
}

function createStyles(Colors: any) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: "center",
    alignItems: "center" },
  clearButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg },
  clearButtonText: {
    ...Typography.body,
    fontWeight: "500",
    color: Colors.white },
  titleSection: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.lg },
  sectionHeader: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md },
  sectionTitle: {
    color: Colors.textSecondary,
    marginBottom: Spacing.xs },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    opacity: 0.5 },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl },
  notificationItem: {
    marginBottom: Spacing.xl },
  notificationImage: {
    width: "100%",
    height: 160,
    borderRadius: Radius.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm },
  notificationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.xs },
  titleContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingRight: Spacing.md },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#374151",
    marginRight: Spacing.sm,
    marginTop: 2 },
  notificationTitle: {
    color: Colors.textPrimary,
    flexShrink: 1 },
  notificationDate: {
    color: Colors.textSecondary,
    textAlign: "right",
    minWidth: 80 },
  notificationContent: {
    color: Colors.textSecondary,
    lineHeight: 20,
    paddingLeft: 16 },
  emptyContainer: {
    paddingTop: 80,
    alignItems: "center",
    paddingHorizontal: Spacing.xl },
  iconCircle: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg },
  icon: {
    width: 160,
    height: 160 },
  emptyTitle: {
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    textAlign: "center" },
  emptyText: {
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20 },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: Spacing.md,
    paddingLeft: 16
  },
  actionButton: {
    flex: 1,
    height: 36,
    borderRadius: Radius.sm,
    justifyContent: 'center',
    alignItems: 'center'
  },
  approveButton: {
    backgroundColor: Colors.primary
  },
  approveButtonText: {
    color: Colors.background,
    fontWeight: '600',
    fontSize: 14
  },
  rejectButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border
  },
  rejectButtonText: {
    color: Colors.error,
    fontWeight: '600',
    fontSize: 14
  }
});
}
