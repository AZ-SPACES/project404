import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../theme';
import type { Message } from './chatTypes';
import { getDocIcon, formatBytes } from './chatTypes';

// ----------------------------------------------------------------------------
// Props
// ----------------------------------------------------------------------------
type ChatMessageBubbleProps = {
  message: Message;
  onLongPress?: () => void;
};

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------
export const ChatMessageBubble = memo(function ChatMessageBubble({
  message,
  onLongPress,
}: ChatMessageBubbleProps) {
  const { colors: Colors } = useAppTheme();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
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
  }, [isMe, message.status, styles.statusIcon]);

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
// Typing indicator — placed here as it uses the same style factory
// ----------------------------------------------------------------------------
export const ChatTypingIndicator = memo(function ChatTypingIndicator() {
  const { colors: Colors } = useAppTheme();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
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
// Styles
// ----------------------------------------------------------------------------
const createStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    messageRow: { flexDirection: 'row', width: '100%' },
    messageRowMe: { justifyContent: 'flex-end' },
    messageRowOther: { justifyContent: 'flex-start' },
    bubble: {
      maxWidth: '75%',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      borderRadius: 16,
    },
    bubbleMe: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
    bubbleOther: { backgroundColor: Colors.surface, borderTopLeftRadius: 4 },
    text: { ...Typography.body, fontSize: 15, lineHeight: 22 },
    textMe: { color: Colors.white },
    textOther: { color: Colors.textPrimary },
    imageBubble: { maxWidth: '75%', borderRadius: 16, overflow: 'hidden' },
    imageContent: { width: 220, height: 280, borderRadius: 16 },
    imageOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 6,
      backgroundColor: 'rgba(0,0,0,0.35)',
      borderBottomLeftRadius: 16,
      borderBottomRightRadius: 16,
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
    metaContainerOverlay: { marginTop: 0, alignSelf: 'auto' },
    timeTextOverlay: { color: 'rgba(255,255,255,0.9)' },
    docBubble: { minWidth: 220, maxWidth: '80%' },
    docCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 4 },
    docIconBox: {
      width: 44,
      height: 44,
      borderRadius: Radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    docInfo: { flex: 1 },
    docName: { ...Typography.body, fontWeight: '600', fontSize: 13, lineHeight: 18 },
    docSize: { ...Typography.caption, fontSize: 11, marginTop: 2, opacity: 0.75 },
    metaContainer: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      alignSelf: 'flex-end',
      marginTop: 4,
    },
    timeText: { ...Typography.caption, fontSize: 11 },
    timeTextMe: { color: 'rgba(255,255,255,0.7)' },
    timeTextOther: { color: Colors.textSecondary },
    statusIcon: { marginLeft: 4 },
  });
