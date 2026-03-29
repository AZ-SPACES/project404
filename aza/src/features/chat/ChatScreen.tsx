import React, { useState, useMemo, useRef, useCallback, useEffect, memo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, TextInput,
  KeyboardAvoidingView, Platform, FlatList, StatusBar, Modal,
  Pressable, Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../theme';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------
export type MessageStatus = 'sent' | 'delivered' | 'read' | 'failed';

export interface Message {
  id: string;
  text: string;
  sender: 'me' | 'other';
  time: string;
  timestamp: number;
  status?: MessageStatus;
  replyTo?: string;
  type?: 'text' | 'image' | 'document';
  uri?: string;
  mimeType?: string;
  fileSize?: number;
  fileName?: string;
}

// ----------------------------------------------------------------------------
// Module-level constants (never recreated on render)
// ----------------------------------------------------------------------------
const AUTO_REPLIES = [
  'Okay, got it!',
  'Sure, no problem.',
  'Let me check and get back to you.',
  'Sounds good! 👍',
  'Alright, will do.',
] as const;

const ATTACHMENT_TILES = [
  { icon: 'image', label: 'Photos', color: '#6366F1' },
  { icon: 'camera', label: 'Camera', color: '#0EA5E9' },
  { icon: 'file-text', label: 'Document', color: '#F59E0B' },
] as const;

const MENU_WIDTH = 260;
const INITIAL_MESSAGES: Message[] = [
  { id: '1', text: "I'm supposed to send your money. I will send it tomorrow, 7pm.", sender: 'other', time: '9:30 AM', timestamp: Date.now() - 3600000, type: 'text' },
  { id: '2', text: 'Will be waiting.', sender: 'me', time: '9:35 AM', timestamp: Date.now() - 3000000, status: 'read', type: 'text' },
  { id: '3', text: 'Thanks.', sender: 'other', time: '9:40 AM', timestamp: Date.now() - 2400000, type: 'text' },
];

// ----------------------------------------------------------------------------
// Date helpers
// ----------------------------------------------------------------------------
const isSameDay = (d1: number, d2: number): boolean => {
  const a = new Date(d1);
  const b = new Date(d2);
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
};

const formatDateHeader = (timestamp: number): string => {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(timestamp, today.getTime())) return 'Today';
  if (isSameDay(timestamp, yesterday.getTime())) return 'Yesterday';
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatTime = (): string =>
  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// ----------------------------------------------------------------------------
// Document helpers (module-level, pure)
// ----------------------------------------------------------------------------
const getDocIcon = (mime?: string): { name: string; color: string } => {
  if (!mime) return { name: 'file', color: '#6B7280' };
  if (mime.includes('pdf')) return { name: 'file-text', color: '#EF4444' };
  if (mime.includes('word') || mime.includes('document')) return { name: 'file-text', color: '#2563EB' };
  if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv')) return { name: 'file', color: '#16A34A' };
  if (mime.includes('audio')) return { name: 'music', color: '#7C3AED' };
  if (mime.includes('video')) return { name: 'video', color: '#0EA5E9' };
  if (mime.includes('zip') || mime.includes('rar') || mime.includes('archive')) return { name: 'archive', color: '#F59E0B' };
  if (mime.includes('image')) return { name: 'image', color: '#6366F1' };
  return { name: 'file', color: '#6B7280' };
};

const formatBytes = (bytes?: number): string => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

// ----------------------------------------------------------------------------
// Chat Header
// ----------------------------------------------------------------------------
type MenuAnchor = { top: number; right: number };

type ChatHeaderProps = {
  name: string;
  avatar: string;
  online: boolean;
  onBack: () => void;
  isMenuOpen: boolean;
  onMorePress: (anchor: MenuAnchor) => void;
};

const ChatHeader = memo(function ChatHeader({ name, avatar, online, onBack, isMenuOpen, onMorePress }: ChatHeaderProps) {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.background === '#121212';
  const styles = useMemo(() => createHeaderStyles(Colors, isDark), [Colors, isDark]);
  const moreButtonRef = useRef<React.ElementRef<typeof TouchableOpacity>>(null);

  const handleMorePress = useCallback(() => {
    moreButtonRef.current?.measure((_x: number, _y: number, width: number, height: number, pageX: number, pageY: number) => {
      const screenWidth = Dimensions.get('window').width;
      onMorePress({ top: pageY + height + 6, right: screenWidth - pageX - width });
    });
  }, [onMorePress]);

  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.iconButton} onPress={onBack} activeOpacity={0.8}>
        <Feather name="chevron-left" size={24} color={Colors.textPrimary} />
      </TouchableOpacity>

      <View style={styles.profileInfo}>
        <Image source={{ uri: avatar }} style={styles.avatar} accessibilityLabel={name} />
        <View style={styles.nameContainer}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          {online && <Text style={styles.onlineText}>online</Text>}
        </View>
      </View>

      <View style={styles.rightActions}>
        <TouchableOpacity style={styles.iconButton} activeOpacity={0.8}>
          <Feather name="video" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          ref={moreButtonRef}
          style={[styles.iconButton, isMenuOpen && styles.iconButtonActive]}
          activeOpacity={0.8}
          onPress={handleMorePress}
        >
          <Feather name="more-horizontal" size={20} color={isMenuOpen ? Colors.primary : Colors.textPrimary} />
        </TouchableOpacity>
      </View>
    </View>
  );
});

// ----------------------------------------------------------------------------
// Chat More Menu Modal
// ----------------------------------------------------------------------------
type MoreAction = { icon: string; label: string; color?: string; onPress: () => void };

type ChatMoreModalProps = {
  visible: boolean;
  isDark: boolean;
  isMuted: boolean;
  contactName: string;
  anchor: MenuAnchor | null;
  onClose: () => void;
  actions: MoreAction[];
};

const ChatMoreModal = memo(function ChatMoreModal({ visible, isDark, anchor, onClose, actions }: ChatMoreModalProps) {
  const { colors: Colors } = useAppTheme();
  const styles = useMemo(() => createMoreModalStyles(Colors, isDark), [Colors, isDark]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <BlurView intensity={20} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      </Pressable>
      {anchor && (
        <View
          style={[styles.menuCard, { position: 'absolute', top: anchor.top, right: anchor.right, width: MENU_WIDTH }]}
          pointerEvents="box-none"
        >
          <View style={styles.caret} />
          <View style={styles.menuInner}>
            {actions.map((action, idx) => (
              <TouchableOpacity
                key={action.label}
                style={[styles.menuItem, idx < actions.length - 1 && styles.menuItemBorder]}
                onPress={action.onPress}
                activeOpacity={0.7}
              >
                <Feather name={action.icon as any} size={18} color={action.color ?? Colors.textPrimary} />
                <Text style={[styles.menuItemLabel, { color: action.color ?? Colors.textPrimary }]}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </Modal>
  );
});

// ----------------------------------------------------------------------------
// Chat Attachment Modal
// ----------------------------------------------------------------------------
type AttachmentAnchor = { top: number; left: number; buttonWidth: number };

type ChatAttachmentModalProps = {
  visible: boolean;
  isDark: boolean;
  anchor: AttachmentAnchor | null;
  onClose: () => void;
  onPhotos: () => void;
  onCamera: () => void;
  onDocument: () => void;
};

const ChatAttachmentModal = memo(function ChatAttachmentModal({
  visible, isDark, anchor, onClose, onPhotos, onCamera, onDocument,
}: ChatAttachmentModalProps) {
  const { colors: Colors } = useAppTheme();
  const styles = useMemo(() => createAttachmentModalStyles(Colors, isDark), [Colors, isDark]);
  const screenWidth = Dimensions.get('window').width;
  const CARD_WIDTH = Math.min(screenWidth - Spacing.lg * 2, 320);

  const handlers = useMemo(() => [onPhotos, onCamera, onDocument], [onPhotos, onCamera, onDocument]);

  const cardLeft = anchor
    ? Math.max(Spacing.lg, Math.min(anchor.left, screenWidth - CARD_WIDTH - Spacing.lg))
    : Spacing.lg;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <BlurView intensity={20} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      </Pressable>
      {anchor && (
        <View style={[styles.card, { position: 'absolute', top: anchor.top, left: cardLeft, width: CARD_WIDTH }]}>
          {ATTACHMENT_TILES.map((tile, idx) => (
            <TouchableOpacity key={tile.label} style={styles.tile} onPress={handlers[idx]} activeOpacity={0.8}>
              <View style={[styles.tileIcon, { backgroundColor: tile.color + '22' }]}>
                <Feather name={tile.icon as any} size={22} color={tile.color} />
              </View>
              <Text style={styles.tileLabel}>{tile.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </Modal>
  );
});

// ----------------------------------------------------------------------------
// Chat Message Bubble
// ----------------------------------------------------------------------------
const ChatMessageBubble = memo(function ChatMessageBubble({ message, onLongPress }: { message: Message; onLongPress?: () => void }) {
  const { colors: Colors } = useAppTheme();
  const styles = useMemo(() => createMessageStyles(Colors), [Colors]);
  const isMe = message.sender === 'me';
  const isImageType = message.type === 'image';
  const docIcon = getDocIcon(message.mimeType);

  const statusIcon = useMemo(() => {
    if (!isMe || !message.status) return null;
    const iconColor = isMe ? 'rgba(255,255,255,0.8)' : '#9CA3AF';
    if (message.status === 'sent') return <Feather name="check" size={12} color={iconColor} style={styles.statusIcon} />;
    if (message.status === 'delivered') return <Feather name="check" size={12} color="#FFF" style={styles.statusIcon} />;
    if (message.status === 'read') return <Feather name="check-circle" size={12} color="#4ADE80" style={styles.statusIcon} />;
    return null;
  }, [isMe, message.status, isImageType, styles.statusIcon]);

  const metaRow = (
    <View style={[styles.metaContainer, isImageType && styles.metaContainerOverlay]}>
      <Text style={[styles.timeText, isMe ? styles.timeTextMe : styles.timeTextOther, isImageType && styles.timeTextOverlay]}>
        {message.time}
      </Text>
      {statusIcon}
    </View>
  );

  return (
    <TouchableOpacity
      onLongPress={onLongPress}
      delayLongPress={250}
      activeOpacity={0.9}
      style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowOther]}
    >
      {isImageType && message.uri ? (
        <View style={[styles.imageBubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
          <Image source={{ uri: message.uri }} style={styles.imageContent} resizeMode="cover" accessibilityLabel="Sent image" />
          <View style={styles.imageOverlay}>{metaRow}</View>
        </View>
      ) : message.type === 'document' ? (
        <View style={[styles.bubble, styles.docBubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
          <View style={styles.docCard}>
            <View style={[styles.docIconBox, { backgroundColor: docIcon.color + '22' }]}>
              <Feather name={docIcon.name as any} size={22} color={docIcon.color} />
            </View>
            <View style={styles.docInfo}>
              <Text style={[styles.docName, isMe ? styles.textMe : styles.textOther]} numberOfLines={2}>
                {message.fileName ?? message.text}
              </Text>
              {!!message.fileSize && (
                <Text style={[styles.docSize, isMe ? styles.timeTextMe : styles.timeTextOther]}>
                  {formatBytes(message.fileSize)}
                </Text>
              )}
            </View>
          </View>
          {metaRow}
        </View>
      ) : (
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
          <Text style={[styles.text, isMe ? styles.textMe : styles.textOther]}>{message.text}</Text>
          {metaRow}
        </View>
      )}
    </TouchableOpacity>
  );
});

// ----------------------------------------------------------------------------
// Chat Typing Indicator
// ----------------------------------------------------------------------------
const ChatTypingIndicator = memo(function ChatTypingIndicator() {
  const { colors: Colors } = useAppTheme();
  const styles = useMemo(() => createMessageStyles(Colors), [Colors]);
  return (
    <View style={[styles.messageRow, styles.messageRowOther]}>
      <View style={[styles.bubble, styles.bubbleOther, { paddingVertical: 10, paddingHorizontal: 14 }]}>
        <Text style={[styles.text, styles.textOther, { fontStyle: 'italic', fontSize: 13, opacity: 0.7 }]}>
          typing...
        </Text>
      </View>
    </View>
  );
});

// ----------------------------------------------------------------------------
// Chat Input Area
// ----------------------------------------------------------------------------
type ChatInputAreaProps = {
  message: string;
  setMessage: (val: string) => void;
  onSend: () => void;
  onAddPress: (anchor: AttachmentAnchor) => void;
  isAddOpen: boolean;
};

const ChatInputArea = memo(function ChatInputArea({ message, setMessage, onSend, onAddPress, isAddOpen }: ChatInputAreaProps) {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.background === '#121212';
  const styles = useMemo(() => createInputStyles(Colors, isDark), [Colors, isDark]);
  const addButtonRef = useRef<React.ElementRef<typeof TouchableOpacity>>(null);

  const handleAddPress = useCallback(() => {
    addButtonRef.current?.measure((_x: number, _y: number, width: number, _height: number, _pageX: number, pageY: number) => {
      const CARD_HEIGHT_ESTIMATE = 130;
      onAddPress({ top: pageY - CARD_HEIGHT_ESTIMATE - 8, left: Spacing.lg, buttonWidth: width });
    });
  }, [onAddPress]);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        ref={addButtonRef}
        style={[styles.actionButton, isAddOpen && styles.actionButtonActive]}
        activeOpacity={0.8}
        onPress={handleAddPress}
      >
        <Feather name={isAddOpen ? 'x' : 'plus'} size={22} color={Colors.white} />
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
          accessibilityLabel="Message input"
        />
      </View>

      <TouchableOpacity style={styles.actionButton} activeOpacity={0.8} onPress={onSend}>
        <Feather name="send" size={20} color={Colors.white} style={styles.sendIcon} />
      </TouchableOpacity>
    </View>
  );
});

// ----------------------------------------------------------------------------
// Main Screen
// ----------------------------------------------------------------------------
export function ChatScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.background === '#121212';
  const styles = useMemo(() => createScreenStyles(Colors, isDark), [Colors, isDark]);
  const route = useRoute<RouteProp<RootStackParamList, 'ChatScreen'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'ChatScreen'>>();
  const { name, avatar, online } = route.params;

  const flatListRef = useRef<FlatList>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const isPickingRef = useRef(false);

  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<MenuAnchor | null>(null);
  const [showAttachment, setShowAttachment] = useState(false);
  const [attachmentAnchor, setAttachmentAnchor] = useState<AttachmentAnchor | null>(null);
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Cleanup all timers on unmount
  useEffect(() => () => { timersRef.current.forEach(clearTimeout); }, []);

  const scheduleTimer = useCallback((fn: () => void, delay: number) => {
    const id = setTimeout(fn, delay);
    timersRef.current.push(id);
    return id;
  }, []);

  // Scroll to bottom when message count changes (new message sent/received)
  const prevMsgCountRef = useRef(messages.length);
  useEffect(() => {
    if (messages.length !== prevMsgCountRef.current) {
      prevMsgCountRef.current = messages.length;
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages.length]);

  // Filtered messages — only recomputed when messages or searchQuery changes
  const filteredMessages = useMemo(
    () => searchQuery.trim()
      ? messages.filter(m => m.text.toLowerCase().includes(searchQuery.toLowerCase()))
      : messages,
    [messages, searchQuery],
  );

  // ----------------------------------------------------------------------------
  // Stable callbacks
  // ----------------------------------------------------------------------------
  const handleBack = useCallback(() => navigation.goBack(), [navigation]);

  const handleMorePress = useCallback((anchor: MenuAnchor) => {
    setMenuAnchor(anchor);
    setShowMoreMenu(true);
  }, []);

  const handleCloseMoreMenu = useCallback(() => setShowMoreMenu(false), []);

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

  // ----------------------------------------------------------------------------
  // Send
  // ----------------------------------------------------------------------------
  const handleSend = useCallback(() => {
    if (!message.trim()) return;
    const msgId = Date.now().toString();
    const msgText = message.trim();
    const msgTime = formatTime();
    const msgTimestamp = Date.now();

    setMessages(prev => [...prev, { id: msgId, text: msgText, sender: 'me', time: msgTime, timestamp: msgTimestamp, status: 'sent', type: 'text' }]);
    setMessage('');

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
  }, [message, scheduleTimer]);

  // ----------------------------------------------------------------------------
  // Message actions
  // ----------------------------------------------------------------------------
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

  // ----------------------------------------------------------------------------
  // Media pickers
  // ----------------------------------------------------------------------------
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
        allowsMultipleSelection: false,
        quality: 0.85,
      });
      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        if (!asset) return;
        addMediaMessage({ id: Date.now().toString(), text: asset.fileName ?? 'Photo', sender: 'me', time: formatTime(), timestamp: Date.now(), status: 'sent', type: 'image', uri: asset.uri });
      }
    } finally {
      isPickingRef.current = false;
    }
  }, [addMediaMessage]);

  const handleOpenCamera = useCallback(async () => {
    if (isPickingRef.current) return;
    isPickingRef.current = true;
    setShowAttachment(false);
    await new Promise<void>(resolve => setTimeout(resolve, 350));
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return;
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images', 'videos'] as ImagePicker.MediaType[],
        quality: 0.85,
      });
      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        if (!asset) return;
        addMediaMessage({ id: Date.now().toString(), text: asset.fileName ?? 'Camera photo', sender: 'me', time: formatTime(), timestamp: Date.now(), status: 'sent', type: 'image', uri: asset.uri });
      }
    } finally {
      isPickingRef.current = false;
    }
  }, [addMediaMessage]);

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

  // ----------------------------------------------------------------------------
  // More menu actions (memoized — only rebuilds when dependencies change)
  // ----------------------------------------------------------------------------
  const moreMenuActions = useMemo<MoreAction[]>(() => [
    { icon: 'user', label: 'View Profile', onPress: () => { handleCloseMoreMenu(); navigation.navigate('Profile'); } },
    { icon: 'send', label: 'Send Money', onPress: () => { handleCloseMoreMenu(); navigation.navigate('SendAmount', { name, username: name.toLowerCase().replace(' ', '_'), avatar }); } },
    { icon: 'download', label: 'Request Money', onPress: () => { handleCloseMoreMenu(); navigation.navigate('RequestAmount', { name, username: name.toLowerCase().replace(' ', '_'), avatar }); } },
    { icon: 'search', label: 'Search in Conversation', onPress: handleOpenSearch },
    { icon: isMuted ? 'bell' : 'bell-off', label: isMuted ? 'Unmute Notifications' : 'Mute Notifications', onPress: handleToggleMute },
    { icon: 'image', label: 'Shared Media', onPress: handleCloseMoreMenu },
    { icon: 'trash', label: 'Clear Chat', color: '#F59E0B', onPress: handleClearChat },
    { icon: 'slash', label: 'Block Contact', color: '#EF4444', onPress: handleCloseMoreMenu },
    { icon: 'flag', label: 'Report', color: '#EF4444', onPress: handleCloseMoreMenu },
  ], [isMuted, name, avatar, navigation, handleCloseMoreMenu, handleOpenSearch, handleToggleMute, handleClearChat]);

  // ----------------------------------------------------------------------------
  // Message actions (long-press modal)
  // ----------------------------------------------------------------------------
  const messageActions = useMemo<MoreAction[]>(() => [
    { icon: 'corner-up-left', label: 'Reply', onPress: handleCloseMessageModal },
    { icon: 'corner-up-right', label: 'Forward', onPress: handleCloseMessageModal },
    { icon: 'copy', label: 'Copy', onPress: handleCopy },
    { icon: 'info', label: 'Info', onPress: handleCloseMessageModal },
    { icon: 'star', label: 'Star', onPress: handleCloseMessageModal },
    { icon: 'trash-2', label: 'Delete', color: '#EF4444', onPress: handleDelete },
  ], [handleCloseMessageModal, handleCopy, handleDelete]);

  // ----------------------------------------------------------------------------
  // FlatList renderItem (stable callback — only changes when filteredMessages does)
  // ----------------------------------------------------------------------------
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
        <ChatMessageBubble message={item} onLongPress={() => handleSelectMessage(item)} />
      </View>
    );
  }, [filteredMessages, styles.dateHeaderContainer, styles.dateHeaderText, handleSelectMessage]);

  const keyExtractor = useCallback((item: Message) => item.id, []);

  const listFooter = useMemo(
    () => isOtherUserTyping ? <ChatTypingIndicator /> : null,
    [isOtherUserTyping],
  );

  // ----------------------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------------------
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors.background }]} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" />

      <ChatHeader
        name={name}
        avatar={avatar}
        online={online}
        onBack={handleBack}
        isMenuOpen={showMoreMenu}
        onMorePress={handleMorePress}
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

      <KeyboardAvoidingView style={styles.keyboardAvoidingView} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={flatListRef}
          data={filteredMessages}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={listFooter}
          removeClippedSubviews
        />

        <ChatInputArea
          message={message}
          setMessage={setMessage}
          onSend={handleSend}
          isAddOpen={showAttachment}
          onAddPress={handleAddPress}
        />
      </KeyboardAvoidingView>

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
    </SafeAreaView>
  );
}

// ============================================================================
// Styles
// ============================================================================

const createScreenStyles = (Colors: ThemeColors, isDark: boolean) => StyleSheet.create({
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
});

const createMoreModalStyles = (Colors: ThemeColors, isDark: boolean) => StyleSheet.create({
  menuCard: {
    backgroundColor: isDark ? Colors.surface : Colors.white,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    gap: Spacing.md,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: isDark ? 'rgba(255,255,255,0.04)' : '#F3F4F6',
  },
  menuItemLabel: { ...Typography.body, fontWeight: '500' },
  caret: {
    width: 12,
    height: 12,
    backgroundColor: isDark ? Colors.surface : Colors.white,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    alignSelf: 'flex-end',
    marginRight: 16,
    marginTop: -6,
    transform: [{ rotate: '45deg' }],
  },
  menuInner: { borderRadius: Radius.lg, overflow: 'hidden' },
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
  iconButtonActive: {
    backgroundColor: isDark ? Colors.primary + '22' : Colors.primary + '15',
    borderColor: Colors.primary,
  },
  profileInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: Spacing.sm },
  avatar: { width: 44, height: 44, borderRadius: Radius.full, marginRight: Spacing.sm },
  nameContainer: { flex: 1, paddingRight: Spacing.sm },
  name: { ...Typography.bodyLg, fontWeight: '700', color: Colors.textPrimary },
  onlineText: { ...Typography.caption, fontWeight: '600', color: Colors.primary },
  rightActions: { flexDirection: 'row', gap: Spacing.sm },
});

const createMessageStyles = (Colors: ThemeColors) => StyleSheet.create({
  messageRow: { flexDirection: 'row', width: '100%' },
  messageRowMe: { justifyContent: 'flex-end' },
  messageRowOther: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '75%', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, borderRadius: 16 },
  bubbleMe: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: Colors.surface, borderTopLeftRadius: 4 },
  text: { ...Typography.body, fontSize: 15, lineHeight: 22 },
  textMe: { color: Colors.white },
  textOther: { color: Colors.textPrimary },
  imageBubble: { maxWidth: '75%', borderRadius: 16, overflow: 'hidden' },
  imageContent: { width: 220, height: 280, borderRadius: 16 },
  imageOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderBottomLeftRadius: 16, borderBottomRightRadius: 16,
    flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center',
  },
  metaContainerOverlay: { marginTop: 0, alignSelf: 'auto' },
  timeTextOverlay: { color: 'rgba(255,255,255,0.9)' },
  docBubble: { minWidth: 220, maxWidth: '80%' },
  docCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 4 },
  docIconBox: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  docInfo: { flex: 1 },
  docName: { ...Typography.body, fontWeight: '600', fontSize: 13, lineHeight: 18 },
  docSize: { ...Typography.caption, fontSize: 11, marginTop: 2, opacity: 0.75 },
  metaContainer: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', alignSelf: 'flex-end', marginTop: 4 },
  timeText: { ...Typography.caption, fontSize: 11 },
  timeTextMe: { color: 'rgba(255,255,255,0.7)' },
  timeTextOther: { color: Colors.textSecondary },
  statusIcon: { marginLeft: 4 },
});

const createInputStyles = (Colors: ThemeColors, isDark: boolean) => StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.sm },
  actionButton: { width: 44, height: 44, borderRadius: Radius.full, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  actionButtonActive: { backgroundColor: Colors.textPrimary },
  inputWrapper: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: isDark ? Colors.surface : Colors.white,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, minHeight: 44, maxHeight: 120,
  },
  icon: { marginRight: Spacing.sm },
  textInput: { flex: 1, ...Typography.body, fontSize: 15, color: Colors.textPrimary, paddingVertical: Platform.OS === 'ios' ? 10 : 8 },
  sendIcon: { marginRight: 2, marginTop: 2 },
});

const createAttachmentModalStyles = (Colors: ThemeColors, isDark: boolean) => StyleSheet.create({
  card: {
    backgroundColor: isDark ? Colors.surface : Colors.white,
    borderRadius: Radius.lg, padding: Spacing.sm, flexDirection: 'row',
    elevation: 16, shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.14, shadowRadius: 16,
    borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
  },
  tile: { alignItems: 'center', gap: 8, flex: 1, paddingVertical: Spacing.md, paddingHorizontal: Spacing.xs },
  tileIcon: { width: 56, height: 56, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { ...Typography.caption, fontWeight: '600', color: Colors.textSecondary, fontSize: 12, textAlign: 'center' },
});
