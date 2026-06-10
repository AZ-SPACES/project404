import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  StatusBar,
  Alert,
  Switch,
  ActivityIndicator,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Feather } from '@react-native-vector-icons/feather';
import { MaterialDesignIcons as MaterialCommunityIcons } from '@react-native-vector-icons/material-design-icons';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from "../../../theme";
import { DisappearingMessagesModal } from "../../../components/chat/ChatSettingsModals";
import { formatBytes } from "../../../components/chat/chatTypes";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";
import { useChatStore } from "../../../store/chatStore";
import { useContactStore } from "../../../store/contactStore";
import { useStarredMessagesStore } from "../../../store/starredMessagesStore";
import { useChatThemeStore } from "../../../store/chatThemeStore";
import { useE2EE } from "../../../providers/E2EEProvider";
import { blockUser } from "../../../services/api";
import { BackButton } from '../../../components/ui/BackButton';
import { useMediaAutoSaveStore } from '../../../store/mediaAutoSaveStore';
import { useReadReceiptsStore } from '../../../store/readReceiptsStore';
import { usePresenceStore } from '../../../store/presenceStore';
import { useOnlineAlertStore } from '../../../store/onlineAlertStore';
import * as Notifications from 'expo-notifications';

// ─── Types ──────────────────────────────────────────────────────────
type ChatInfoRouteProp = RouteProp<RootStackParamList, "ChatInfoScreen">;

// ─── Row component for settings-style items ─────────────────────────
type SettingsRowProps = {
  icon: React.ReactNode;
  label: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  Colors: ThemeColors;
};

function SettingsRow({ icon, label, subtitle, value, onPress, rightElement, Colors }: SettingsRowProps) {
  return (
    <TouchableOpacity
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
        paddingHorizontal: Spacing.lg,
      }}
      activeOpacity={onPress ? 0.7 : 1}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={{ width: 28, alignItems: "center" }}>{icon}</View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text
          style={{
            ...Typography.bodyLg,
            color: Colors.textPrimary,
          }}
        >
          {label}
        </Text>
        {subtitle ? (
          <Text style={{ ...Typography.caption, color: Colors.textSecondary, marginTop: 1 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {rightElement ?? (
        <>
          {value ? (
            <Text
              style={{
                ...Typography.body,
                color: Colors.textSecondary,
                marginRight: 4,
              }}
            >
              {value}
            </Text>
          ) : null}
          {onPress && <Feather name="chevron-right" size={18} color={Colors.textSecondary} />}
        </>
      )}
    </TouchableOpacity>
  );
}

// ─── Detail row for account info ────────────────────────────────────
type DetailRowProps = {
  label: string;
  value: string;
  copyable?: boolean;
  Colors: ThemeColors;
};

function DetailRow({ label, value, copyable, Colors }: DetailRowProps) {
  const handleCopy = async () => {
    await Clipboard.setStringAsync(value);
    Alert.alert("Copied", `${label} copied to clipboard`);
  };

  return (
    <View
      style={{
        paddingVertical: 14,
        paddingHorizontal: Spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
      }}
    >
      <Text
        style={{
          ...Typography.caption,
          color: Colors.textSecondary,
          marginBottom: 4,
        }}
      >
        {label}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text
          style={{
            ...Typography.bodyLg,
            color: Colors.textPrimary,
            fontWeight: "500",
            flex: 1,
          }}
        >
          {value}
        </Text>
        {copyable ? (
          <TouchableOpacity onPress={handleCopy} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="copy" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

// Map TTL seconds → display label
const LABEL_BY_TTL: Record<number, string> = {
  0: "Off",
  86400: "24 hours",
  604800: "7 days",
  7776000: "90 days",
};

const TTL_BY_LABEL: Record<string, number> = {
  Off: 0,
  "24 hours": 86400,
  "7 days": 604800,
  "90 days": 7776000,
};

// ─── Main Screen ────────────────────────────────────────────────────
export default function ChatInfoScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<ChatInfoRouteProp>();

  const {
    id: chatIdParam,
    name: paramName,
    username: paramUsername,
    avatar: paramAvatar,
    phone: paramPhone,
    status: paramStatus,
    mediaCount = 0,
    storageStats,
  } = route.params;

  // ── Store selectors ───────────────────────────────────────────────
  const chats = useChatStore((s) => s.chats);
  const peerKeys = useChatStore((s) => s.peerKeys);
  const ensurePeerKeys = useChatStore((s) => s.ensurePeerKeys);
  const storeMuteChat = useChatStore((s) => s.muteChat);
  const storeArchiveChat = useChatStore((s) => s.archiveChat);
  const storeSetDisappearingTtl = useChatStore((s) => s.setDisappearingTtl);
  const clearChatMessages = useChatStore((s) => s.clearChatMessages);
  const messagesByChat = useChatStore((s) => s.messagesByChat);

  const contacts = useContactStore((s) => s.contacts);

  const loadStarred = useStarredMessagesStore((s) => s.load);
  const starredCount = useStarredMessagesStore((s) =>
    chatIdParam ? s.entries.filter((e) => e.chatId === chatIdParam).length : 0,
  );

  const loadTheme = useChatThemeStore((s) => s.load);

  useEffect(() => {
    loadStarred();
    loadTheme();
  }, [loadStarred, loadTheme]);

  // The route param `id` carries chatId. Resolve live data from the store.
  const chat = chatIdParam ? chats[chatIdParam] : undefined;
  const otherUserId = chat?.otherUserId;
  const peer = otherUserId ? peerKeys[otherUserId] : undefined;

  // Prefer live store data over the (potentially stale) route params
  const name = chat?.otherUserName ?? paramName;
  const username = chat?.otherUserHandle ?? paramUsername;
  const avatar = chat?.otherUserAvatar ?? paramAvatar;
  const status = chat?.otherUserStatus ?? paramStatus ?? "Available";
  const isMuted = chat?.isMuted ?? false;
  const isArchived = chat?.isArchived ?? false;

  // Phone: look up from local contact store by userId, fall back to route param
  const phone = React.useMemo(() => {
    if (paramPhone) return paramPhone;
    const contact = contacts.find((c) => c.contactUserId === otherUserId);
    return contact?.phoneNumber ?? null;
  }, [contacts, otherUserId, paramPhone]);

  // ── UI state ──────────────────────────────────────────────────────
  const [showDisappearingModal, setShowDisappearingModal] = useState(false);
  const [disappearingTimer, setDisappearingTimer] = useState("Off");
  const [mutePending, setMutePending] = useState(false);
  const [archivePending, setArchivePending] = useState(false);
  const [blockPending, setBlockPending] = useState(false);

  const autoSaveEnabled = useMediaAutoSaveStore(s => chatIdParam ? s.isEnabled(chatIdParam) : false);
  const setAutoSave = useMediaAutoSaveStore(s => s.setEnabled);

  const readReceiptsEnabled = useReadReceiptsStore(s => chatIdParam ? s.isEnabled(chatIdParam) : true);
  const setReadReceipts = useReadReceiptsStore(s => s.setEnabled);

  // ── Online alert ──────────────────────────────────────────────────
  const isUserOnline = usePresenceStore(s => s.isOnline(otherUserId ?? ''));
  const onlineAlertEnabled = useOnlineAlertStore(s => s.isEnabled(otherUserId ?? ''));
  const setOnlineAlert = useOnlineAlertStore(s => s.setEnabled);
  const wasOnlineRef = useRef<boolean>(isUserOnline);

  useEffect(() => {
    const prev = wasOnlineRef.current;
    if (!prev && isUserOnline && onlineAlertEnabled && otherUserId) {
      Notifications.scheduleNotificationAsync({
        content: {
          title: `${name} is online`,
          body: 'Tap to open chat',
          sound: true,
        },
        trigger: null,
      }).catch(() => {});
    }
    wasOnlineRef.current = isUserOnline;
  }, [isUserOnline, onlineAlertEnabled, otherUserId, name]);

  // ── E2EE verification ─────────────────────────────────────────────
  const { computeSafetyNumber, identity } = useE2EE();

  useEffect(() => {
    if (otherUserId && !peer) ensurePeerKeys(otherUserId).catch(() => {});
  }, [otherUserId, peer, ensurePeerKeys]);

  // Sync disappearing timer label from live store state
  useEffect(() => {
    const ttl = chat?.disappearingTtlSeconds;
    if (ttl === undefined || ttl === null) {
      setDisappearingTimer("Off");
      return;
    }
    setDisappearingTimer(LABEL_BY_TTL[ttl] ?? `${ttl}s`);
  }, [chat?.disappearingTtlSeconds]);

  const safetyNumberValue = React.useMemo(() => {
    if (!peer || !identity) return null;
    return computeSafetyNumber(peer.identityPublicKey);
  }, [peer, identity, computeSafetyNumber]);

  const handleVerifySafetyNumber = () => {
    if (!safetyNumberValue) {
      Alert.alert(
        "Identity not yet available",
        "We're still fetching " + name + "'s encryption keys. Try again in a moment.",
      );
      return;
    }
    const sigLine = peer?.spkSignatureValid
      ? "Signed pre-key signature: VALID."
      : "Signed pre-key signature: NOT VERIFIED — proceed with caution.";
    const rotationLine =
      peer?.identityChange === 'changed'
        ? "\n\n⚠️ " + name + "'s encryption key has changed since you last contacted them. " +
          "This can happen if they reinstalled the app, but it can also mean someone is impersonating them. " +
          "Re-verify the safety number before sending anything sensitive."
        : peer?.identityChange === 'first-seen'
          ? "\n\nFirst time contacting this peer — keys recorded for future comparison."
          : "";
    Alert.alert(
      "Verify safety number",
      `Compare these numbers with ${name} in person or over a call you trust. ` +
        `If they match, your conversation is end-to-end encrypted and the keys ` +
        `haven't changed.\n\n${safetyNumberValue}\n\n${sigLine}${rotationLine}`,
      [
        { text: "Copy", onPress: () => Clipboard.setStringAsync(safetyNumberValue) },
        { text: "Close", style: "cancel" },
      ],
    );
  };

  // ── Actions ───────────────────────────────────────────────────────
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleSend = () => {
    navigation.navigate("SendAmount", { name, username, avatar, identifier: otherUserId ?? username });
  };

  const handleRequest = () => {
    navigation.navigate("RequestAmount", { name, username, avatar, identifier: otherUserId ?? username });
  };

  const handleShare = () => {
    Alert.alert("Share", `Share ${name}'s profile`);
  };

  const handleMuteToggle = useCallback(async () => {
    if (!chatIdParam || mutePending) return;
    setMutePending(true);
    try {
      await storeMuteChat(chatIdParam, !isMuted);
    } catch {
      Alert.alert("Error", "Couldn't update notification settings. Please try again.");
    } finally {
      setMutePending(false);
    }
  }, [chatIdParam, isMuted, mutePending, storeMuteChat]);

  const handleArchiveToggle = useCallback(async () => {
    if (!chatIdParam || archivePending) return;
    setArchivePending(true);
    try {
      await storeArchiveChat(chatIdParam, !isArchived);
      if (!isArchived) {
        Alert.alert("Chat archived", `${name} has been moved to your archive.`);
        navigation.goBack();
      }
    } catch {
      Alert.alert("Error", "Couldn't update archive. Please try again.");
    } finally {
      setArchivePending(false);
    }
  }, [chatIdParam, isArchived, archivePending, storeArchiveChat, name, navigation]);

  const handleDisappearingSelect = useCallback(async (val: string) => {
    setDisappearingTimer(val);
    setShowDisappearingModal(false);
    const ttl = TTL_BY_LABEL[val] ?? 0;
    if (chatIdParam) {
      try {
        await storeSetDisappearingTtl(chatIdParam, ttl);
      } catch {
        Alert.alert("Couldn't update", "Disappearing message setting failed. Please try again.");
        // Revert optimistic label
        const current = chat?.disappearingTtlSeconds;
        setDisappearingTimer(current ? (LABEL_BY_TTL[current] ?? `${current}s`) : "Off");
      }
    }
  }, [chatIdParam, storeSetDisappearingTtl, chat?.disappearingTtlSeconds]);

  const handleSaveProfilePhoto = useCallback(async () => {
    if (!avatar) { Alert.alert("No photo", "This contact has no profile photo."); return; }
    const perm = await MediaLibrary.requestPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permission denied", "Allow media access to save photos."); return; }
    try {
      await MediaLibrary.saveToLibraryAsync(avatar);
      Alert.alert("Saved", "Profile photo saved to your Photos.");
    } catch {
      Alert.alert("Save failed", "Could not save this photo.");
    }
  }, [avatar]);

  const handleBlockRecipient = useCallback(() => {
    if (!otherUserId) return;
    Alert.alert(
      "Block & remove",
      `Are you sure you want to block ${name}? They won't be able to message or pay you.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: async () => {
            setBlockPending(true);
            try {
              await blockUser(otherUserId);
              navigation.goBack();
            } catch {
              Alert.alert("Error", "Couldn't block this user. Please try again.");
            } finally {
              setBlockPending(false);
            }
          },
        },
      ]
    );
  }, [otherUserId, name, navigation]);

  const handleExportChat = useCallback(async () => {
    if (!chatIdParam) return;
    const msgs = messagesByChat[chatIdParam] ?? [];
    if (msgs.length === 0) {
      Alert.alert('Nothing to export', 'This chat has no messages yet.');
      return;
    }
    const lines = msgs
      .filter(m => !m.isDeleted)
      .map(m => {
        const d = new Date(m.timestamp);
        const date = d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const sender = m.isSelf ? 'You' : name;
        const body = m.text || `[${m.type.toLowerCase()}]`;
        return `[${date}, ${time}] ${sender}: ${body}`;
      });
    const header = `Chat with ${name}\nExported on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}\n${'─'.repeat(40)}\n\n`;
    const content = header + lines.join('\n');
    const path = `${FileSystem.cacheDirectory ?? ''}chat_${name.replace(/\s+/g, '_')}_${Date.now()}.txt`;
    try {
      await FileSystem.writeAsStringAsync(path, content, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(path, { mimeType: 'text/plain', dialogTitle: `Export chat with ${name}` });
    } catch {
      Alert.alert('Export failed', 'Could not export the chat. Please try again.');
    } finally {
      FileSystem.deleteAsync(path, { idempotent: true }).catch(() => {});
    }
  }, [chatIdParam, messagesByChat, name]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={Colors.isDark ? "light-content" : "dark-content"}
        backgroundColor={Colors.background}
      />

      {/* ── Header bar ────────────────────────────────── */}
      <View style={styles.headerBar}>
        <BackButton onPress={() => navigation.goBack()} size={22} />
        <Text style={styles.headerTitle}>Contact info</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Avatar & identity ───────────────────────── */}
        <View style={styles.profileSection}>
          <TouchableOpacity
            activeOpacity={avatar ? 0.85 : 1}
            onLongPress={avatar ? () => Alert.alert(name, undefined, [
              { text: "Save to Photos", onPress: handleSaveProfilePhoto },
              { text: "Cancel", style: "cancel" },
            ]) : undefined}
            delayLongPress={350}
          >
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.name}>{name}</Text>
          {username ? <Text style={styles.username}>@{username}</Text> : null}
          {phone ? <Text style={styles.phoneNumber}>{phone}</Text> : null}
          {status ? <Text style={styles.status}>{status}</Text> : null}
        </View>

        {/* ── Action buttons ──────────────────────────── */}
        <View style={styles.actionsRow}>
          <View style={styles.actionItem}>
            <TouchableOpacity
              style={styles.actionCircle}
              activeOpacity={0.8}
              onPress={handleSend}
            >
              <Feather name="arrow-up" size={22} color={Colors.secondary} />
            </TouchableOpacity>
            <Text style={styles.actionLabel}>Send</Text>
          </View>

          <View style={styles.actionItem}>
            <TouchableOpacity
              style={styles.actionCircle}
              activeOpacity={0.8}
              onPress={handleRequest}
            >
              <Feather name="arrow-down" size={22} color={Colors.secondary} />
            </TouchableOpacity>
            <Text style={styles.actionLabel}>Request</Text>
          </View>

          <View style={styles.actionItem}>
            <TouchableOpacity
              style={styles.actionCircle}
              activeOpacity={0.8}
              onPress={handleShare}
            >
              <Feather name="share" size={22} color={Colors.secondary} />
            </TouchableOpacity>
            <Text style={styles.actionLabel}>Share</Text>
          </View>
        </View>

        {/* ── Account details section ─────────────────── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>Account details</Text>
          <DetailRow
            label="Account holder name"
            value={name}
            copyable
            Colors={Colors}
          />
          {username ? (
            <DetailRow
              label="Username"
              value={`@${username}`}
              copyable
              Colors={Colors}
            />
          ) : null}
          {phone ? (
            <DetailRow
              label="Phone number"
              value={phone}
              copyable
              Colors={Colors}
            />
          ) : null}
        </View>

        {/* ── Media & storage section ─────────────────── */}
        <View style={styles.sectionCard}>
          <SettingsRow
            icon={<Ionicons name="images-outline" size={20} color={Colors.textPrimary} />}
            label="Media, links and docs"
            value={mediaCount.toString()}
            Colors={Colors}
            onPress={() => navigation.navigate("SharedMedia", { chatId: chatIdParam, otherUserName: name })}
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            icon={<Feather name="hard-drive" size={20} color={Colors.textPrimary} />}
            label="Manage storage"
            value={storageStats?.totalSize ? formatBytes(storageStats.totalSize) : "0 B"}
            Colors={Colors}
            onPress={() => navigation.navigate("ManageStorage", storageStats ? { storageStats } : undefined)}
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            icon={<Feather name="star" size={20} color={Colors.textPrimary} />}
            label="Starred"
            value={starredCount > 0 ? starredCount.toString() : "None"}
            Colors={Colors}
            onPress={() => navigation.navigate("StarredMessages")}
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            icon={<Feather name="download" size={20} color={Colors.textPrimary} />}
            label="Export chat"
            Colors={Colors}
            onPress={handleExportChat}
          />
        </View>

        {/* ── Settings section ────────────────────────── */}
        <View style={styles.sectionCard}>
          <SettingsRow
            icon={<Ionicons name="notifications-outline" size={20} color={Colors.textPrimary} />}
            label="Mute notifications"
            Colors={Colors}
            rightElement={
              mutePending ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Switch
                  value={isMuted}
                  onValueChange={handleMuteToggle}
                  trackColor={{ false: Colors.border, true: Colors.primary }}
                  thumbColor={Colors.white}
                />
              )
            }
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            icon={<MaterialCommunityIcons name="palette-outline" size={20} color={Colors.textPrimary} />}
            label="Chat theme"
            Colors={Colors}
            onPress={() => {
              if (chatIdParam) navigation.navigate('ChatThemeScreen', { chatId: chatIdParam, name });
            }}
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            icon={<Feather name="download" size={20} color={Colors.textPrimary} />}
            label="Save to Photos"
            Colors={Colors}
            rightElement={
              <Switch
                value={autoSaveEnabled}
                onValueChange={(val) => { if (chatIdParam) setAutoSave(chatIdParam, val); }}
                trackColor={{ false: Colors.border, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            }
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            icon={<Feather name="check-circle" size={20} color={Colors.textPrimary} />}
            label="Read receipts"
            subtitle="Let contacts know when you've read their messages"
            Colors={Colors}
            rightElement={
              <Switch
                value={readReceiptsEnabled}
                onValueChange={(val) => { if (chatIdParam) setReadReceipts(chatIdParam, val); }}
                trackColor={{ false: Colors.border, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            }
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            icon={<Feather name="bell" size={20} color={Colors.textPrimary} />}
            label="Notify when online"
            subtitle="Get an alert when this contact comes online"
            Colors={Colors}
            rightElement={
              <Switch
                value={onlineAlertEnabled}
                onValueChange={(val) => { if (otherUserId) setOnlineAlert(otherUserId, val); }}
                trackColor={{ false: Colors.border, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            }
          />
        </View>

        {/* ── Privacy section ─────────────────────────── */}
        <View style={styles.sectionCard}>
          <SettingsRow
            icon={<Feather name="shield" size={20} color={Colors.textPrimary} />}
            label="Encryption"
            value={
              peer?.identityChange === 'changed'
                ? "Key changed — review"
                : peer?.spkSignatureValid
                  ? "End-to-end · Verified"
                  : "End-to-end"
            }
            Colors={Colors}
            onPress={handleVerifySafetyNumber}
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            icon={<Ionicons name="timer-outline" size={20} color={Colors.textPrimary} />}
            label="Disappearing messages"
            value={disappearingTimer}
            Colors={Colors}
            onPress={() => setShowDisappearingModal(true)}
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            icon={<Feather name="file-text" size={20} color={Colors.textPrimary} />}
            label="Transcript language"
            value="English"
            Colors={Colors}
          />
        </View>

        {/* ── Account settings / dangerous actions ────── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>Account settings</Text>

          {/* Archive toggle */}
          <TouchableOpacity
            style={styles.dangerRow}
            activeOpacity={0.8}
            onPress={handleArchiveToggle}
            disabled={archivePending}
          >
            {archivePending ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Text style={[styles.dangerRowText, { color: Colors.primary }]}>
                {isArchived ? "Unarchive chat" : "Archive chat"}
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          {/* Clear chat */}
          <TouchableOpacity
            style={styles.dangerRow}
            activeOpacity={0.8}
            onPress={() => {
              Alert.alert(
                'Clear Chat',
                'All messages will be removed from your device. They can be reloaded from the server.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Clear', style: 'destructive', onPress: () => {
                    if (chatIdParam) clearChatMessages(chatIdParam);
                  }},
                ],
              );
            }}
          >
            <Text style={[styles.dangerRowText, { color: '#F59E0B' }]}>Clear chat</Text>
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          {/* Block & remove */}
          <TouchableOpacity
            style={styles.dangerRow}
            activeOpacity={0.8}
            onPress={handleBlockRecipient}
            disabled={blockPending || !otherUserId}
          >
            {blockPending ? (
              <ActivityIndicator size="small" color={Colors.error} />
            ) : (
              <Text style={styles.dangerRowText}>Block & remove</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ height: Spacing.xl * 2 }} />
      </ScrollView>

      <DisappearingMessagesModal
        visible={showDisappearingModal}
        currentValue={disappearingTimer}
        isDark={Colors.isDark}
        Colors={Colors}
        onClose={() => setShowDisappearingModal(false)}
        onSelect={handleDisappearingSelect}
      />
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────
function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },

    // Header
    headerBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: Spacing.lg,
      paddingVertical: 12,
    },
    headerTitle: {
      ...Typography.bodyLg,
      fontWeight: "600",
      color: Colors.textPrimary,
    },

    scrollContent: {
      paddingBottom: Spacing.xl,
    },

    // Profile identity
    profileSection: {
      alignItems: "center",
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.md,
    },
    avatar: {
      width: 96,
      height: 96,
      borderRadius: 48,
      marginBottom: Spacing.md,
    },
    avatarFallback: {
      backgroundColor: Colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarInitials: {
      fontSize: 32,
      fontWeight: "700",
      color: Colors.secondary,
    },
    name: {
      ...Typography.h2,
      color: Colors.textPrimary,
      fontWeight: "700",
      marginBottom: 2,
    },
    username: {
      ...Typography.body,
      color: Colors.primary,
      fontWeight: "600",
      marginBottom: 4,
    },
    phoneNumber: {
      ...Typography.body,
      color: Colors.textSecondary,
      marginBottom: 2,
    },
    status: {
      ...Typography.caption,
      color: Colors.textSecondary,
      marginTop: 2,
    },

    // Action circles
    actionsRow: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 32,
      paddingVertical: Spacing.lg,
    },
    actionItem: {
      alignItems: "center",
      width: 72,
    },
    actionCircle: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: Colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 6,
    },
    actionLabel: {
      ...Typography.caption,
      fontWeight: "600",
      color: Colors.primary,
    },

    // Section cards
    sectionCard: {
      backgroundColor: isDark ? Colors.surface : Colors.white,
      marginHorizontal: Spacing.lg,
      marginTop: Spacing.md,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: Colors.border,
      overflow: "hidden",
    },
    sectionHeader: {
      ...Typography.caption,
      color: Colors.textSecondary,
      fontWeight: "500",
      paddingHorizontal: Spacing.lg,
      paddingTop: 14,
      paddingBottom: 4,
    },
    rowDivider: {
      height: 1,
      backgroundColor: Colors.border,
      marginLeft: Spacing.lg + 28 + 12,
    },

    // Dangerous action rows (archive / block)
    dangerRow: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: 16,
      alignItems: "center",
    },
    dangerRowText: {
      ...Typography.button,
      color: Colors.error,
      fontWeight: "600",
    },
  });
}
