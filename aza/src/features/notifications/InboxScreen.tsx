import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, StatusBar,Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { Colors, Typography, Spacing, Radius } from '../../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Inbox">;

interface NotificationItem {
  id: string;
  title: string;
  date: string;
  content: string;
  isUnread: boolean;
}

const mockNotifications: NotificationItem[] = [
  {
    id: '1',
    title: 'Updates to our Privacy Notices',
    date: '23 Jan',
    content: 'We regularly review our Privacy Notice to make sure it’s clear, easy to navigate and up to date on how Wise handles your data. Changes will come into effect on 18 February 2026. Tap to read it now.',
    isUnread: true,
  },
  {
    id: '2',
    title: 'We’ve hidden some cancelled transfers',
    date: '7 Sep 2025',
    content: 'To make your Activity list easier to read, we’ve started hiding cancelled transfers that weren’t paid for. You can still find them by searching.',
    isUnread: true,
  },
  {
    id: '3',
    title: 'How did we do?',
    date: '5 Sep 2025',
    content: 'You can let us know by taking a quick survey. Your feedback helps us understand what we’re doing well, and what we need to improve. Tap to get started.',
    isUnread: true,
  },
  {
    id: '4',
    title: 'Got a sec?',
    date: '3 Sep 2025',
    content: 'We’d love to know how you heard about us.',
    isUnread: true,
  },
];

const NotificationCard = ({ item }: { item: NotificationItem }) => (
  <View style={styles.notificationItem}>
    <View style={styles.notificationHeader}>
      <View style={styles.titleContainer}>
        {item.isUnread && <View style={styles.unreadDot} />}
        <Text style={[Typography.h3, styles.notificationTitle]}>{item.title}</Text>
      </View>
      <Text style={[Typography.caption, styles.notificationDate]}>{item.date}</Text>
    </View>
    <Text style={[Typography.body, styles.notificationContent]}>{item.content}</Text>
  </View>
);

export default function InboxScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [notifications, setNotifications] = useState<NotificationItem[]>(mockNotifications);

  const handleClearNotifications = () => {
    setNotifications([]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Feather name="arrow-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        {notifications.length > 0 && (
          <TouchableOpacity 
            style={styles.clearButton}
            onPress={handleClearNotifications}
          >
            <Text style={styles.clearButtonText}>Clear notifications</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.titleSection}>
        <Text style={Typography.h1}>Inbox</Text>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={[Typography.body, styles.sectionTitle]}>Notifications</Text>
        <View style={styles.divider} />
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <NotificationCard item={item} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.iconCircle}>
              <Image 
                source={require('../../assets/bell.png')} 
                style={styles.icon}
                resizeMode="contain"
              />
            </View>
            <Text style={[Typography.h3, styles.emptyTitle]}>You're all caught up</Text>
            <Text style={[Typography.body, styles.emptyText]}>
              When you get notifications, they'll show up here.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
  },
  clearButtonText: {
    ...Typography.body,
    fontWeight: '500',
    color: Colors.white,
  },
  titleSection: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    opacity: 0.5,
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  notificationItem: {
    marginBottom: Spacing.xl,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: Spacing.md,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#374151', 
    marginRight: Spacing.sm,
    marginTop: 2,
  },
  notificationTitle: {
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  notificationDate: {
    color: Colors.textSecondary,
    textAlign: 'right',
    minWidth: 80,
  },
  notificationContent: {
    color: Colors.textSecondary,
    lineHeight: 20,
    paddingLeft: 16,
  },
  emptyContainer: {
    paddingTop: 80,
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  iconCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  icon: {
    width: 160,
    height: 160,
  },
  emptyTitle: {
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  emptyText: {
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
