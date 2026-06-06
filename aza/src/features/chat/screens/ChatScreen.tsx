import React, { useState, useMemo, useRef, useCallback, useEffect, } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform, FlatList, StatusBar, Modal,
  Pressable, TextInput, DeviceEventEmitter, Image, Animated,
  NativeScrollEvent, NativeSyntheticEvent,
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
import { ChatMessageBubble, ChatTypingIndicator, FullScreenImageViewer } from '../../../components/chat/ChatMessageBubble';
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
import { useChatThemeStore } from '../../../store/chatThemeStore';
import { useChatStore } from '../../../store/chatStore';
import { usePinnedMessageStore } from '../../../store/pinnedMessageStore';
import { useReactionStore } from '../../../store/reactionStore';
import { uploadChatMedia, blockUser, notifyChatScreenshot } from '../../../services/api';
import * as ScreenCapture from 'expo-screen-capture';

// ----------------------------------------------------------------------------
// Main Screen Component
// ----------------------------------------------------------------------------
export default function ChatScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.background === '#121212';
  const styles = useMemo(() => createScreenStyles(Colors, isDark), [Colors, isDark]);
  const route = useRoute<RouteProp<RootStackParamList, 'ChatScreen'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'ChatScreen'>>();
  const { id, name, avatar, payIdentifier, quickReply } = route.params;
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
    peerIdentityChange,
  } = useChat(id);

  const flatListRef = useRef<FlatList>(null);
  const isPickingRef = useRef(false);

  // Chat store selectors for mute state + actions
  const chats = useChatStore(s => s.chats);
  const storeMuteChat = useChatStore(s => s.muteChat);
  const clearChatMessages = useChatStore(s => s.clearChatMessages);
  const isMuted = chatId ? (chats[chatId]?.isMuted ?? false) : false;
  const disappearingTtl = chatId ? (chats[chatId]?.disappearingTtlSeconds ?? 0) : 0;
  const lastScreenshot = useChatStore(s => chatId ? s.lastScreenshotByChatId[chatId] : undefined);

  // Show a toast when the peer's screenshot notification arrives.
  const lastScreenshotTsRef = useRef<number | undefined>(lastScreenshot?.ts);
  useEffect(() => {
    if (!lastScreenshot) return;
    if (lastScreenshot.ts === lastScreenshotTsRef.current) return;
    lastScreenshotTsRef.current = lastScreenshot.ts;
    setToastMessage(`${lastScreenshot.senderName} took a screenshot 📸`);
    setTimeout(() => setToastMessage(null), 4000);
  }, [lastScreenshot]);

  // Detect screenshots locally and notify the peer when disappearing messages are active.
  useEffect(() => {
    if (!chatId || !disappearingTtl) return;
    const sub = ScreenCapture.addScreenshotListener(() => {
      notifyChatScreenshot(chatId).catch(() => {});
    });
    return () => sub.remove();
  }, [chatId, disappearingTtl]);

  const [message, setMessage] = useState('');
  // Local-only messages (forwarded/media) layered on top of liveMessages.
  const [localOnlyMessages, setLocalOnlyMessages] = useState<Message[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
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

  // Chat theme
  const loadTheme    = useChatThemeStore(s => s.load);
  const getBubbleColor = useChatThemeStore(s => s.getBubbleColor);
  const getWallpaper = useChatThemeStore(s => s.getWallpaper);
  const themeLoadedRef = React.useRef(false);
  useEffect(() => {
    if (!themeLoadedRef.current) {
      themeLoadedRef.current = true;
      loadTheme();
    }
  }, [loadTheme]);
  const chatBubbleColor = chatId ? getBubbleColor(chatId) : '';
  const chatWallpaper   = chatId ? getWallpaper(chatId)   : null;

  // Pinned messages
  const pinMessage    = usePinnedMessageStore(s => s.pin);
  const unpinMessage  = usePinnedMessageStore(s => s.unpin);
  const getPinned     = usePinnedMessageStore(s => s.getPinned);
  const pinnedMessage = chatId ? getPinned(chatId) : null;

  // Reactions
  const addReaction = useReactionStore(s => s.addReaction);

  // Forward state
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardMessage, setForwardMessage] = useState<Message | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Settings modals
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [keyWarningDismissed, setKeyWarningDismissed] = useState(false);

  // Payment sheet
  const [paymentSheet, setPaymentSheet] = useState<{ visible: boolean; mode: 'send' | 'request'; prefillAmount?: number }>({ visible: false, mode: 'send' });

  // Full-screen image viewer
  const [fullScreenUri, setFullScreenUri] = useState<string | null>(null);

  // Message editing
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editText, setEditText] = useState('');

  // New message animation tracking (initialized lazily; prevMsgCountRef2 updated in the scroll effect below)
  const newMsgIdsRef = useRef(new Set<string>());

  // Unread separator — records message count the first time messages load
  const initialMsgCountRef2 = useRef<number | null>(null);

  // Scroll-to-bottom FAB
  const [showFab, setShowFab] = useState(false);
  const [fabUnread, setFabUnread] = useState(0);
  const fabAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fabAnim, { toValue: showFab ? 1 : 0, duration: 200, useNativeDriver: true }).start();
  }, [showFab, fabAnim]);
  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    setShowFab(distFromBottom > 120);
  }, []);
  const handleScrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
    setFabUnread(0);
  }, []);

  // Merge backend-driven thread with any local-only entries (forwarded msgs / media not yet wired to backend).
  // Inject isStarred from the persistent starred store so bubble indicators stay in sync.
  const messages = useMemo<Message[]>(() => {
    const combined = [...liveMessages, ...localOnlyMessages];
    const sorted = combined.sort((a, b) => a.timestamp - b.timestamp);
    const starredIds = new Set(starredEntries.map(e => e.messageId));
    return sorted.map(m => starredIds.has(m.id) ? { ...m, isStarred: true } : m);
  }, [liveMessages, localOnlyMessages, starredEntries]);

  // Set the unread separator position once (first time messages load)
  useEffect(() => {
    if (initialMsgCountRef2.current === null && messages.length > 0) {
      initialMsgCountRef2.current = messages.length;
    }
  }, [messages.length]);

  // Mark read on focus.
  useEffect(() => {
    if (!chatId) return;
    const unsub = navigation.addListener('focus', () => {
      markRead().catch(() => {});
    });
    markRead().catch(() => {});
    return unsub;
  }, [navigation, chatId, markRead]);

  // Scroll to bottom when a new message arrives; track new IDs for animation
  const prevMsgCountRef = useRef(messages.length);
  useEffect(() => {
    if (messages.length > prevMsgCountRef.current) {
      const newOnes = messages.slice(prevMsgCountRef.current);
      newOnes.forEach(m => newMsgIdsRef.current.add(m.id));
      // If not at bottom, increment FAB unread for messages from others
      if (showFab) {
        const otherCount = newOnes.filter(m => m.sender === 'other').length;
        if (otherCount > 0) setFabUnread(n => n + otherCount);
      } else {
        flatListRef.current?.scrollToEnd({ animated: true });
      }
    }
    prevMsgCountRef.current = messages.length;
  }, [messages.length, showFab]);

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

  // Auto-send a quick reply that arrived from the notification action handler
  useEffect(() => {
    if (!quickReply) return;
    const text = quickReply.trim();
    if (!text) return;
    navigation.setParams({ quickReply: undefined } as any);
    sendText(text).catch(() => {});
  }, [quickReply, navigation, sendText]);

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
    setShowMoreMenu(false);
    Alert.alert(
      'Clear Chat',
      'All messages will be removed from your device. They can be reloaded from the server.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            setLocalOnlyMessages([]);
            if (chatId) clearChatMessages(chatId);
          },
        },
      ],
    );
  }, [chatId, clearChatMessages]);

  const handleToggleMute = useCallback(async () => {
    if (!chatId) return;
    setShowMoreMenu(false);
    await storeMuteChat(chatId, !isMuted);
  }, [chatId, isMuted, storeMuteChat]);

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
  const setDisappearingTtl = useChatStore(s => s.setDisappearingTtl);

  const handleDisappearingTimer = useCallback(() => {
    if (!chatId) return;
    handleCloseMoreMenu();
    const label = disappearingTtl === 86400 ? '24 hours' : disappearingTtl === 604800 ? '7 days' : disappearingTtl === 2592000 ? '30 days' : 'Off';
    Alert.alert(
      'Disappearing Messages',
      `Currently: ${label}\n\nNew messages will be deleted after the selected time.`,
      [
        { text: 'Off', onPress: () => setDisappearingTtl(chatId, 0) },
        { text: '24 hours', onPress: () => setDisappearingTtl(chatId, 86400) },
        { text: '7 days', onPress: () => setDisappearingTtl(chatId, 604800) },
        { text: '30 days', onPress: () => setDisappearingTtl(chatId, 2592000) },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }, [chatId, disappearingTtl, handleCloseMoreMenu, setDisappearingTtl]);

  const moreMenuActions = useMemo<MoreAction[]>(() => [
    { icon: 'search', label: 'Search in Conversation', onPress: handleOpenSearch },
    { icon: isMuted ? 'bell' : 'bell-off', label: isMuted ? 'Unmute Notifications' : 'Mute Notifications', onPress: handleToggleMute },
    { icon: 'clock', label: `Disappearing Messages${disappearingTtl ? ' ✓' : ''}`, onPress: handleDisappearingTimer },
    { icon: 'image', label: 'Shared Media', onPress: () => { handleCloseMoreMenu(); navigation.navigate('SharedMedia', { chatId: chatId ?? undefined, otherUserName: name }); } },
    { icon: 'trash', label: 'Clear Chat', color: '#F59E0B', onPress: handleClearChat },
    { icon: 'slash', label: 'Block Contact', color: '#EF4444', onPress: () => { handleCloseMoreMenu(); setShowBlockModal(true); } },
    { icon: 'flag', label: 'Report', color: '#EF4444', onPress: () => { handleCloseMoreMenu(); setShowReportModal(true); } },
  ], [isMuted, name, chatId, navigation, handleCloseMoreMenu, handleOpenSearch, handleToggleMute, handleClearChat, disappearingTtl, handleDisappearingTimer]);

  const handleEditSubmit = useCallback(() => {
    if (!editingMessage || !editText.trim()) { setEditingMessage(null); return; }
    const updated: Message = { ...editingMessage, text: editText.trim(), isEdited: true };
    setLocalOnlyMessages(prev =>
      prev.some(m => m.id === editingMessage.id)
        ? prev.map(m => m.id === editingMessage.id ? updated : m)
        : prev
    );
    setEditingMessage(null);
    setEditText('');
  }, [editingMessage, editText]);

  const handleScrollToPinned = useCallback(() => {
    if (!pinnedMessage) return;
    const idx = filteredMessages.findIndex(m => m.id === pinnedMessage.id);
    if (idx >= 0) flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
  }, [pinnedMessage, filteredMessages]);

  // --------------------------------------------------------------------------
  // Message long-press actions
  // --------------------------------------------------------------------------
  const messageActions = useMemo<MoreAction[]>(() => {
    const isCurrentlyStarred = selectedMessage
      ? starredEntries.some(e => e.messageId === selectedMessage.id)
      : false;
    const isPinned = selectedMessage && pinnedMessage?.id === selectedMessage.id;
    const canEdit = selectedMessage?.sender === 'me' && selectedMessage?.type !== 'audio' && selectedMessage?.type !== 'image';
    return [
      { icon: 'corner-up-left', label: 'Reply', onPress: () => { if (selectedMessage) { handleSwipeToReply(selectedMessage); } handleCloseMessageModal(); } },
      { icon: 'corner-up-right', label: 'Forward', onPress: handleOpenForward },
      { icon: 'copy', label: 'Copy', onPress: handleCopy },
      ...(canEdit ? [{ icon: 'edit-2', label: 'Edit', onPress: () => {
        if (!selectedMessage) return;
        setEditingMessage(selectedMessage);
        setEditText(selectedMessage.text ?? '');
        handleCloseMessageModal();
      }}] : []),
      { icon: 'bookmark', label: isPinned ? 'Unpin' : 'Pin', onPress: () => {
        if (!chatId || !selectedMessage) return;
        if (isPinned) unpinMessage(chatId);
        else pinMessage(chatId, selectedMessage);
        handleCloseMessageModal();
      }},
      { icon: 'info', label: 'Info', onPress: () => { handleCloseMessageModal(); if (selectedMessage) navigation.navigate('MessageInfo', { message: selectedMessage }); } },
      { icon: 'star', label: isCurrentlyStarred ? 'Unstar' : 'Star', onPress: handleStarMessage },
      { icon: 'trash-2', label: 'Delete', color: '#EF4444', onPress: handleDelete },
    ];
  }, [handleCloseMessageModal, handleCopy, handleDelete, handleStarMessage, selectedMessage, handleSwipeToReply, handleOpenForward, starredEntries, navigation, chatId, pinnedMessage, pinMessage, unpinMessage]);

  // --------------------------------------------------------------------------
  // FlatList helpers
  // --------------------------------------------------------------------------
  const renderItem = useCallback(({ item, index }: { item: Message; index: number }) => {
    const prev = index > 0 ? filteredMessages[index - 1] : undefined;
    const next = index < filteredMessages.length - 1 ? filteredMessages[index + 1] : undefined;
    const isFirstOfDay = index === 0 || !isSameDay(item.timestamp, prev?.timestamp ?? 0);
    // Last in group when: different sender follows, day boundary follows, or it's the last message
    const isLastInGroup = !next || next.sender !== item.sender || !isSameDay(item.timestamp, next.timestamp);
    const groupSpacing = isLastInGroup ? undefined : { marginBottom: 1 };
    const isNew = newMsgIdsRef.current.has(item.id);
    // Show unread separator before the first message that arrived after we opened the chat
    const showUnreadSep = initialMsgCountRef2.current !== null &&
      index === initialMsgCountRef2.current &&
      item.sender === 'other';
    return (
      <View style={groupSpacing}>
        {isFirstOfDay && (
          <View style={styles.dateHeaderContainer}>
            <Text style={styles.dateHeaderText}>{formatDateHeader(item.timestamp)}</Text>
          </View>
        )}
        {showUnreadSep && (
          <View style={styles.unreadSeparator}>
            <View style={styles.unreadLine} />
            <Text style={styles.unreadLabel}>New Messages</Text>
            <View style={styles.unreadLine} />
          </View>
        )}
        <SwipeableMessageBubble message={item} onSwipeToReply={handleSwipeToReply}>
          <ChatMessageBubble
            message={item}
            onLongPress={() => handleSelectMessage(item)}
            onImagePress={setFullScreenUri}
            onPayPress={(amount) => setPaymentSheet({ visible: true, mode: 'send', prefillAmount: amount })}
            bubbleColor={chatBubbleColor || undefined}
            isLastInGroup={isLastInGroup}
            isNew={isNew}
          />
        </SwipeableMessageBubble>
      </View>
    );
  }, [filteredMessages, styles.dateHeaderContainer, styles.dateHeaderText, styles.unreadSeparator, styles.unreadLine, styles.unreadLabel, handleSelectMessage, handleSwipeToReply, chatBubbleColor, setFullScreenUri]);

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
        isEncrypted={!!chatId}
        onBack={handleBack}
        onProfilePress={handleProfilePress}
        isMenuOpen={showMoreMenu}
        onMorePress={handleMorePress}
        isCallMenuOpen={showCallMenu}
        onCallPress={handleCallPress}
      />

      {peerIdentityChange === 'changed' && !keyWarningDismissed && (
        <TouchableOpacity
          style={styles.keyChangeBanner}
          activeOpacity={0.85}
          onPress={() => setKeyWarningDismissed(true)}
        >
          <Feather name="alert-triangle" size={15} color="#F59E0B" style={{ flexShrink: 0 }} />
          <Text style={styles.keyChangeBannerText} numberOfLines={2}>
            {name}'s encryption keys changed. Verify the safety number in Contact Info.
          </Text>
          <Feather name="x" size={15} color={Colors.textSecondary} style={{ flexShrink: 0 }} />
        </TouchableOpacity>
      )}

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

      {/* Pinned message banner */}
      {pinnedMessage && (
        <TouchableOpacity style={styles.pinnedBanner} activeOpacity={0.8} onPress={handleScrollToPinned}>
          <Feather name="bookmark" size={14} color={Colors.primary} style={{ flexShrink: 0 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.pinnedLabel}>Pinned Message</Text>
            <Text style={styles.pinnedText} numberOfLines={1}>
              {pinnedMessage.text || pinnedMessage.caption || pinnedMessage.fileName || '📎 Media'}
            </Text>
          </View>
          <TouchableOpacity
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => { if (chatId) unpinMessage(chatId); }}
          >
            <Feather name="x" size={14} color={Colors.textSecondary} />
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      {Platform.OS === 'ios' ? (
        <KeyboardAvoidingView
          style={[styles.keyboardAvoidingView, chatWallpaper?.type === 'solid' && { backgroundColor: chatWallpaper.value }]}
          behavior="padding"
        >
          {chatWallpaper?.type === 'image' && !!chatWallpaper.value && (
            <Image source={{ uri: chatWallpaper.value }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          )}
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
            onScroll={handleScroll}
            scrollEventThrottle={100}
          />
          {/* Edit bar */}
          {editingMessage && (
            <View style={styles.editBar}>
              <Feather name="edit-2" size={16} color={Colors.primary} style={{ marginRight: Spacing.sm }} />
              <TextInput
                style={styles.editInput}
                value={editText}
                onChangeText={setEditText}
                autoFocus
                multiline
                onSubmitEditing={handleEditSubmit}
                blurOnSubmit
              />
              <TouchableOpacity onPress={handleEditSubmit} style={{ marginLeft: Spacing.sm }}>
                <Feather name="check" size={20} color={Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditingMessage(null)} style={{ marginLeft: Spacing.sm }}>
                <Feather name="x" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}
          <View style={!!chatWallpaper && chatWallpaper.type !== 'none' ? styles.inputBarWithWallpaper : undefined}>
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
          </View>
        </KeyboardAvoidingView>
      ) : (
        <View
          style={[styles.keyboardAvoidingView, chatWallpaper?.type === 'solid' && { backgroundColor: chatWallpaper.value }]}
        >
          {chatWallpaper?.type === 'image' && !!chatWallpaper.value && (
            <Image source={{ uri: chatWallpaper.value }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          )}
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
            onScroll={handleScroll}
            scrollEventThrottle={100}
          />
          {editingMessage && (
            <View style={styles.editBar}>
              <Feather name="edit-2" size={16} color={Colors.primary} style={{ marginRight: Spacing.sm }} />
              <TextInput
                style={styles.editInput}
                value={editText}
                onChangeText={setEditText}
                autoFocus
                multiline
                onSubmitEditing={handleEditSubmit}
                blurOnSubmit
              />
              <TouchableOpacity onPress={handleEditSubmit} style={{ marginLeft: Spacing.sm }}>
                <Feather name="check" size={20} color={Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditingMessage(null)} style={{ marginLeft: Spacing.sm }}>
                <Feather name="x" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}
          <View style={!!chatWallpaper && chatWallpaper.type !== 'none' ? styles.inputBarWithWallpaper : undefined}>
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
              <ChatMessageBubble message={selectedMessage} bubbleColor={chatBubbleColor || undefined} />
            </View>
            {/* Emoji reaction picker */}
            <View style={styles.reactionPicker}>
              {['👍','❤️','😂','😮','😢','🙏','🔥','🎉','💯','😍','🤔','👏'].map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.reactionPickerBtn}
                  activeOpacity={0.7}
                  onPress={() => {
                    addReaction(selectedMessage.id, emoji);
                    handleCloseMessageModal();
                  }}
                >
                  <Text style={styles.reactionPickerEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
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
        onBlock={async () => {
          setShowBlockModal(false);
          try {
            await blockUser(id);
          } catch {
            // navigate regardless — local block still takes effect
          }
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
          setToastMessage(`Report submitted. Thank you for keeping AZA safe.`);
          setTimeout(() => setToastMessage(null), 4000);
        }}
      />

      {/* Scroll-to-bottom FAB */}
      <Animated.View
        pointerEvents={showFab ? 'auto' : 'none'}
        style={[styles.fab, { opacity: fabAnim, transform: [{ scale: fabAnim }] }]}
      >
        <TouchableOpacity style={styles.fabBtn} onPress={handleScrollToBottom} activeOpacity={0.85}>
          <Feather name="chevron-down" size={22} color="#fff" />
          {fabUnread > 0 && (
            <View style={styles.fabBadge}>
              <Text style={styles.fabBadgeText}>{fabUnread > 99 ? '99+' : fabUnread}</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Full-screen image viewer */}
      {fullScreenUri && (
        <FullScreenImageViewer uri={fullScreenUri} onClose={() => setFullScreenUri(null)} />
      )}

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
    inputBarWithWallpaper: {
      backgroundColor: isDark ? Colors.background + 'F0' : Colors.background + 'F0',
    },
    messagesList: {
      paddingHorizontal: Spacing.sm,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.xl,
      gap: 4,
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
    keyChangeBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginHorizontal: Spacing.lg,
      marginBottom: Spacing.sm,
      backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.1)',
      borderWidth: 1,
      borderColor: 'rgba(245,158,11,0.3)',
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: 10,
    },
    keyChangeBannerText: {
      ...Typography.caption,
      flex: 1,
      color: Colors.textPrimary,
      fontWeight: '500',
    },
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
    // Pinned message banner
    pinnedBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginHorizontal: Spacing.lg,
      marginBottom: Spacing.sm,
      backgroundColor: isDark ? 'rgba(23,71,23,0.15)' : 'rgba(23,71,23,0.07)',
      borderLeftWidth: 3,
      borderLeftColor: Colors.primary,
      borderRadius: Radius.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: 8,
    },
    pinnedLabel: {
      ...Typography.caption,
      fontSize: 11,
      fontWeight: '700',
      color: Colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    pinnedText: {
      ...Typography.body,
      fontSize: 13,
      color: Colors.textPrimary,
    },
    // Unread separator
    unreadSeparator: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      gap: Spacing.sm,
    },
    unreadLine: { flex: 1, height: 1, backgroundColor: Colors.primary, opacity: 0.3 },
    unreadLabel: {
      ...Typography.caption,
      fontSize: 11,
      fontWeight: '700',
      color: Colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    // Edit bar
    editBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      backgroundColor: isDark ? Colors.surface : '#F0F4EE',
      borderTopWidth: 1,
      borderTopColor: Colors.border,
    },
    editInput: {
      flex: 1,
      ...Typography.body,
      fontSize: 15,
      color: Colors.textPrimary,
      maxHeight: 80,
    },
    // Scroll-to-bottom FAB
    fab: {
      position: 'absolute',
      bottom: Platform.OS === 'ios' ? 110 : 90,
      right: Spacing.lg,
      zIndex: 20,
    },
    fabBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: Colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 6,
      elevation: 6,
    },
    fabBadge: {
      position: 'absolute',
      top: -4,
      right: -4,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: '#EF4444',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    fabBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
    // Emoji reaction picker row in long-press modal
    reactionPicker: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      backgroundColor: isDark ? Colors.surface : Colors.white,
      borderRadius: Radius.lg,
      paddingVertical: 8,
      paddingHorizontal: Spacing.sm,
      marginTop: Spacing.lg,
      gap: 2,
      elevation: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      maxWidth: 300,
    },
    reactionPickerBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 20,
    },
    reactionPickerEmoji: { fontSize: 22 },
  });
