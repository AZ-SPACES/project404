import React, { useMemo } from "react";
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
import { RootStackParamList } from "../../../navigation/types";
import { useAppTheme, Typography, Spacing, Radius, ThemeColors } from "../../../theme";
import { useToast } from "../../../providers/ToastProvider";
import { BackButton } from '../../../components/ui/BackButton';
import Button from '../../../components/ui/Button';
import { useNotificationsQuery, NotificationItem } from '../hooks/useNotificationQueries';
import { useMarkAllReadMutation, useMarkReadMutation, useDeleteAllNotificationsMutation } from '../hooks/useNotificationMutations';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Inbox">;

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
  const { showToast } = useToast();

  const { data: notifications = [], isLoading, isError, refetch } = useNotificationsQuery();
  const { mutate: markAllRead } = useMarkAllReadMutation();
  const { mutate: deleteAll } = useDeleteAllNotificationsMutation();
  const { mutate: markRead } = useMarkReadMutation();

  const handleClearNotifications = () => {
    markAllRead(undefined, {
      onSuccess: () => showToast('All notifications marked as read', 'success'),
      onError: () => showToast('Failed to mark notifications as read', 'error'),
    });
  };

  const handleDeleteAllNotifications = () => {
    deleteAll(undefined, {
      onSuccess: () => showToast('Notifications cleared', 'success'),
      onError: () => showToast('Failed to clear notifications', 'error'),
    });
  };

  const handleNotificationPress = (id: string) => {
    const notification = notifications.find(n => n.id === id);
    if (!notification || notification.isRead) return;
    markRead(id, {
      onError: () => showToast('Failed to read notification', 'error'),
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" />

      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />

        <View style={styles.headerActions}>
          {notifications.length > 0 && (
            <Button
              title="Clear"
              onPress={handleDeleteAllNotifications}
              backgroundColor={Colors.surface}
              textColor={Colors.textPrimary}
              borderRadius={Radius.md}
              paddingVertical={Spacing.sm}
              paddingHorizontal={Spacing.md}
              fontSize={14}
              fontWeight="500"
              width="auto"
              style={{ borderWidth: 1, borderColor: Colors.border }}
            />
          )}
          {notifications.some(n => !n.isRead) && (
            <Button
              title="Mark read"
              onPress={handleClearNotifications}
              backgroundColor={Colors.primary}
              textColor={Colors.white}
              borderRadius={Radius.md}
              paddingVertical={Spacing.sm}
              paddingHorizontal={Spacing.md}
              fontSize={14}
              fontWeight="500"
              width="auto"
            />
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

      {isLoading && (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      )}

      {isError && (
        <View style={styles.centerContainer}>
          <Text style={[Typography.body, { color: Colors.error, marginBottom: Spacing.md }]}>
            Failed to load notifications
          </Text>
          <Button
            title="Retry"
            onPress={() => refetch()}
            backgroundColor={Colors.primary}
            textColor={Colors.white}
            borderRadius={Radius.md}
            paddingVertical={Spacing.sm}
            paddingHorizontal={Spacing.md}
            fontSize={14}
            fontWeight="500"
            width="auto"
          />
        </View>
      )}

      {!isLoading && !isError && (
        <FlatList
          data={notifications}
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
