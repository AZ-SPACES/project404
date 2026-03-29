import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../theme';

interface Contact {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
  unread: number;
  online: boolean;
  avatar: string;
}

const CONTACTS: Contact[] = [
  { id: '1', name: 'Michael Owusu Addo', lastMessage: 'Thanks.', time: '2mins', unread: 0, online: true, avatar: 'https://i.pravatar.cc/150?u=michael' },
  { id: '2', name: 'Serwaa Amihere', lastMessage: 'Did you receive the package?', time: '', unread: 1, online: true, avatar: 'https://i.pravatar.cc/150?u=serwaa' },
  { id: '3', name: 'Joselyn Dumas', lastMessage: 'Okay, great!', time: '', unread: 2, online: true, avatar: 'https://i.pravatar.cc/150?u=joselyn' },
  { id: '4', name: 'Kwame Nkrumah', lastMessage: "I'm still waiting for the payment.", time: '30sec', unread: 0, online: false, avatar: 'https://i.pravatar.cc/150?u=kwame' },
  { id: '5', name: 'John Dumelo', lastMessage: 'The funds should be ...', time: '1min', unread: 0, online: false, avatar: 'https://i.pravatar.cc/150?u=john' },
  { id: '6', name: 'Samuel Nartey George', lastMessage: 'Sure hahaha', time: '45sec', unread: 0, online: false, avatar: 'https://i.pravatar.cc/150?u=samuel' },
];

export function ChatContactsScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const [activeFilter, setActiveFilter] = useState('All');
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const FILTERS = ['All', 'Favorites', 'Recent', 'Archived'];

  const renderFilter = ({ item }: { item: string }) => {
    const isActive = activeFilter === item;
    return (
      <TouchableOpacity 
        style={[styles.filterPill, isActive && styles.filterPillActive]}
        onPress={() => setActiveFilter(item)}
        activeOpacity={0.8}
      >
        <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
          {item}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderContact = ({ item }: { item: Contact }) => {
    return (
      <TouchableOpacity 
        style={styles.contactRow} 
        activeOpacity={0.7}
        onPress={() => navigation.navigate('ChatScreen', {
          id: item.id,
          name: item.name,
          avatar: item.avatar,
          online: item.online
        })}
      >
        <View style={styles.avatarContainer}>
          <Image source={{ uri: item.avatar }} style={styles.avatar} />
          {item.online && <View style={styles.onlineIndicator} />}
        </View>
        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{item.name}</Text>
          <Text style={styles.lastMessage} numberOfLines={1}>{item.lastMessage}</Text>
        </View>
        <View style={styles.contactMeta}>
          {item.unread > 0 ? (
             <View style={styles.unreadBadge}>
               <Text style={styles.unreadText}>{item.unread}</Text>
             </View>
          ) : (
            <Text style={styles.timeText}>{item.time}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
       <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
       
       <View style={styles.header}>
         <Text style={[Typography.h1, styles.headerTitle]}>Chats</Text>
         <View style={styles.headerActions}>
           <TouchableOpacity style={styles.iconButton} activeOpacity={0.8}>
             <Feather name="search" size={20} color={Colors.textPrimary} />
           </TouchableOpacity>
           <TouchableOpacity style={styles.iconButton} activeOpacity={0.8}>
             <Feather name="more-horizontal" size={20} color={Colors.textPrimary} />
           </TouchableOpacity>
         </View>
       </View>

       <View style={styles.filtersContainer}>
         <FlatList
           horizontal
           showsHorizontalScrollIndicator={false}
           data={FILTERS}
           renderItem={renderFilter}
           keyExtractor={item => item}
           contentContainerStyle={styles.filtersListContent}
         />
       </View>

       <FlatList
         data={CONTACTS}
         renderItem={renderContact}
         keyExtractor={item => item.id}
         showsVerticalScrollIndicator={false}
         contentContainerStyle={styles.contactsListContent}
       />
    </SafeAreaView>
  );
}

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
      paddingTop: Spacing.md,
      marginBottom: Spacing.md,
    },
    headerTitle: {
      color: Colors.textPrimary,
      fontWeight: '700',
      fontSize: 28,
    },
    headerActions: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    iconButton: {
      width: 44,
      height: 44,
      borderRadius: Radius.full,
      backgroundColor: isDark ? Colors.surface : "#F3F4F6",
      alignItems: 'center',
      justifyContent: 'center',
    },
    filtersContainer: {
      marginBottom: Spacing.md,
    },
    filtersListContent: {
      paddingHorizontal: Spacing.lg,
      gap: Spacing.sm,
    },
    filterPill: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.full,
      backgroundColor: isDark ? Colors.surface : "#F3F4F6",
      justifyContent: 'center',
      alignItems: 'center',
    },
    filterPillActive: {
      backgroundColor: Colors.primary,
    },
    filterText: {
      ...Typography.body,
      fontWeight: '500',
      color: Colors.textSecondary,
    },
    filterTextActive: {
      color: Colors.secondary,
    },
    contactsListContent: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.xl * 2,
    },
    contactRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: Spacing.sm,
      marginBottom: Spacing.xs,
    },
    avatarContainer: {
      position: 'relative',
      marginRight: Spacing.md,
    },
    avatar: {
      width: 50,
      height: 50,
      borderRadius: Radius.full,
    },
    onlineIndicator: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 14,
      height: 14,
      borderRadius: Radius.full,
      backgroundColor: Colors.primary, // Using primary color for consistency 
      borderWidth: 2,
      borderColor: Colors.background,
    },
    contactInfo: {
      flex: 1,
      justifyContent: 'center',
    },
    contactName: {
      fontWeight: '700',
      color: Colors.textPrimary,
      marginBottom: 2,
      fontSize: 16,
    },
    lastMessage: {
      ...Typography.body,
      color: Colors.textSecondary,
    },
    contactMeta: {
      alignItems: 'flex-end',
      justifyContent: 'center',
      marginLeft: Spacing.sm,
    },
    timeText: {
      ...Typography.body,
      color: Colors.textSecondary,
    },
    unreadBadge: {
      backgroundColor: Colors.primary,
      borderRadius: 12,
      minWidth: 24,
      height: 24,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 6,
    },
    unreadText: {
      ...Typography.caption,
      color: Colors.white,
      fontWeight: '600',
    },
  });
}
