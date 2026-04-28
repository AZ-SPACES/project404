import React, { useState, useMemo, useRef, useCallback, useEffect, memo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, FlatList, StatusBar, Modal,
  Pressable, TextInput, DeviceEventEmitter,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';

import { ChatHeader } from '../../../components/chat/ChatHeader';
import { ChatMessageBubble, ChatTypingIndicator } from '../../../components/chat/ChatMessageBubble';
import { ChatInputArea } from '../../../components/chat/ChatInputArea';
import { ChatAttachmentModal } from '../../../components/chat/ChatAttachmentModal';
import { ChatMoreModal } from '../../../components/chat/ChatMoreModal';
import { ChatCallModal } from '../../../components/chat/ChatCallModal';
import { SwipeableMessageBubble } from '../../../components/chat/SwipeableMessageBubble';
import { ForwardModal } from '../../../components/chat/ForwardModal';
import {
  Message,
  Contact,
  ReplyInfo,
  MoreAction,
  MenuAnchor,
  AttachmentAnchor,
  AUTO_REPLIES,
  isSameDay,
  formatDateHeader,
  formatTime,
} from '../../../components/chat/chatTypes';

// ----------------------------------------------------------------------------
// Main Screen Component
// ----------------------------------------------------------------------------
export default function ChatScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.background === '#121212';
  const styles = useMemo(() => createScreenStyles(Colors, isDark), [Colors, isDark]);
  const route = useRoute<RouteProp<RootStackParamList, 'ChatScreen'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'ChatScreen'>>();
  const { id, name, avatar, online } = route.params;

  const flatListRef = useRef<FlatList>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const isPickingRef = useRef(false);

  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<MenuAnchor | null>(null);
  
  // Call menu state
  const [showCallMenu, setShowCallMenu] = useState(false);
  const [callMenuAnchor, setCallMenuAnchor] = useState<MenuAnchor | null>(null);

  const [showAttachment, setShowAttachment] = useState(false);
  const [attachmentAnchor, setAttachmentAnchor] = useState<AttachmentAnchor | null>(null);
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [replyTo, setReplyTo] = useState<ReplyInfo | null>(null);

  // Forward state
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardMessage, setForwardMessage] = useState<Message | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Cleanup all timers on unmount
  useEffect(() => () => { timersRef.current.forEach(clearTimeout); }, []);

  const scheduleTimer = useCallback((fn: () => void, delay: number) => {
    const id = setTimeout(fn, delay);
    timersRef.current.push(id);
    return id;
  }, []);

  // Scroll to bottom when a new message arrives
  const prevMsgCountRef = useRef(messages.length);
  useEffect(() => {
    if (messages.length !== prevMsgCountRef.current) {
      prevMsgCountRef.current = messages.length;
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages.length]);

  // Listen for media returned from MediaPreviewScreen
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('chat_media_sent', (sentMedia: Message[]) => {
      if (sentMedia && sentMedia.length > 0) {
        setMessages(prev => [...prev, ...sentMedia]);
        
        // Simulate delivery pipeline for media messages
        scheduleTimer(() => setMessages(p => p.map(m => sentMedia.find(s => s.id === m.id) ? { ...m, status: 'delivered' } : m)), 800);
        scheduleTimer(() => setMessages(p => p.map(m => sentMedia.find(s => s.id === m.id) ? { ...m, status: 'read' } : m)), 1800);
        scheduleTimer(() => {
          setIsOtherUserTyping(true);
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 2400);
        scheduleTimer(() => {
          setIsOtherUserTyping(false);
          const replyText = AUTO_REPLIES[Math.floor(Math.random() * AUTO_REPLIES.length)] ?? 'Got it!';
          setMessages(p => [...p, { id: (Date.now() + 1).toString(), text: replyText, sender: 'other', time: formatTime(), timestamp: Date.now(), type: 'text' }]);
        }, 4000);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [scheduleTimer]);

  // Handle injected forwarded message
  useEffect(() => {
    const forwardedMessage = route.params?.forwardedMessage;
    if (forwardedMessage) {
      setMessages(prev => {
        // Prevent duplicate injection
        if (prev.some(m => m.id === forwardedMessage.id)) return prev;
        return [...prev, forwardedMessage];
      });
      // Clear param so it doesn't re-trigger
      navigation.setParams({ forwardedMessage: undefined });
      
      // Simulate delivery pipeline
      scheduleTimer(() => setMessages(p => p.map(m => m.id === forwardedMessage.id ? { ...m, status: 'delivered' } : m)), 800);
      scheduleTimer(() => setMessages(p => p.map(m => m.id === forwardedMessage.id ? { ...m, status: 'read' } : m)), 1800);
    }
  }, [route.params?.forwardedMessage, navigation, scheduleTimer]);

  const filteredMessages = useMemo(
    () =>
      searchQuery.trim()
        ? messages.filter(m => m.text.toLowerCase().includes(searchQuery.toLowerCase()))
        : messages,
    [messages, searchQuery],
  );

  // --------------------------------------------------------------------------
  // Stable callbacks
  // --------------------------------------------------------------------------
  const handleBack = useCallback(() => navigation.goBack(), [navigation]);

  const handleProfilePress = useCallback(() => {
    navigation.navigate('ChatInfoScreen', {
      name,
      username: name.toLowerCase().replace(/\s+/g, '_'),
      avatar,
    });
  }, [navigation, name, avatar]);

  const handleMorePress = useCallback((anchor: MenuAnchor) => {
    setMenuAnchor(anchor);
    setShowMoreMenu(true);
  }, []);

  const handleCallPress = useCallback((anchor: MenuAnchor) => {
    setCallMenuAnchor(anchor);
    setShowCallMenu(true);
  }, []);

  const handleCloseMoreMenu = useCallback(() => setShowMoreMenu(false), []);
  const handleCloseCallMenu = useCallback(() => setShowCallMenu(false), []);

  const handleAudioCall = useCallback(() => {
    setShowCallMenu(false);
    navigation.navigate('AudioCall', { name, avatar });
  }, [navigation, name, avatar]);

  const handleVideoCall = useCallback(() => {
    setShowCallMenu(false);
    navigation.navigate('VideoCall', { name, avatar });
  }, [navigation, name, avatar]);

  const handleAddPress = useCallback((anchor: AttachmentAnchor) => {
    setAttachmentAnchor(anchor);
    setShowAttachment(true);
  }, []);

  const handleCloseAttachment = useCallback(() => setShowAttachment(false), []);
  const handleCloseMessageModal = useCallback(() => setSelectedMessage(null), []);
  const handleSelectMessage = useCallback((msg: Message) => setSelectedMessage(msg), []);

  const handleSearchClose = useCallback(() => {
    setSearchActive(false);
    setSearchQuery('');
  }, []);

  const handleClearChat = useCallback(() => {
    setMessages([]);
    setShowMoreMenu(false);
  }, []);

  const handleToggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
    setShowMoreMenu(false);
  }, []);

  const handleOpenSearch = useCallback(() => {
    setShowMoreMenu(false);
    setSearchActive(true);
  }, []);

  // --------------------------------------------------------------------------
  // Send
  // --------------------------------------------------------------------------
  const handleSwipeToReply = useCallback((msg: Message) => {
    setReplyTo({ id: msg.id, text: msg.text || msg.caption || msg.fileName || 'Media', sender: msg.sender });
  }, []);

  const handleCancelReply = useCallback(() => {
    setReplyTo(null);
  }, []);

  const handleSend = useCallback(() => {
    if (!message.trim()) return;
    const msgId = Date.now().toString();
    const msgText = message.trim();
    const msgTime = formatTime();
    const msgTimestamp = Date.now();
    const currentReply = replyTo;

    setMessages(prev => [...prev, {
      id: msgId,
      text: msgText,
      sender: 'me',
      time: msgTime,
      timestamp: msgTimestamp,
      status: 'sent',
      type: 'text',
      ...(currentReply ? { replyTo: currentReply.id, replyToMessage: currentReply } : {}),
    }]);
    setMessage('');
    setReplyTo(null);

    scheduleTimer(() => setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'delivered' } : m)), 800);
    scheduleTimer(() => setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'read' } : m)), 1800);
    scheduleTimer(() => {
      setIsOtherUserTyping(true);
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 2400);
    scheduleTimer(() => {
      setIsOtherUserTyping(false);
      const replyText = AUTO_REPLIES[Math.floor(Math.random() * AUTO_REPLIES.length)] ?? 'Got it!';
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), text: replyText, sender: 'other', time: formatTime(), timestamp: Date.now(), type: 'text' }]);
    }, 4000);
  }, [message, replyTo, scheduleTimer]);

  // --------------------------------------------------------------------------
  // Message actions
  // --------------------------------------------------------------------------
  const handleCopy = useCallback(async () => {
    if (!selectedMessage) return;
    await Clipboard.setStringAsync(selectedMessage.text);
    setSelectedMessage(null);
  }, [selectedMessage]);

  const handleDelete = useCallback(() => {
    if (!selectedMessage) return;
    setMessages(prev => prev.filter(m => m.id !== selectedMessage.id));
    setSelectedMessage(null);
  }, [selectedMessage]);

  const handleOpenForward = useCallback(() => {
    if (!selectedMessage) return;
    setForwardMessage(selectedMessage);
    setShowForwardModal(true);
    setSelectedMessage(null);
  }, [selectedMessage]);

  const handleForwardAction = useCallback((contacts: Contact[], message: Message) => {
    setShowForwardModal(false);
    
    if (contacts.length === 1) {
      const contact = contacts[0];
      if (!contact) return;
      const newForwardedMessage: Message = {
        ...message,
        id: Date.now().toString(),
        sender: 'me',
        status: 'sent',
        timestamp: Date.now(),
        time: formatTime(),
      };
      
      navigation.push('ChatScreen', {
        id: contact.id,
        name: contact.name,
        avatar: contact.avatar,
        online: contact.online,
        forwardedMessage: newForwardedMessage,
      });
    } else {
      setToastMessage(`Forwarded to ${contacts.length} contact${contacts.length > 1 ? 's' : ''}`);
      setTimeout(() => setToastMessage(null), 3000);
    }
  }, [navigation]);

  // --------------------------------------------------------------------------
  // Media pickers
  // --------------------------------------------------------------------------
  const addMediaMessage = useCallback((newMsg: Message) => {
    setMessages(prev => [...prev, newMsg]);
  }, []);

  const handlePickPhoto = useCallback(async () => {
    if (isPickingRef.current) return;
    isPickingRef.current = true;
    setShowAttachment(false);
    await new Promise<void>(resolve => setTimeout(resolve, 350));
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos', 'livePhotos'] as ImagePicker.MediaType[],
        allowsMultipleSelection: true,
        quality: 0.85,
        selectionLimit: 10,
      });
      if (!result.canceled && result.assets.length > 0) {
        navigation.navigate('MediaPreview', {
          media: result.assets.map(a => ({
            uri: a.uri,
            type: (a.type === 'video' ? 'video' : 'image') as 'image' | 'video',
          })),
          recipientName: name,
          chatId: id,
          source: 'gallery',
        });
      }
    } finally {
      isPickingRef.current = false;
    }
  }, [navigation, name, id]);

  const handleOpenCamera = useCallback(async () => {
    if (isPickingRef.current) return;
    isPickingRef.current = true;
    setShowAttachment(false);
    await new Promise<void>(resolve => setTimeout(resolve, 350));
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return;
      navigation.navigate('ChatCamera', {
        recipientName: name,
        chatId: id,
      });
    } finally {
      isPickingRef.current = false;
    }
  }, [navigation, name, id]);

  const handlePickDocument = useCallback(async () => {
    if (isPickingRef.current) return;
    isPickingRef.current = true;
    setShowAttachment(false);
    await new Promise<void>(resolve => setTimeout(resolve, 350));
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        if (!asset) return;
        addMediaMessage({
          id: Date.now().toString(),
          text: asset.name,
          sender: 'me',
          time: formatTime(),
          timestamp: Date.now(),
          status: 'sent',
          type: 'document',
          uri: asset.uri,
          fileName: asset.name,
          ...(asset.mimeType ? { mimeType: asset.mimeType } : {}),
          ...(asset.size ? { fileSize: asset.size } : {}),
        });
      }
    } finally {
      isPickingRef.current = false;
    }
  }, [addMediaMessage]);

  // --------------------------------------------------------------------------
  // More menu actions
  // --------------------------------------------------------------------------
  const moreMenuActions = useMemo<MoreAction[]>(() => [
    { icon: 'user', label: 'View Profile', onPress: () => { handleCloseMoreMenu(); navigation.navigate('ContactsProfile', { name, username: name.toLowerCase().replace(/\s+/g, '_'), avatar }); } },
    { icon: 'send', label: 'Send Money', onPress: () => { handleCloseMoreMenu(); navigation.navigate('SendAmount', { name, username: name.toLowerCase().replace(' ', '_'), avatar }); } },
    { icon: 'download', label: 'Request Money', onPress: () => { handleCloseMoreMenu(); navigation.navigate('RequestAmount', { name, username: name.toLowerCase().replace(' ', '_'), avatar }); } },
    { icon: 'search', label: 'Search in Conversation', onPress: handleOpenSearch },
    { icon: isMuted ? 'bell' : 'bell-off', label: isMuted ? 'Unmute Notifications' : 'Mute Notifications', onPress: handleToggleMute },
    { icon: 'image', label: 'Shared Media', onPress: handleCloseMoreMenu },
    { icon: 'trash', label: 'Clear Chat', color: '#F59E0B', onPress: handleClearChat },
    { icon: 'slash', label: 'Block Contact', color: '#EF4444', onPress: handleCloseMoreMenu },
    { icon: 'flag', label: 'Report', color: '#EF4444', onPress: handleCloseMoreMenu },
  ], [isMuted, name, avatar, navigation, handleCloseMoreMenu, handleOpenSearch, handleToggleMute, handleClearChat]);

  // --------------------------------------------------------------------------
  // Message long-press actions
  // --------------------------------------------------------------------------
  const messageActions = useMemo<MoreAction[]>(() => [
    { icon: 'corner-up-left', label: 'Reply', onPress: () => { if (selectedMessage) { handleSwipeToReply(selectedMessage); } handleCloseMessageModal(); } },
    { icon: 'corner-up-right', label: 'Forward', onPress: handleOpenForward },
    { icon: 'copy', label: 'Copy', onPress: handleCopy },
    { icon: 'info', label: 'Info', onPress: handleCloseMessageModal },
    { icon: 'star', label: 'Star', onPress: handleCloseMessageModal },
    { icon: 'trash-2', label: 'Delete', color: '#EF4444', onPress: handleDelete },
  ], [handleCloseMessageModal, handleCopy, handleDelete, selectedMessage, handleSwipeToReply]);

  // --------------------------------------------------------------------------
  // FlatList helpers
  // --------------------------------------------------------------------------
  const renderItem = useCallback(({ item, index }: { item: Message; index: number }) => {
    const prev = index > 0 ? filteredMessages[index - 1] : undefined;
    const isFirstOfDay = index === 0 || !isSameDay(item.timestamp, prev?.timestamp ?? 0);
    return (
      <View>
        {isFirstOfDay && (
          <View style={styles.dateHeaderContainer}>
            <Text style={styles.dateHeaderText}>{formatDateHeader(item.timestamp)}</Text>
          </View>
        )}
        <SwipeableMessageBubble message={item} onSwipeToReply={handleSwipeToReply}>
          <ChatMessageBubble message={item} onLongPress={() => handleSelectMessage(item)} />
        </SwipeableMessageBubble>
      </View>
    );
  }, [filteredMessages, styles.dateHeaderContainer, styles.dateHeaderText, handleSelectMessage, handleSwipeToReply]);

  const keyExtractor = useCallback((item: Message) => item.id, []);

  const listFooter = useMemo(
    () => isOtherUserTyping ? <ChatTypingIndicator /> : null,
    [isOtherUserTyping],
  );

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors.background }]} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" />

      <ChatHeader
        name={name}
        avatar={avatar}
        online={online}
        onBack={handleBack}
        onProfilePress={handleProfilePress}
        isMenuOpen={showMoreMenu}
        onMorePress={handleMorePress}
        isCallMenuOpen={showCallMenu}
        onCallPress={handleCallPress}
      />

      {searchActive && (
        <View style={styles.searchBar}>
          <Feather name="search" size={16} color={Colors.textSecondary} style={{ marginRight: Spacing.sm }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search messages..."
            placeholderTextColor={Colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          <TouchableOpacity onPress={handleSearchClose} activeOpacity={0.7}>
            <Feather name="x" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {Platform.OS === 'ios' ? (
        <KeyboardAvoidingView style={styles.keyboardAvoidingView} behavior="padding">
          <FlatList
            ref={flatListRef}
            data={filteredMessages}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={listFooter}
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            windowSize={10}
            removeClippedSubviews
          />
          <ChatInputArea
            message={message}
            setMessage={setMessage}
            onSend={handleSend}
            isAddOpen={showAttachment}
            onAddPress={handleAddPress}
            replyTo={replyTo}
            onCancelReply={handleCancelReply}
          />
        </KeyboardAvoidingView>
      ) : (
        <View style={styles.keyboardAvoidingView}>
          <FlatList
            ref={flatListRef}
            data={filteredMessages}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={listFooter}
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            windowSize={10}
            removeClippedSubviews
          />
          <ChatInputArea
            message={message}
            setMessage={setMessage}
            onSend={handleSend}
            isAddOpen={showAttachment}
            onAddPress={handleAddPress}
            replyTo={replyTo}
            onCancelReply={handleCancelReply}
          />
        </View>
      )}

      <ChatAttachmentModal
        visible={showAttachment}
        isDark={isDark}
        anchor={attachmentAnchor}
        onClose={handleCloseAttachment}
        onPhotos={handlePickPhoto}
        onCamera={handleOpenCamera}
        onDocument={handlePickDocument}
      />

      <ChatMoreModal
        visible={showMoreMenu}
        isDark={isDark}
        isMuted={isMuted}
        contactName={name}
        anchor={menuAnchor}
        onClose={handleCloseMoreMenu}
        actions={moreMenuActions}
      />

      <ChatCallModal
        visible={showCallMenu}
        isDark={isDark}
        anchor={callMenuAnchor}
        onClose={handleCloseCallMenu}
        onAudioCall={handleAudioCall}
        onVideoCall={handleVideoCall}
      />

      {/* Message long-press modal */}
      <Modal visible={!!selectedMessage} transparent animationType="fade" onRequestClose={handleCloseMessageModal}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleCloseMessageModal}>
          <BlurView intensity={25} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        </Pressable>
        {selectedMessage && (
          <View style={styles.modalContent} pointerEvents="box-none">
            <View style={{ width: '100%', paddingHorizontal: Spacing.lg }}>
              <ChatMessageBubble message={selectedMessage} />
            </View>
            <View style={styles.actionMenu}>
              {messageActions.map((action) => (
                <TouchableOpacity key={action.label} style={styles.actionItem} onPress={action.onPress} activeOpacity={0.7}>
                  <Feather name={action.icon as any} size={20} color={action.color ?? Colors.textPrimary} />
                  <Text style={[styles.actionLabel, { color: action.color ?? Colors.textPrimary }]}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </Modal>

      {/* Forward Modal */}
      <ForwardModal
        visible={showForwardModal}
        message={forwardMessage}
        onClose={() => setShowForwardModal(false)}
        onForward={handleForwardAction}
      />

      {/* Toast */}
      {toastMessage && (
        <View style={styles.toastContainer}>
          <View style={styles.toast}>
            <Feather name="check-circle" size={18} color="#fff" />
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

// ============================================================================
// Styles — screen-level only
// ============================================================================
const createScreenStyles = (Colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: { flex: 1 },
    keyboardAvoidingView: { flex: 1 },
    messagesList: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.xl,
      gap: Spacing.md,
    },
    dateHeaderContainer: { alignItems: 'center', marginVertical: Spacing.sm },
    dateHeaderText: {
      ...Typography.caption,
      fontSize: 12,
      fontWeight: '600',
      color: Colors.textSecondary,
      backgroundColor: isDark ? Colors.surface : 'rgba(0,0,0,0.05)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      overflow: 'hidden',
    },
    modalContent: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 100,
    },
    actionMenu: {
      backgroundColor: isDark ? Colors.surface : Colors.white,
      borderRadius: Radius.lg,
      padding: Spacing.sm,
      width: 250,
      marginTop: Spacing.xl,
      elevation: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
    },
    actionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.md,
      gap: Spacing.md,
    },
    actionLabel: { ...Typography.body, fontWeight: '500' },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: Spacing.lg,
      marginBottom: Spacing.sm,
      backgroundColor: isDark ? Colors.surface : '#F3F4F6',
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: Colors.border,
      paddingHorizontal: Spacing.md,
      paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    },
    searchInput: { flex: 1, ...Typography.body, fontSize: 15, color: Colors.textPrimary },
    toastContainer: {
      position: 'absolute',
      bottom: Platform.OS === 'ios' ? 100 : 80,
      left: 0,
      right: 0,
      alignItems: 'center',
      zIndex: 100,
    },
    toast: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#111827',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.full,
      gap: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 5,
    },
    toastText: {
      ...Typography.body,
      color: '#fff',
      fontWeight: '500',
    },
  });
