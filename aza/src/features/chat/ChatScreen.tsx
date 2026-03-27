import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, TextInput, KeyboardAvoidingView, Platform, FlatList, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/types';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../theme';

interface Message {
  id: string;
  text: string;
  sender: 'me' | 'other';
  time: string;
}

// ----------------------------------------------------------------------------
// Chat Header Component
// ----------------------------------------------------------------------------
function ChatHeader({ name, avatar, online, onBack }: { name: string; avatar: string; online: boolean; onBack: () => void }) {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.background === '#121212';
  const styles = useMemo(() => createHeaderStyles(Colors, isDark), [Colors, isDark]);

  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.iconButton} onPress={onBack} activeOpacity={0.8}>
        <Feather name="chevron-left" size={24} color={Colors.textPrimary} />
      </TouchableOpacity>
      
      <View style={styles.profileInfo}>
        <Image source={{ uri: avatar }} style={styles.avatar} />
        <View style={styles.nameContainer}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          {online && <Text style={styles.onlineText}>online</Text>}
        </View>
      </View>

      <View style={styles.rightActions}>
        <TouchableOpacity style={styles.iconButton} activeOpacity={0.8}>
          <Feather name="video" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton} activeOpacity={0.8}>
          <Feather name="more-horizontal" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ----------------------------------------------------------------------------
// Chat Message Component
// ----------------------------------------------------------------------------
function ChatMessageBubble({ message }: { message: Message }) {
  const { colors: Colors } = useAppTheme();
  const styles = useMemo(() => createMessageStyles(Colors), [Colors]);
  const isMe = message.sender === 'me';

  return (
    <View style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowOther]}>
      <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
        <Text style={[styles.text, isMe ? styles.textMe : styles.textOther]}>
          {message.text}
        </Text>
      </View>
    </View>
  );
}

// ----------------------------------------------------------------------------
// Chat Input Component
// ----------------------------------------------------------------------------
function ChatInputArea({ message, setMessage, onSend }: { message: string, setMessage: (val: string) => void, onSend: () => void }) {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.background === '#121212';
  const styles = useMemo(() => createInputStyles(Colors, isDark), [Colors, isDark]);

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.actionButton} activeOpacity={0.8}>
        <Feather name="plus" size={24} color={Colors.white} />
      </TouchableOpacity>

      <View style={styles.inputWrapper}>
        <Feather name="message-square" size={20} color={Colors.textSecondary} style={styles.icon} />
        <TextInput
          style={styles.textInput}
          placeholder="Type here"
          placeholderTextColor={Colors.textSecondary}
          value={message}
          onChangeText={setMessage}
          multiline
        />
      </View>

      <TouchableOpacity style={styles.actionButton} activeOpacity={0.8} onPress={onSend}>
        <Feather name="send" size={20} color={Colors.white} style={styles.sendIcon} />
      </TouchableOpacity>
    </View>
  );
}

// ----------------------------------------------------------------------------
// Main Screen Component
// ----------------------------------------------------------------------------
export function ChatScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.background === '#121212';
  const route = useRoute<RouteProp<RootStackParamList, 'ChatScreen'>>();
  const navigation = useNavigation();
  const { name, avatar, online } = route.params;

  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', text: "I'm suppposed to send your money. I will send it tomorrow, 7pm.", sender: 'other', time: '9:30 AM' },
    { id: '2', text: "Will be waiting.", sender: 'me', time: '9:35 AM' },
    { id: '3', text: "Thanks.", sender: 'other', time: '9:40 AM' }
  ]);

  const handleSend = () => {
    if (!message.trim()) return;
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      text: message.trim(),
      sender: 'me',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
    setMessage('');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors.background }]} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" />
      
      <ChatHeader 
        name={name} 
        avatar={avatar} 
        online={online} 
        onBack={() => navigation.goBack()} 
      />

      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          data={messages}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <ChatMessageBubble message={item} />}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
        />

        <ChatInputArea 
          message={message} 
          setMessage={setMessage} 
          onSend={handleSend}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  messagesList: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
});

const createHeaderStyles = (Colors: ThemeColors, isDark: boolean) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: isDark ? Colors.surface : 'rgba(22,51,0,0.07)',
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: Spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    marginRight: Spacing.sm,
  },
  nameContainer: {
    flex: 1,
    paddingRight: Spacing.sm,
  },
  name: {
    ...Typography.bodyLg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  onlineText: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.primary, // Using primary theme color for online indicator
  },
  rightActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
});

const createMessageStyles = (Colors: ThemeColors) => StyleSheet.create({
  messageRow: {
    flexDirection: 'row',
    width: '100%',
  },
  messageRowMe: {
    justifyContent: 'flex-end',
  },
  messageRowOther: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '75%',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: 16,
  },
  bubbleMe: {
    backgroundColor: Colors.primary, // dynamic theming for the sender bubble
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: Colors.surface, // correctly mapped per user request
    borderTopLeftRadius: 4, 
  },
  text: {
    ...Typography.body,
    fontSize: 15,
    lineHeight: 22,
  },
  textMe: {
    color: Colors.white,
  },
  textOther: {
    color: Colors.textPrimary,
  },
});

const createInputStyles = (Colors: ThemeColors, isDark: boolean) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary, // Dark green based on theme
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? Colors.surface : Colors.white, // dynamically reacts to darkmode
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border, // helps stand out against pure background
    paddingHorizontal: Spacing.md,
    minHeight: 44,
    maxHeight: 120,
  },
  icon: {
    marginRight: Spacing.sm,
  },
  textInput: {
    flex: 1,
    ...Typography.body,
    fontSize: 15,
    color: Colors.textPrimary,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
  },
  sendIcon: {
    marginRight: 2,
    marginTop: 2,
  },
});
