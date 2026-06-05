import React, { useState, useMemo, useRef, useCallback, useEffect, } from 'react';
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
import { Feather } from '@react-native-vector-icons/feather';
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
import { BlockContactModal, ReportModal } from '../../../components/chat/ChatSettingsModals';
import { ChatPaymentSheet } from '../../../components/chat/ChatPaymentSheet';
import {
  Message,
  Contact,
  ReplyInfo,
  MoreAction,
  MenuAnchor,
  AttachmentAnchor,
  isSameDay,
  formatDateHeader,
  formatTime,
  calculateStorageAsync,
} from '../../../components/chat/chatTypes';
import { useChat } from '../../../hooks/useChat';
import { useCallStore } from '../../../store/callStore';
import { usePresenceStore } from '../../../store/presenceStore';
import { useStarredMessagesStore } from '../../../store/starredMessagesStore';
import { uploadChatMedia } from '../../../services/api';

// ----------------------------------------------------------------------------
// Main Screen Component
// ----------------------------------------------------------------------------
export default function ChatScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.background === '#121212';
  const styles = useMemo(() => createScreenStyles(Colors, isDark), [Colors, isDark]);
  const route = useRoute<RouteProp<RootStackParamList, 'ChatScreen'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'ChatScreen'>>();
  const { id, name, avatar, payIdentifier } = route.params;
  const online = usePresenceStore((s) => s.isOnline(id));

  // `id` from the route is the OTHER user's UUID (set by ChatContactsScreen).
  // The hook resolves the underlying backend chat resource and runs the E2EE pipeline.
  const {
    chatId,
    messages: liveMessages,
    isOtherTyping,
    sendText,
    sendMedia,
    setTyping,
    markRead,
    deleteMessage: deleteMessageRemote,
  } = useChat(id);

  const flatListRef = useRef<FlatList>(null);
  const isPickingRef = useRef(false);

  const [message, setMessage] = useState('');
  // Local-only messages (forwarded/media) layered on top of liveMessages.
  const [localOnlyMessages, setLocalOnlyMessages] = useState<Message[]>([]);
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

  // Starred messages store
  const loadStarred = useStarredMessagesStore(s => s.load);
  const starredEntries = useStarredMessagesStore(s => s.entries);
  const starLoadedRef = React.useRef(false);
  useEffect(() => {
    if (!starLoadedRef.current) {
      starLoadedRef.current = true;
      loadStarred();
    }
  }, [loadStarred]);

  // Forward state
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardMessage, setForwardMessage] = useState<Message | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Settings modals
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  // Payment sheet
  const [paymentSheet, setPaymentSheet] = useState<{ visible: boolean; mode: 'send' | 'request' }>({ visible: false, mode: 'send' });

  // Merge backend-driven thread with any local-only entries (forwarded msgs / media not yet wired to backend).
  const messages = useMemo<Message[]>(() => {
    const combined = [...liveMessages, ...localOnlyMessages];
    return combined.sort((a, b) => a.timestamp - b.timestamp);
  }, [liveMessages, localOnlyMessages]);

  // Mark read on focus.
  useEffect(() => {
    if (!chatId) return;
    const unsub = navigation.addListener('focus', () => {
      markRead().catch(() => {});
    });
    markRead().catch(() => {});
    return unsub;
  }, [navigation, chatId, markRead]);

  // Scroll to bottom when a new message arrives
  const prevMsgCountRef = useRef(messages.length);
  useEffect(() => {
    if (messages.length !== prevMsgCountRef.current) {
      prevMsgCountRef.current = messages.length;
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages.length]);

  // Listen for media returned from MediaPreviewScreen — upload to backend then
  // send an E2EE-encrypted message containing the Cloudinary media URL.
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('chat_media_sent', (sentMedia: Message[]) => {
      if (!sentMedia?.length || !chatId) return;

      setLocalOnlyMessages(prev => [...prev, ...sentMedia]);

      (async () => {
        for (const item of sentMedia) {
          const mediaType: 'IMAGE' | 'VIDEO' | 'DOCUMENT' =
            item.type === 'video' ? 'VIDEO' : item.type === 'document' ? 'DOCUMENT' : 'IMAGE';
          const ext = item.type === 'video' ? 'mp4' : 'jpg';
          const file = {
            uri: item.uri!,
            name: item.fileName ?? `media_${Date.now()}.${ext}`,
            type: item.mimeType ?? (item.type === 'video' ? 'video/mp4' : 'image/jpeg'),
          };
          try {
            const response = await uploadChatMedia(file, chatId, mediaType);
            const uploadedKey: string | undefined = response.data?.data?.mediaKey;
            if (!uploadedKey) throw new Error('No mediaKey in upload response');
            await sendMedia(uploadedKey, mediaType, item.text ?? '');
          } catch (e) {
            console.warn('[chat] media upload/send failed for item', item.id, e);
            setLocalOnlyMessages(prev => prev.filter(m => m.id !== item.id));
          }
        }
      })();
    });

    const clearMediaSub = DeviceEventEmitter.addListener('clear_media_messages', (idsToClear: string[]) => {
      if (idsToClear && idsToClear.length > 0) {
        setLocalOnlyMessages(prev => prev.filter(m => !idsToClear.includes(m.id)));
      }
    });

    return () => {
      subscription.remove();
      clearMediaSub.remove();
    };
  }, [sendMedia, chatId]);

  // Handle injected forwarded message — keep locally so we can preserve original metadata.
  useEffect(() => {
    const forwardedMessage = route.params?.forwardedMessage;
    if (forwardedMessage) {
      setLocalOnlyMessages(prev => {
        if (prev.some(m => m.id === forwardedMessage.id)) return prev;
        return [...prev, forwardedMessage];
      });
      navigation.setParams({ forwardedMessage: undefined } as any);
      // Also push the visible text through the E2EE pipeline so the peer receives it.
      if (forwardedMessage.text) sendText(forwardedMessage.text).catch(() => {});
    }
  }, [route.params?.forwardedMessage, navigation, sendText]);

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

  const handleProfilePress = useCallback(async () => {
    const mediaCount = messages.filter(m => m.type === 'image' || m.type === 'video' || m.type === 'document').length;

    const storageStats = await calculateStorageAsync(messages);

    navigation.navigate('ChatInfoScreen', {
      id: chatId ?? id,
      name,
      username: name.toLowerCase().replace(/\s+/g, '_'),
      avatar,
      mediaCount,
      storageStats,
    });
  }, [navigation, name, avatar, messages, chatId, id]);

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

  const initiateOutgoingCall = useCallStore(state => state.initiateOutgoingCall);

  const handleAudioCall = useCallback(async () => {
    setShowCallMenu(false);
    await initiateOutgoingCall(id, 'VOICE');
    navigation.navigate('AudioCall', { name, avatar });
  }, [id, navigation, name, avatar, initiateOutgoingCall]);

  const handleVideoCall = useCallback(async () => {
    setShowCallMenu(false);
    await initiateOutgoingCall(id, 'VIDEO');
    navigation.navigate('VideoCall', { name, avatar });
  }, [id, navigation, name, avatar, initiateOutgoingCall]);

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
    // Clear only the local-only overlay; backend history isn't deletable here.
    setLocalOnlyMessages([]);
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

  // Replace the input box, debounce "typing" updates, and forward the plaintext to the
  // E2EE pipeline. The store handles optimistic UI; the WS will surface delivered/read.
  const handleSend = useCallback(() => {
    const text = message.trim();
    if (!text) return;
    setMessage('');
    setReplyTo(null);
    setTyping(false);
    sendText(text).catch(() => {});
  }, [message, sendText, setTyping]);

  const handleMessageChange = useCallback(
    (next: string) => {
      setMessage(next);
      setTyping(next.length > 0);
    },
    [setTyping],
  );

  const handleSendAudio = useCallback((uri: string, duration: number) => {
    // Encrypted voice notes go through the media-upload flow which isn't wired yet.
    // For now display locally and notify the peer via a text placeholder.
    const msgId = Date.now().toString();
    const newLocal: Message = {
      id: msgId,
      text: 'Voice message',
      sender: 'me',
      time: formatTime(),
      timestamp: Date.now(),
      status: 'sent',
      type: 'audio',
      uri,
      duration,
    };
    setLocalOnlyMessages(prev => [...prev, newLocal]);
    setReplyTo(null);
    sendText('[Voice message]').catch(() => {});
  }, [sendText]);

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
    // Local-only messages are filtered out client-side. Server-backed messages
    // are tombstoned via the backend so the peer sees the deletion too.
    setLocalOnlyMessages(prev => prev.filter(m => m.id !== selectedMessage.id));
    // serverId format from useChat is the backend UUID directly when present.
    deleteMessageRemote(selectedMessage.id).catch(() => {});
    setSelectedMessage(null);
  }, [selectedMessage, deleteMessageRemote]);

  const handleStarMessage = useCallback(() => {
    if (!selectedMessage) return;
    const { isStarred, star, unstar } = useStarredMessagesStore.getState();
    if (isStarred(selectedMessage.id)) {
      unstar(selectedMessage.id).catch(() => {});
    } else {
      star(selectedMessage, chatId ?? id, name).catch(() => {});
    }
    setSelectedMessage(null);
  }, [selectedMessage, chatId, id, name]);

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
  const addMediaMessage = useCallback(async (newMsg: Message) => {
    if (!chatId) return;
    setLocalOnlyMessages(prev => [...prev, newMsg]);

    const mediaType: 'IMAGE' | 'VIDEO' | 'DOCUMENT' =
      newMsg.type === 'video' ? 'VIDEO' : newMsg.type === 'document' ? 'DOCUMENT' : 'IMAGE';
    const file = {
      uri: newMsg.uri!,
      name: newMsg.fileName ?? `media_${Date.now()}`,
      type: newMsg.mimeType ?? 'application/octet-stream',
    };
    try {
      const response = await uploadChatMedia(file, chatId, mediaType);
      const uploadedKey: string | undefined = response.data?.data?.mediaKey;
      if (!uploadedKey) throw new Error('No mediaKey in upload response');
      await sendMedia(uploadedKey, mediaType, newMsg.text ?? '');
    } catch (e) {
      console.warn('[chat] document upload/send failed', e);
      setLocalOnlyMessages(prev => prev.filter(m => m.id !== newMsg.id));
    }
  }, [chatId, sendMedia]);

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
    { icon: 'search', label: 'Search in Conversation', onPress: handleOpenSearch },
    { icon: isMuted ? 'bell' : 'bell-off', label: isMuted ? 'Unmute Notifications' : 'Mute Notifications', onPress: handleToggleMute },
    { icon: 'image', label: 'Shared Media', onPress: () => { handleCloseMoreMenu(); navigation.navigate('SharedMedia', { chatId: chatId ?? undefined, otherUserName: name }); } },
    { icon: 'trash', label: 'Clear Chat', color: '#F59E0B', onPress: handleClearChat },
    { icon: 'slash', label: 'Block Contact', color: '#EF4444', onPress: () => { handleCloseMoreMenu(); setShowBlockModal(true); } },
    { icon: 'flag', label: 'Report', color: '#EF4444', onPress: () => { handleCloseMoreMenu(); setShowReportModal(true); } },
  ], [isMuted, name, avatar, navigation, handleCloseMoreMenu, handleOpenSearch, handleToggleMute, handleClearChat]);

  // --------------------------------------------------------------------------
  // Message long-press actions
  // --------------------------------------------------------------------------
  const messageActions = useMemo<MoreAction[]>(() => {
    const isCurrentlyStarred = selectedMessage
      ? starredEntries.some(e => e.messageId === selectedMessage.id)
      : false;
    return [
      { icon: 'corner-up-left', label: 'Reply', onPress: () => { if (selectedMessage) { handleSwipeToReply(selectedMessage); } handleCloseMessageModal(); } },
      { icon: 'corner-up-right', label: 'Forward', onPress: handleOpenForward },
      { icon: 'copy', label: 'Copy', onPress: handleCopy },
      { icon: 'info', label: 'Info', onPress: () => { handleCloseMessageModal(); if (selectedMessage) navigation.navigate('MessageInfo', { message: selectedMessage }); } },
      { icon: 'star', label: isCurrentlyStarred ? 'Unstar' : 'Star', onPress: handleStarMessage },
      { icon: 'trash-2', label: 'Delete', color: '#EF4444', onPress: handleDelete },
    ];
  }, [handleCloseMessageModal, handleCopy, handleDelete, handleStarMessage, selectedMessage, handleSwipeToReply, handleOpenForward, starredEntries, navigation]);

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
    () => isOtherTyping ? <ChatTypingIndicator /> : null,
    [isOtherTyping],
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
            underlineColorAndroid="transparent"
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
            setMessage={handleMessageChange}
            onSend={handleSend}
            isAddOpen={showAttachment}
            onAddPress={handleAddPress}
            replyTo={replyTo}
            onCancelReply={handleCancelReply}
            onSendAudio={handleSendAudio}
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
            setMessage={handleMessageChange}
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
        onSendMoney={() => {
          handleCloseAttachment();
          setPaymentSheet({ visible: true, mode: 'send' });
        }}
        onRequestMoney={() => {
          handleCloseAttachment();
          setPaymentSheet({ visible: true, mode: 'request' });
        }}
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

      {/* Apple Cash-style payment sheet */}
      <ChatPaymentSheet
        visible={paymentSheet.visible}
        mode={paymentSheet.mode}
        recipientName={name}
        recipientAvatar={avatar}
        recipientIdentifier={payIdentifier ?? id}
        onClose={() => setPaymentSheet(s => ({ ...s, visible: false }))}
        onSuccess={(amount, paidMode) => {
          setPaymentSheet(s => ({ ...s, visible: false }));
          // Send through the E2EE pipeline so the card persists across navigation
          sendText(JSON.stringify({ __payment: true, amount, mode: paidMode })).catch(() => {});
        }}
      />

      <BlockContactModal
        visible={showBlockModal}
        contactName={name}
        isDark={isDark}
        Colors={Colors}
        onClose={() => setShowBlockModal(false)}
        onBlock={() => {
          setShowBlockModal(false);
          navigation.goBack();
        }}
      />

      <ReportModal
        visible={showReportModal}
        contactName={name}
        isDark={isDark}
        Colors={Colors}
        onClose={() => setShowReportModal(false)}
        onReport={(reason) => {
          setShowReportModal(false);
          // Toast could be used here
        }}
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
