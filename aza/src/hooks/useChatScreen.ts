import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  Alert, FlatList, Animated, DeviceEventEmitter,
  NativeScrollEvent, NativeSyntheticEvent,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Notifications from 'expo-notifications';
import * as ScreenCapture from 'expo-screen-capture';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAppTheme } from '../theme';
import { useChat } from './useChat';
import { useCallStore } from '../store/callStore';
import { usePresenceStore } from '../store/presenceStore';
import { useStarredMessagesStore } from '../store/starredMessagesStore';
import { useChatThemeStore } from '../store/chatThemeStore';
import { useChatStore } from '../store/chatStore';
import { usePinnedMessageStore } from '../store/pinnedMessageStore';
import { useReactionStore } from '../store/reactionStore';
import { useChatLockStore } from '../store/chatLockStore';
import { useScheduledMessagesStore } from '../store/scheduledMessagesStore';
import { uploadChatMedia, blockUser, notifyChatScreenshot, getUserPresence } from '../services/api';
import { useDraftStore } from '../store/draftStore';
import { useMuteDurationStore } from '../store/muteDurationStore';
import { useMediaAutoSaveStore } from '../store/mediaAutoSaveStore';
import { useSettledRequestsStore } from '../store/settledRequestsStore';
import {
  Message, Contact, ReplyInfo, MoreAction, MenuAnchor, AttachmentAnchor,
  isSameDay, formatTime, calculateStorageAsync,
} from '../components/chat/chatTypes';

export function useChatScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.background === '#121212';
  const route = useRoute<RouteProp<RootStackParamList, 'ChatScreen'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'ChatScreen'>>();
  const { id, name, avatar, payIdentifier, quickReply } = route.params;
  const online = usePresenceStore((s) => s.isOnline(id));
  const lastSeenTs = usePresenceStore((s) => s.getLastSeen(id));

  // Seed presence from the server on open — live WS events only cover
  // transitions that happen while we're connected, so without this the
  // header has no "last seen" for users who went offline before app launch.
  useEffect(() => {
    let mounted = true;
    getUserPresence(id)
      .then((res) => {
        const p = res.data?.data ?? res.data;
        if (!mounted || !p) return;
        const ts = p.lastSeenAt ? new Date(p.lastSeenAt).getTime() : null;
        usePresenceStore.getState().syncFromServer(id, p.status, ts);
      })
      .catch(() => {
        // Presence is best-effort; the header just shows nothing.
      });
    return () => {
      mounted = false;
    };
  }, [id]);

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

  const chats = useChatStore(s => s.chats);
  const storeMuteChat = useChatStore(s => s.muteChat);
  const clearChatMessages = useChatStore(s => s.clearChatMessages);
  const isMuted = chatId ? (chats[chatId]?.isMuted ?? false) : false;
  const disappearingTtl = chatId ? (chats[chatId]?.disappearingTtlSeconds ?? 0) : 0;
  const lastScreenshot = useChatStore(s => chatId ? s.lastScreenshotByChatId[chatId] : undefined);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const lastScreenshotTsRef = useRef<number | undefined>(lastScreenshot?.ts);
  useEffect(() => {
    if (!lastScreenshot) return;
    if (lastScreenshot.ts === lastScreenshotTsRef.current) return;
    lastScreenshotTsRef.current = lastScreenshot.ts;
    const notice = `${lastScreenshot.senderName} took a screenshot 📸`;
    setToastMessage(notice);
    setTimeout(() => setToastMessage(null), 4000);
    setLocalOnlyMessages(prev => [...prev, {
      id: `system_screenshot_${lastScreenshot.ts}`,
      text: notice,
      sender: 'other',
      time: new Date(lastScreenshot.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: lastScreenshot.ts,
      isSystem: true,
    }]);
  }, [lastScreenshot]);

  useEffect(() => {
    if (!chatId || !disappearingTtl) return;
    const sub = ScreenCapture.addScreenshotListener(() => {
      notifyChatScreenshot(chatId).catch(() => {});
    });
    return () => sub.remove();
  }, [chatId, disappearingTtl]);

  const getDraft = useDraftStore(s => s.getDraft);
  const saveDraft = useDraftStore(s => s.setDraft);
  const clearDraft = useDraftStore(s => s.clearDraft);

  const getMutedUntil = useMuteDurationStore(s => s.getMutedUntil);
  const setMutedUntil = useMuteDurationStore(s => s.setMutedUntil);
  const clearMutedUntil = useMuteDurationStore(s => s.clearMutedUntil);
  const isEffectiveMuted = useMuteDurationStore(s => s.isEffectiveMuted);
  const effectiveMuted = chatId ? isEffectiveMuted(chatId, isMuted) : isMuted;
  const mutedUntil = chatId ? getMutedUntil(chatId) : null;

  useEffect(() => {
    if (!mutedUntil || !chatId) return;
    const remaining = mutedUntil - Date.now();
    if (remaining <= 0) {
      storeMuteChat(chatId, false).catch(() => {});
      clearMutedUntil(chatId);
      return;
    }
    const timer = setTimeout(() => {
      storeMuteChat(chatId, false).catch(() => {});
      clearMutedUntil(chatId);
    }, Math.min(remaining, 2_147_483_647));
    return () => clearTimeout(timer);
  }, [mutedUntil, chatId]);

  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!chatId) return;
    const draft = getDraft(chatId);
    if (draft) setMessage(draft);
  }, [chatId]);

  useEffect(() => {
    if (!chatId) return;
    const timer = setTimeout(() => {
      if (message.trim()) saveDraft(chatId, message);
      else clearDraft(chatId);
    }, 400);
    return () => clearTimeout(timer);
  }, [message, chatId]);

  const [localOnlyMessages, setLocalOnlyMessages] = useState<Message[]>([]);
  const [deletedMsgIds, setDeletedMsgIds] = useState<Set<string>>(new Set());
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<MenuAnchor | null>(null);
  const [showCallMenu, setShowCallMenu] = useState(false);
  const [callMenuAnchor, setCallMenuAnchor] = useState<MenuAnchor | null>(null);
  const [showAttachment, setShowAttachment] = useState(false);
  const [attachmentAnchor, setAttachmentAnchor] = useState<AttachmentAnchor | null>(null);
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [replyTo, setReplyTo] = useState<ReplyInfo | null>(null);

  const loadStarred = useStarredMessagesStore(s => s.load);
  const starredEntries = useStarredMessagesStore(s => s.entries);
  const starLoadedRef = useRef(false);
  useEffect(() => {
    if (!starLoadedRef.current) {
      starLoadedRef.current = true;
      loadStarred();
    }
  }, [loadStarred]);

  const loadTheme = useChatThemeStore(s => s.load);
  const getBubbleColor = useChatThemeStore(s => s.getBubbleColor);
  const getWallpaper = useChatThemeStore(s => s.getWallpaper);
  const getFontSize = useChatThemeStore(s => s.getFontSize);
  const getPattern = useChatThemeStore(s => s.getPattern);
  const themeLoadedRef = useRef(false);
  useEffect(() => {
    if (!themeLoadedRef.current) {
      themeLoadedRef.current = true;
      loadTheme();
    }
  }, [loadTheme]);
  const chatBubbleColor = chatId ? getBubbleColor(chatId) : '';
  const chatWallpaper = chatId ? getWallpaper(chatId) : null;
  const hasWallpaper = !!(chatWallpaper && chatWallpaper.type !== 'none');
  const chatFontSize = chatId ? getFontSize(chatId) : 'medium' as const;
  const chatPattern = chatId ? getPattern(chatId) : null;

  const pinMessage = usePinnedMessageStore(s => s.pin);
  const unpinMessage = usePinnedMessageStore(s => s.unpin);
  const unpinAll = usePinnedMessageStore(s => s.unpinAll);
  const isPinned = usePinnedMessageStore(s => s.isPinned);
  const getPinned = usePinnedMessageStore(s => s.getPinned);
  const pinnedMessages = chatId ? getPinned(chatId) : [];
  const [pinnedIndex, setPinnedIndex] = useState(0);
  useEffect(() => {
    if (pinnedMessages.length === 0) setPinnedIndex(0);
    else if (pinnedIndex >= pinnedMessages.length) setPinnedIndex(pinnedMessages.length - 1);
  }, [pinnedMessages.length]);
  const pinnedMessage = pinnedMessages[pinnedIndex] ?? null;

  const addReaction = useReactionStore(s => s.addReaction);

  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardMessage, setForwardMessage] = useState<Message | null>(null);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [keyWarningDismissed, setKeyWarningDismissed] = useState(false);
  const [paymentSheet, setPaymentSheet] = useState<{
    visible: boolean;
    mode: 'send' | 'request' | 'pay';
    prefillAmount?: number;
    /** Money-request transaction id — set when paying a request from its card. */
    requestId?: string;
    /** Chat message id of the request card being settled — keys legacy cards with no requestId. */
    settleMsgId?: string;
  }>({ visible: false, mode: 'send' });
  const [fullScreenUri, setFullScreenUri] = useState<string | null>(null);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState<string[]>([]);
  const [searchResultIndex, setSearchResultIndex] = useState(0);

  const lockChat = useChatLockStore(s => s.lock);
  const unlockChat = useChatLockStore(s => s.unlock);
  const isChatLockedInStore = useChatLockStore(s => chatId ? s.isLocked(chatId) : false);
  const [chatUnlockedThisSession, setChatUnlockedThisSession] = useState(false);
  const showChatLock = isChatLockedInStore && !chatUnlockedThisSession;

  const scheduleMessage = useScheduledMessagesStore(s => s.schedule);
  const removeDue = useScheduledMessagesStore(s => s.remove);
  const getDueMessages = useScheduledMessagesStore(s => s.getDue);

  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editText, setEditText] = useState('');

  const newMsgIdsRef = useRef(new Set<string>());
  const initialMsgCountRef2 = useRef<number | null>(null);

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

  const messages = useMemo<Message[]>(() => {
    // Drop payment-decline control messages — they only flip a request card's
    // status (via declinedRequestIds) and shouldn't render as bubbles.
    const combined = [...liveMessages, ...localOnlyMessages].filter(
      m => !(typeof m.text === 'string' && m.text.startsWith('{"__payment_decline":')),
    );
    const sorted = combined.sort((a, b) => a.timestamp - b.timestamp);
    const starredIds = new Set(starredEntries.map(e => e.messageId));
    return sorted.map(m => {
      if (deletedMsgIds.has(m.id)) return { ...m, deleted: true, text: '', uri: undefined };
      let msg: Message = starredIds.has(m.id) ? { ...m, isStarred: true } : m;
      if (!msg.type || msg.type === 'text') {
        const text = msg.text;
        if (typeof text === 'string' && text.startsWith('{"__gif":')) {
          try {
            const p = JSON.parse(text);
            if (p.__gif === true && typeof p.url === 'string') msg = { ...msg, type: 'image', uri: p.url };
          } catch {}
        } else if (typeof text === 'string' && text.startsWith('{"__location":')) {
          try {
            const p = JSON.parse(text);
            if (p.__location === true) {
              msg = { ...msg, type: 'location', latitude: p.lat as number, longitude: p.lng as number,
                ...(typeof p.name === 'string' ? { locationName: p.name } : {}) };
            }
          } catch {}
        } else if (typeof text === 'string' && text.startsWith('{"__sticker":')) {
          try {
            const p = JSON.parse(text);
            if (p.__sticker === true && typeof p.url === 'string') msg = { ...msg, type: 'image', uri: p.url };
          } catch {}
        } else if (typeof text === 'string' && text.startsWith('{"__contact":')) {
          try {
            const p = JSON.parse(text);
            if (p.__contact === true) {
              msg = { ...msg, type: 'contact',
                contactCardName: typeof p.name === 'string' ? p.name : undefined,
                contactCardAvatar: typeof p.avatar === 'string' ? p.avatar : undefined,
                contactCardHandle: typeof p.handle === 'string' ? p.handle : undefined };
            }
          } catch {}
        } else if (typeof text === 'string' && text.startsWith('{"__poll":')) {
          try {
            const p = JSON.parse(text);
            if (p.__poll === true) {
              msg = { ...msg, type: 'poll',
                pollQuestion: typeof p.question === 'string' ? p.question : undefined,
                pollOptions: Array.isArray(p.options) ? p.options as string[] : undefined };
            }
          } catch {}
        }
      }
      return msg;
    });
  }, [liveMessages, localOnlyMessages, starredEntries, deletedMsgIds]);

  // Money requests settled in this chat. Chat messages are E2EE and immutable,
  // so paying sends a receipt carrying paysRequestId (or paysMsgId for legacy
  // cards keyed by the request message's id) and declining sends a control
  // message; request cards look themselves up here to flip from "Pay" to a
  // Paid/Declined badge. Locally-settled ids are unioned in as a backstop for
  // receipts that failed to send — the server already settled the request.
  const localPaidIds = useSettledRequestsStore(s => s.paidIds);
  const localDeclinedIds = useSettledRequestsStore(s => s.declinedIds);
  const { paidRequestIds, declinedRequestIds } = useMemo(() => {
    const paid = new Set<string>(localPaidIds);
    const declined = new Set<string>(localDeclinedIds);
    for (const m of liveMessages) {
      const text = m.text;
      if (typeof text !== 'string') continue;
      if (text.startsWith('{"__payment":')) {
        try {
          const p = JSON.parse(text);
          if (p.__payment === true) {
            if (typeof p.paysRequestId === 'string') paid.add(p.paysRequestId);
            if (typeof p.paysMsgId === 'string') paid.add(p.paysMsgId);
          }
        } catch {}
      } else if (text.startsWith('{"__payment_decline":')) {
        try {
          const p = JSON.parse(text);
          if (p.__payment_decline === true) {
            if (typeof p.requestId === 'string') declined.add(p.requestId);
            if (typeof p.messageId === 'string') declined.add(p.messageId);
          }
        } catch {}
      }
    }
    return { paidRequestIds: paid, declinedRequestIds: declined };
  }, [liveMessages, localPaidIds, localDeclinedIds]);

  const isAutoSaveEnabled = useMediaAutoSaveStore(s => chatId ? s.isEnabled(chatId) : false);
  const autoSavedIdsRef = useRef(new Set<string>());
  useEffect(() => {
    if (!isAutoSaveEnabled) return;
    messages.forEach(m => {
      if (m.sender !== 'other') return;
      if ((m.type !== 'image' && m.type !== 'video') || !m.uri) return;
      if (autoSavedIdsRef.current.has(m.id)) return;
      autoSavedIdsRef.current.add(m.id);
      MediaLibrary.getPermissionsAsync().then(perm => {
        if (!perm.granted) return MediaLibrary.requestPermissionsAsync();
        return perm;
      }).then(perm => {
        if (perm.granted) MediaLibrary.saveToLibraryAsync(m.uri!).catch(() => {});
      }).catch(() => {});
    });
  }, [messages, isAutoSaveEnabled]);

  useEffect(() => {
    if (initialMsgCountRef2.current === null && messages.length > 0) {
      initialMsgCountRef2.current = messages.length;
    }
  }, [messages.length]);

  useEffect(() => {
    if (!chatId) return;
    const unsub = navigation.addListener('focus', () => { markRead().catch(() => {}); });
    markRead().catch(() => {});
    return unsub;
  }, [navigation, chatId, markRead]);

  const prevMsgCountRef = useRef(messages.length);
  useEffect(() => {
    if (messages.length > prevMsgCountRef.current) {
      const newOnes = messages.slice(prevMsgCountRef.current);
      newOnes.forEach(m => newMsgIdsRef.current.add(m.id));
      if (showFab) {
        const otherCount = newOnes.filter(m => m.sender === 'other').length;
        if (otherCount > 0) setFabUnread(n => n + otherCount);
      } else {
        flatListRef.current?.scrollToEnd({ animated: true });
      }
    }
    prevMsgCountRef.current = messages.length;
  }, [messages.length, showFab]);

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
    return () => { subscription.remove(); clearMediaSub.remove(); };
  }, [sendMedia, chatId]);

  useEffect(() => {
    const forwardedMessage = route.params?.forwardedMessage;
    if (forwardedMessage) {
      setLocalOnlyMessages(prev => {
        if (prev.some(m => m.id === forwardedMessage.id)) return prev;
        return [...prev, forwardedMessage];
      });
      navigation.setParams({ forwardedMessage: undefined } as any);
      if (forwardedMessage.text) sendText(forwardedMessage.text).catch(() => {});
    }
  }, [route.params?.forwardedMessage, navigation, sendText]);

  useEffect(() => {
    if (!quickReply) return;
    const text = quickReply.trim();
    if (!text) return;
    navigation.setParams({ quickReply: undefined } as any);
    sendText(text).catch(() => {});
  }, [quickReply, navigation, sendText]);

  // Listen for broadcast_send events — send the text if this chat's peer is in the contactIds list
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      'broadcast_send',
      (payload: { contactIds: string[]; text: string }) => {
        if (!payload?.contactIds || !payload?.text) return;
        if (payload.contactIds.includes(id)) {
          sendText(payload.text).catch(() => {});
        }
      },
    );
    return () => sub.remove();
  }, [id, sendText]);

  useEffect(() => {
    if (!chatId) return;
    const interval = setInterval(() => {
      const due = getDueMessages(chatId);
      due.forEach(m => { sendText(m.text).catch(() => {}); removeDue(m.id); });
    }, 10_000);
    return () => clearInterval(interval);
  }, [chatId, getDueMessages, sendText, removeDue]);

  const handleBiometricUnlock = useCallback(async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Unlock chat with ${name}`,
        fallbackLabel: 'Use Passcode',
      });
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setChatUnlockedThisSession(true);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      }
    } catch {
      setChatUnlockedThisSession(true);
    }
  }, [name]);

  const filteredMessages = useMemo(
    () => searchQuery.trim()
      ? messages.filter(m => m.text.toLowerCase().includes(searchQuery.toLowerCase()))
      : messages,
    [messages, searchQuery],
  );

  const handleBack = useCallback(() => navigation.goBack(), [navigation]);

  const handleProfilePress = useCallback(async () => {
    const mediaCount = messages.filter(m => m.type === 'image' || m.type === 'video' || m.type === 'document').length;
    const storageStats = await calculateStorageAsync(messages);
    navigation.navigate('ChatInfoScreen', {
      id: chatId ?? id, name,
      username: name.toLowerCase().replace(/\s+/g, '_'),
      avatar, mediaCount, storageStats,
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

  const handleSelectMessage = useCallback((msg: Message) => {
    if (selectMode) {
      setSelectedMsgIds((ids) => ids.includes(msg.id) ? ids.filter((i) => i !== msg.id) : [...ids, msg.id]);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setSelectedMessage(msg);
  }, [selectMode]);

  const handleEnterSelectMode = useCallback((msgId: string) => {
    setSelectMode(true);
    setSelectedMsgIds([msgId]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, []);

  const handleExitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedMsgIds([]);
  }, []);

  const handleBulkDelete = useCallback(() => {
    Alert.alert(
      'Delete Messages',
      `Delete ${selectedMsgIds.length} message${selectedMsgIds.length > 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => {
          setLocalOnlyMessages((prev) => prev.filter((m) => !selectedMsgIds.includes(m.id)));
          selectedMsgIds.forEach((id) => deleteMessageRemote(id).catch(() => {}));
          handleExitSelectMode();
        }},
      ],
    );
  }, [selectedMsgIds, deleteMessageRemote, handleExitSelectMode]);

  const handleBulkStar = useCallback(() => {
    const { star } = useStarredMessagesStore.getState();
    const toStar = filteredMessages.filter((m) => selectedMsgIds.includes(m.id));
    toStar.forEach((m) => star(m, chatId ?? id, name).catch(() => {}));
    setToastMessage(`Starred ${toStar.length} message${toStar.length > 1 ? 's' : ''}`);
    setTimeout(() => setToastMessage(null), 3000);
    handleExitSelectMode();
  }, [selectedMsgIds, filteredMessages, chatId, id, name, handleExitSelectMode]);

  const handleBulkForward = useCallback(() => {
    const first = filteredMessages.find((m) => selectedMsgIds[0] && m.id === selectedMsgIds[0]);
    if (!first) return;
    setForwardMessage(first);
    setShowForwardModal(true);
    handleExitSelectMode();
  }, [selectedMsgIds, filteredMessages, handleExitSelectMode]);

  const handleSearchClose = useCallback(() => {
    setSearchActive(false);
    setSearchQuery('');
    setSearchResultIndex(0);
  }, []);

  useEffect(() => { setSearchResultIndex(0); }, [searchQuery]);

  const handleSearchNext = useCallback(() => {
    if (filteredMessages.length === 0) return;
    const next = (searchResultIndex + 1) % filteredMessages.length;
    setSearchResultIndex(next);
    flatListRef.current?.scrollToIndex({ index: next, animated: true, viewPosition: 0.5 });
  }, [searchResultIndex, filteredMessages.length]);

  const handleSearchPrev = useCallback(() => {
    if (filteredMessages.length === 0) return;
    const prev = (searchResultIndex - 1 + filteredMessages.length) % filteredMessages.length;
    setSearchResultIndex(prev);
    flatListRef.current?.scrollToIndex({ index: prev, animated: true, viewPosition: 0.5 });
  }, [searchResultIndex, filteredMessages.length]);

  const handleClearChat = useCallback(() => {
    setShowMoreMenu(false);
    Alert.alert(
      'Clear Chat',
      'All messages will be removed from your device. They can be reloaded from the server.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => {
          setLocalOnlyMessages([]);
          if (chatId) clearChatMessages(chatId);
        }},
      ],
    );
  }, [chatId, clearChatMessages]);

  const handleToggleMute = useCallback(async () => {
    if (!chatId) return;
    setShowMoreMenu(false);
    if (effectiveMuted) {
      await storeMuteChat(chatId, false);
      clearMutedUntil(chatId);
      return;
    }
    Alert.alert('Mute Notifications', 'For how long?', [
      { text: '1 hour',  onPress: () => { storeMuteChat(chatId, true).catch(() => {}); setMutedUntil(chatId, Date.now() + 3_600_000); } },
      { text: '8 hours', onPress: () => { storeMuteChat(chatId, true).catch(() => {}); setMutedUntil(chatId, Date.now() + 28_800_000); } },
      { text: '1 week',  onPress: () => { storeMuteChat(chatId, true).catch(() => {}); setMutedUntil(chatId, Date.now() + 604_800_000); } },
      { text: 'Always',  onPress: () => { storeMuteChat(chatId, true).catch(() => {}); } },
      { text: 'Cancel',  style: 'cancel' },
    ]);
  }, [chatId, effectiveMuted, storeMuteChat, setMutedUntil, clearMutedUntil]);

  const handleOpenSearch = useCallback(() => {
    setShowMoreMenu(false);
    setSearchActive(true);
  }, []);

  const handleSwipeToReply = useCallback((msg: Message) => {
    setReplyTo({ id: msg.id, text: msg.text || msg.caption || msg.fileName || 'Media', sender: msg.sender });
  }, []);

  const handleCancelReply = useCallback(() => { setReplyTo(null); }, []);

  const handleSend = useCallback(() => {
    const text = message.trim();
    if (!text) return;
    setMessage('');
    if (chatId) clearDraft(chatId);
    setReplyTo(null);
    setTyping(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    sendText(text).catch(() => {});
  }, [message, sendText, setTyping, chatId, clearDraft]);

  const handleMessageChange = useCallback((next: string) => {
    setMessage(next);
    setTyping(next.length > 0);
  }, [setTyping]);

  const handleSendAudio = useCallback((uri: string, duration: number) => {
    const msgId = Date.now().toString();
    const newLocal: Message = {
      id: msgId, text: 'Voice message', sender: 'me',
      time: formatTime(), timestamp: Date.now(), status: 'sent',
      type: 'audio', uri, duration,
    };
    setLocalOnlyMessages(prev => [...prev, newLocal]);
    setReplyTo(null);
  }, []);

  const handleCopy = useCallback(async () => {
    if (!selectedMessage) return;
    await Clipboard.setStringAsync(selectedMessage.text);
    setSelectedMessage(null);
  }, [selectedMessage]);

  const handleDelete = useCallback(() => {
    if (!selectedMessage) return;
    const msg = selectedMessage;
    setSelectedMessage(null);
    Alert.alert(
      'Delete message',
      'Who do you want to delete this message for?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete for me',
          onPress: () => {
            setDeletedMsgIds(prev => new Set([...prev, msg.id]));
          },
        },
        {
          text: 'Delete for everyone',
          style: 'destructive',
          onPress: () => {
            setDeletedMsgIds(prev => new Set([...prev, msg.id]));
            deleteMessageRemote(msg.id).catch(() => {});
          },
        },
      ],
    );
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
        ...message, id: Date.now().toString(), sender: 'me',
        status: 'sent', timestamp: Date.now(), time: formatTime(), isForwarded: true,
      };
      navigation.push('ChatScreen', { id: contact.id, name: contact.name, avatar: contact.avatar, online: contact.online, forwardedMessage: newForwardedMessage });
    } else {
      setToastMessage(`Forwarded to ${contacts.length} contact${contacts.length > 1 ? 's' : ''}`);
      setTimeout(() => setToastMessage(null), 3000);
    }
  }, [navigation]);

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
          media: result.assets.map(a => ({ uri: a.uri, type: (a.type === 'video' ? 'video' : 'image') as 'image' | 'video' })),
          recipientName: name, chatId: id, source: 'gallery',
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
      navigation.navigate('ChatCamera', { recipientName: name, chatId: id });
    } finally {
      isPickingRef.current = false;
    }
  }, [navigation, name, id]);

  const handleShareLocation = useCallback(async () => {
    setShowAttachment(false);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required to share your location.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [geocode] = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude }).catch(() => []);
      const locationName = geocode
        ? [geocode.street, geocode.city, geocode.region].filter(Boolean).join(', ')
        : undefined;
      sendText(JSON.stringify({ __location: true, lat: loc.coords.latitude, lng: loc.coords.longitude, name: locationName ?? null })).catch(() => {});
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch {
      Alert.alert('Error', 'Could not get your location. Please try again.');
    }
  }, [sendText]);

  const handleShareContact = useCallback((contactName: string, contactAvatar: string, handle: string) => {
    sendText(JSON.stringify({ __contact: true, name: contactName, avatar: contactAvatar, handle })).catch(() => {});
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [sendText]);

  const handleCreatePoll = useCallback((question: string, options: string[]) => {
    sendText(JSON.stringify({ __poll: true, question, options })).catch(() => {});
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [sendText]);

  const handleSendSticker = useCallback((url: string) => {
    sendText(JSON.stringify({ __sticker: true, url })).catch(() => {});
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [sendText]);

  const handleSetReminder = useCallback((msg: Message) => {
    const preview = msg.text
      ? msg.text.length > 40 ? msg.text.slice(0, 40) + '…' : msg.text
      : 'Message';
    const scheduleNotification = async (delaySecs: number) => {
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission required', 'Enable notifications to use reminders.');
          return;
        }
        await Notifications.scheduleNotificationAsync({
          content: { title: `Reminder: ${name}`, body: preview, sound: true, data: { chatId, userId: id } },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: delaySecs, repeats: false },
        });
        setToastMessage('Reminder set');
        setTimeout(() => setToastMessage(null), 3000);
      } catch {
        Alert.alert('Error', 'Could not set reminder. Please try again.');
      }
    };
    Alert.alert(
      'Remind me about this', `"${preview}"`,
      [
        { text: 'In 30 minutes', onPress: () => scheduleNotification(30 * 60) },
        { text: 'In 1 hour',     onPress: () => scheduleNotification(60 * 60) },
        { text: 'In 3 hours',    onPress: () => scheduleNotification(3 * 60 * 60) },
        { text: 'Tomorrow 9 AM', onPress: () => {
          const d = new Date();
          d.setDate(d.getDate() + 1);
          d.setHours(9, 0, 0, 0);
          scheduleNotification(Math.max(60, Math.floor((d.getTime() - Date.now()) / 1000)));
        }},
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }, [name, chatId, id]);

  const handleScheduleSend = useCallback((delaySecs: number) => {
    const text = message.trim();
    if (!text || !chatId) return;
    Alert.alert('Schedule Message', 'When should this message be sent?', [
      { text: 'In 5 minutes', onPress: () => { scheduleMessage({ id: Date.now().toString(), chatId, text, scheduledAt: Date.now() + 5 * 60_000 }); setMessage(''); setToastMessage('Scheduled for 5 minutes'); setTimeout(() => setToastMessage(null), 3000); } },
      { text: 'In 1 hour', onPress: () => { scheduleMessage({ id: Date.now().toString(), chatId, text, scheduledAt: Date.now() + 60 * 60_000 }); setMessage(''); setToastMessage('Scheduled for 1 hour'); setTimeout(() => setToastMessage(null), 3000); } },
      { text: 'Tomorrow morning', onPress: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); scheduleMessage({ id: Date.now().toString(), chatId, text, scheduledAt: d.getTime() }); setMessage(''); setToastMessage('Scheduled for tomorrow 9:00 AM'); setTimeout(() => setToastMessage(null), 3000); } },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [message, chatId, scheduleMessage]);

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
          id: Date.now().toString(), text: asset.name, sender: 'me',
          time: formatTime(), timestamp: Date.now(), status: 'sent',
          type: 'document', uri: asset.uri, fileName: asset.name,
          ...(asset.mimeType ? { mimeType: asset.mimeType } : {}),
          ...(asset.size ? { fileSize: asset.size } : {}),
        });
      }
    } finally {
      isPickingRef.current = false;
    }
  }, [addMediaMessage]);

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
      ],
    );
  }, [chatId, disappearingTtl, handleCloseMoreMenu, setDisappearingTtl]);

  const handleToggleChatLock = useCallback(() => {
    if (!chatId) return;
    handleCloseMoreMenu();
    if (isChatLockedInStore) {
      unlockChat(chatId);
      setChatUnlockedThisSession(false);
      setToastMessage('Chat lock removed');
    } else {
      lockChat(chatId);
      setChatUnlockedThisSession(false);
      setToastMessage('Chat locked');
    }
    setTimeout(() => setToastMessage(null), 3000);
  }, [chatId, isChatLockedInStore, lockChat, unlockChat, handleCloseMoreMenu]);

  const handleExportChat = useCallback(async () => {
    handleCloseMoreMenu();
    if (!messages.length) { Alert.alert('No messages to export'); return; }
    const lines = messages.map(m => {
      const sender = m.sender === 'me' ? 'You' : name;
      const d = new Date(m.timestamp);
      const ts = d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
        d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const content = m.text || m.caption || m.fileName || `[${m.type ?? 'media'}]`;
      return `[${ts}] ${sender}: ${content}`;
    });
    const text = `Chat with ${name}\n${'─'.repeat(40)}\n${lines.join('\n')}`;
    const fileName = `chat_${name.replace(/\s+/g, '_')}_${Date.now()}.txt`;
    const path = `${FileSystem.cacheDirectory}${fileName}`;
    try {
      await FileSystem.writeAsStringAsync(path, text, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(path, { mimeType: 'text/plain', dialogTitle: `Chat with ${name}` });
    } catch {
      Alert.alert('Export failed', 'Could not export this chat.');
    } finally {
      FileSystem.deleteAsync(path, { idempotent: true }).catch(() => {});
    }
  }, [messages, name, handleCloseMoreMenu]);

  const moreMenuActions = useMemo<MoreAction[]>(() => [
    { icon: 'search', label: 'Search in Conversation', onPress: handleOpenSearch },
    { icon: effectiveMuted ? 'bell' : 'bell-off', label: effectiveMuted ? 'Unmute Notifications' : 'Mute Notifications', onPress: handleToggleMute },
    { icon: 'clock', label: `Disappearing Messages${disappearingTtl ? ' ✓' : ''}`, onPress: handleDisappearingTimer },
    { icon: isChatLockedInStore ? 'unlock' : 'lock', label: isChatLockedInStore ? 'Remove Chat Lock' : 'Lock Chat', onPress: handleToggleChatLock },
    { icon: 'image', label: 'Shared Media', onPress: () => { handleCloseMoreMenu(); navigation.navigate('SharedMedia', { chatId: chatId ?? undefined, otherUserName: name }); } },
    { icon: 'share-2', label: 'Export Chat', onPress: handleExportChat },
    { icon: 'trash', label: 'Clear Chat', color: '#F59E0B', onPress: handleClearChat },
    { icon: 'slash', label: 'Block Contact', color: '#EF4444', onPress: () => { handleCloseMoreMenu(); setShowBlockModal(true); } },
    { icon: 'flag', label: 'Report', color: '#EF4444', onPress: () => { handleCloseMoreMenu(); setShowReportModal(true); } },
  ], [effectiveMuted, name, chatId, navigation, handleCloseMoreMenu, handleOpenSearch, handleToggleMute, handleClearChat, handleExportChat, disappearingTtl, handleDisappearingTimer, isChatLockedInStore, handleToggleChatLock]);

  const handleViewOnce = useCallback((messageId: string) => {
    setLocalOnlyMessages(prev =>
      prev.map(m => m.id === messageId ? { ...m, viewOnceSeen: true } : m)
    );
  }, []);

  const handleEditSubmit = useCallback(() => {
    if (!editingMessage || !editText.trim()) { setEditingMessage(null); return; }
    const updated: Message = { ...editingMessage, text: editText.trim(), isEdited: true };
    setLocalOnlyMessages(prev =>
      prev.some(m => m.id === editingMessage.id)
        ? prev.map(m => m.id === editingMessage.id ? updated : m)
        : prev,
    );
    setEditingMessage(null);
    setEditText('');
  }, [editingMessage, editText]);

  const handleScrollToPinned = useCallback(() => {
    if (!pinnedMessage) return;
    const idx = filteredMessages.findIndex(m => m.id === pinnedMessage.id);
    if (idx >= 0) flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
  }, [pinnedMessage, filteredMessages]);

  const handlePinnedNext = useCallback(() => {
    if (pinnedMessages.length <= 1) return;
    setPinnedIndex(i => (i + 1) % pinnedMessages.length);
  }, [pinnedMessages.length]);

  const handlePinnedPrev = useCallback(() => {
    if (pinnedMessages.length <= 1) return;
    setPinnedIndex(i => (i - 1 + pinnedMessages.length) % pinnedMessages.length);
  }, [pinnedMessages.length]);

  const messageActions = useMemo<MoreAction[]>(() => {
    const isCurrentlyStarred = selectedMessage ? starredEntries.some(e => e.messageId === selectedMessage.id) : false;
    const isCurrentlyPinned = selectedMessage && chatId ? isPinned(chatId, selectedMessage.id) : false;
    const canPin = chatId && selectedMessage && (pinnedMessages.length < 3 || isCurrentlyPinned);
    const canEdit = selectedMessage?.sender === 'me' && !selectedMessage?.deleted && selectedMessage?.type !== 'audio' && selectedMessage?.type !== 'image';
    const canSavePhoto = (selectedMessage?.type === 'image' || selectedMessage?.type === 'video') && !!selectedMessage?.uri;
    return [
      { icon: 'corner-up-left', label: 'Reply', onPress: () => { if (selectedMessage) { handleSwipeToReply(selectedMessage); } handleCloseMessageModal(); } },
      { icon: 'corner-up-right', label: 'Forward', onPress: handleOpenForward },
      { icon: 'copy', label: 'Copy', onPress: handleCopy },
      ...(canSavePhoto ? [{ icon: 'download', label: 'Save to Photos', onPress: async () => {
        handleCloseMessageModal();
        const perm = await MediaLibrary.requestPermissionsAsync();
        if (!perm.granted) { Alert.alert('Permission denied', 'Allow media access to save photos.'); return; }
        try {
          await MediaLibrary.saveToLibraryAsync(selectedMessage!.uri!);
          setToastMessage('Saved to Photos');
          setTimeout(() => setToastMessage(null), 3000);
        } catch { Alert.alert('Save failed'); }
      }}] : []),
      ...(canEdit ? [{ icon: 'edit-2', label: 'Edit', onPress: () => {
        if (!selectedMessage) return;
        setEditingMessage(selectedMessage);
        setEditText(selectedMessage.text ?? '');
        handleCloseMessageModal();
      }}] : []),
      ...(canPin ? [{ icon: 'bookmark', label: isCurrentlyPinned ? 'Unpin' : 'Pin', onPress: () => {
        if (!chatId || !selectedMessage) return;
        if (isCurrentlyPinned) unpinMessage(chatId, selectedMessage.id);
        else pinMessage(chatId, selectedMessage);
        handleCloseMessageModal();
      }}] : []),
      { icon: 'bell', label: 'Remind me', onPress: () => { handleCloseMessageModal(); if (selectedMessage) handleSetReminder(selectedMessage); } },
      { icon: 'info', label: 'Info', onPress: () => { handleCloseMessageModal(); if (selectedMessage) navigation.navigate('MessageInfo', { message: selectedMessage }); } },
      { icon: 'star', label: isCurrentlyStarred ? 'Unstar' : 'Star', onPress: handleStarMessage },
      { icon: 'check-square', label: 'Select', onPress: () => {
        if (!selectedMessage) return;
        handleCloseMessageModal();
        handleEnterSelectMode(selectedMessage.id);
      }},
      { icon: 'trash-2', label: 'Delete', color: '#EF4444', onPress: handleDelete },
    ];
  }, [handleCloseMessageModal, handleCopy, handleDelete, handleStarMessage, selectedMessage, handleSwipeToReply, handleOpenForward, starredEntries, navigation, chatId, pinnedMessages.length, pinMessage, unpinMessage, isPinned, handleEnterSelectMode, handleSetReminder, setToastMessage]);

  return {
    // Route params
    id, name, avatar, payIdentifier, navigation,
    // Chat core
    chatId, isOtherTyping, sendText, peerIdentityChange,
    // Messages
    messages, filteredMessages, paidRequestIds, declinedRequestIds,
    // Theme
    isDark, chatBubbleColor, chatWallpaper, hasWallpaper, chatFontSize, chatPattern,
    // Presence
    online, lastSeenTs,
    // Input
    message, replyTo,
    // Menu/modal state
    showMoreMenu, menuAnchor,
    showCallMenu, callMenuAnchor,
    showAttachment, attachmentAnchor,
    searchActive, searchQuery, setSearchQuery, searchResultIndex,
    showForwardModal, setShowForwardModal, forwardMessage,
    toastMessage, setToastMessage,
    showBlockModal, setShowBlockModal,
    showReportModal, setShowReportModal,
    keyWarningDismissed, setKeyWarningDismissed,
    paymentSheet, setPaymentSheet,
    fullScreenUri, setFullScreenUri,
    showGifPicker, setShowGifPicker,
    showContactPicker, setShowContactPicker,
    showPollCreator, setShowPollCreator,
    showStickerPicker, setShowStickerPicker,
    selectMode, selectedMsgIds,
    effectiveMuted, showChatLock, isChatLockedInStore,
    editingMessage, editText, setEditText,
    showFab, fabUnread, fabAnim,
    pinnedMessages, pinnedIndex, pinnedMessage,
    disappearingTtl, selectedMessage,
    // Refs
    flatListRef, newMsgIdsRef, initialMsgCountRef2,
    // Handlers
    handleBack, handleProfilePress, handleMorePress, handleCallPress,
    handleCloseMoreMenu, handleCloseCallMenu,
    handleAudioCall, handleVideoCall,
    handleAddPress, handleCloseAttachment, handleCloseMessageModal,
    handleSelectMessage, handleEnterSelectMode, handleExitSelectMode,
    handleBulkDelete, handleBulkStar, handleBulkForward,
    handleSearchClose, handleSearchNext, handleSearchPrev,
    handleToggleMute, handleOpenSearch,
    handleSwipeToReply, handleCancelReply,
    handleSend, handleMessageChange, handleSendAudio,
    handleViewOnce,
    handleForwardAction,
    handlePickPhoto, handleOpenCamera, handleShareLocation,
    handleShareContact, handleCreatePoll, handleSendSticker,
    handleSetReminder, handleScheduleSend, handlePickDocument,
    handleEditSubmit, handleScrollToPinned, handlePinnedNext, handlePinnedPrev,
    handleScroll, handleScrollToBottom, handleBiometricUnlock,
    // Computed action arrays
    messageActions, moreMenuActions,
    // Store actions needed in JSX
    addReaction, unpinMessage,
  };
}
