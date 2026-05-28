import React, { useMemo } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@react-native-vector-icons/feather';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../../navigation/types';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';
import { ChatMessageBubble } from '../../../components/chat/ChatMessageBubble';
import { Message } from '../../../components/chat/chatTypes';
import { BackButton } from '../../../components/ui/BackButton';

type MessageInfoRouteProp = RouteProp<RootStackParamList, 'MessageInfo'>;

export default function MessageInfoScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation();
  const route = useRoute<MessageInfoRouteProp>();
  
  // Provide a fallback mock message if not passed via navigation params for some reason
  const message: Message = route.params?.message ?? {
    id: '1',
    text: 'This is a sample message for the info screen.',
    sender: 'me',
    time: '10:00 AM',
    timestamp: Date.now() - 3600000,
    status: 'read',
    type: 'text',
  };

  const isRead = message.status === 'read';
  const isDelivered = message.status === 'delivered' || message.status === 'read';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle={Colors.isDark ? 'light-content' : 'dark-content'} backgroundColor={Colors.background} />
      
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Message Info</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.messageContainer}>
        <ChatMessageBubble message={message} />
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <View style={styles.iconBox}>
            <Feather name="check-circle" size={20} color={isRead ? '#4ADE80' : Colors.textSecondary} />
          </View>
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoTitle}>Read</Text>
            <Text style={styles.infoTime}>{isRead ? '10:05 AM' : '—'}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <View style={styles.iconBox}>
            <Feather name="check" size={20} color={isDelivered ? Colors.textPrimary : Colors.textSecondary} />
          </View>
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoTitle}>Delivered</Text>
            <Text style={styles.infoTime}>{isDelivered ? '10:01 AM' : '—'}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <View style={styles.iconBox}>
            <Feather name="check" size={20} color={Colors.textPrimary} />
          </View>
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoTitle}>Sent</Text>
            <Text style={styles.infoTime}>{message.time}</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (Colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backButton: { padding: Spacing.xs, marginLeft: -Spacing.xs },
  headerTitle: { ...Typography.bodyLg, fontWeight: '600', color: Colors.textPrimary },
  messageContainer: {
    padding: Spacing.xl,
    alignItems: 'flex-end',
  },
  infoCard: {
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.isDark ? Colors.surface : Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  iconBox: {
    width: 32,
    alignItems: 'flex-start',
  },
  infoTextContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoTitle: {
    ...Typography.body,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  infoTime: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: Spacing.lg + 32,
  },
});
