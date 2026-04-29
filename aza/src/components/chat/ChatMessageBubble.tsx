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
  const replyInfo = message.replyToMessage;

  const statusIcon = useMemo(() => {
    if (!isMe || !message.status) return null;
    const iconColor = isMe ? 'rgba(255,255,255,0.8)' : '#9CA3AF';
    if (message.status === 'sent') return <Feather name="check" size={12} color={iconColor} style={styles.statusIcon} />;
    if (message.status === 'delivered') return <Feather name="check" size={12} color="#FFF" style={styles.statusIcon} />;
    if (message.status === 'read') return <Feather name="check-circle" size={12} color="#4ADE80" style={styles.statusIcon} />;
    return null;
  }, [isMe, message.status, styles.statusIcon]);

  const hasCaption = !!message.caption;
  const overlayMeta = isImageType && !hasCaption;

  const metaRow = (
    <View style={[styles.metaContainer, overlayMeta && styles.metaContainerOverlay]}>
      {message.isStarred && (
        <Feather name="star" size={10} color={isMe ? 'rgba(255,255,255,0.8)' : '#F59E0B'} style={{ marginRight: 4 }} />
      )}
      <Text style={[styles.timeText, isMe ? styles.timeTextMe : styles.timeTextOther, overlayMeta && styles.timeTextOverlay]}>
        {message.time}
      </Text>
      {statusIcon}
    </View>
  );

  const replyPreview = replyInfo ? (
    <View style={[styles.replyPreview, isMe ? styles.replyPreviewMe : styles.replyPreviewOther]}>
      <View style={[styles.replyBar, { backgroundColor: isMe ? 'rgba(255,255,255,0.5)' : Colors.primary }]} />
      <View style={styles.replyContent}>
        <Text style={[styles.replySender, isMe ? styles.replySenderMe : styles.replySenderOther]} numberOfLines={1}>
          {replyInfo.sender === 'me' ? 'You' : 'Them'}
        </Text>
        <Text style={[styles.replyText, isMe ? styles.replyTextMe : styles.replyTextOther]} numberOfLines={2}>
          {replyInfo.text}
        </Text>
      </View>
    </View>
  ) : null;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <TouchableOpacity
      onLongPress={onLongPress}
      delayLongPress={250}
      activeOpacity={0.9}
      style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowOther]}
    >
      {isImageType && message.uri ? (
        <View style={[styles.imageBubble, isMe ? styles.bubbleMe : styles.bubbleOther, hasCaption && { padding: 4 }]}>
          {replyPreview}
          <Image 
            source={{ uri: message.uri }} 
            style={[styles.imageContent, hasCaption && { borderRadius: 12 }]} 
            resizeMode="cover" 
            accessibilityLabel="Sent image" 
          />
          {hasCaption ? (
            <View style={{ paddingHorizontal: 8, paddingVertical: 4, paddingBottom: 6 }}>
              <Text style={[styles.text, isMe ? styles.textMe : styles.textOther]}>{message.caption}</Text>
              {metaRow}
            </View>
          ) : (
            <View style={styles.imageOverlay}>{metaRow}</View>
          )}
        </View>
      ) : message.type === 'document' ? (
        <View style={[styles.bubble, styles.docBubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
          {replyPreview}
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
      ) : message.type === 'audio' ? (
        <View style={[styles.bubble, styles.audioBubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
          {replyPreview}
          <View style={styles.audioRow}>
            <TouchableOpacity style={[styles.audioPlayBtn, { backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : Colors.primary + '15' }]}>
              <Feather name="play" size={16} color={isMe ? '#FFF' : Colors.primary} style={{ marginLeft: 2 }} />
            </TouchableOpacity>
            <View style={styles.audioWaveform}>
              <View style={[styles.audioWaveLine, { backgroundColor: isMe ? 'rgba(255,255,255,0.4)' : Colors.border }]} />
              <View style={[styles.audioWaveProgress, { width: '0%', backgroundColor: isMe ? '#FFF' : Colors.primary }]} />
              <View style={[styles.audioWaveDot, { left: '0%', backgroundColor: isMe ? '#FFF' : Colors.primary }]} />
            </View>
            <Text style={[styles.audioTime, isMe ? styles.textMe : styles.textOther]}>
              {formatDuration(message.duration ?? 0)}
            </Text>
          </View>
          {metaRow}
        </View>
      ) : (
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
          {replyPreview}
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
    // Audio bubble
    audioBubble: { minWidth: 200, maxWidth: '80%' },
    audioRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    audioPlayBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    audioWaveform: {
      flex: 1,
      height: 20,
      justifyContent: 'center',
      position: 'relative',
    },
    audioWaveLine: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 3,
      borderRadius: 2,
    },
    audioWaveProgress: {
      position: 'absolute',
      left: 0,
      height: 3,
      borderRadius: 2,
      zIndex: 1,
    },
    audioWaveDot: {
      position: 'absolute',
      width: 10,
      height: 10,
      borderRadius: 5,
      marginTop: -3.5,
      zIndex: 2,
    },
    audioTime: {
      ...Typography.caption,
      fontSize: 11,
      fontVariant: ['tabular-nums'],
    },
    // Reply preview inside bubble
    replyPreview: {
      flexDirection: 'row',
      borderRadius: 6,
      marginBottom: 6,
      overflow: 'hidden',
    },
    replyPreviewMe: {
      backgroundColor: 'rgba(255,255,255,0.15)',
    },
    replyPreviewOther: {
      backgroundColor: 'rgba(0,0,0,0.05)',
    },
    replyBar: {
      width: 3,
    },
    replyContent: {
      flex: 1,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    replySender: {
      ...Typography.caption,
      fontSize: 11,
      fontWeight: '700',
      marginBottom: 1,
    },
    replySenderMe: { color: 'rgba(255,255,255,0.85)' },
    replySenderOther: { color: Colors.primary },
    replyText: {
      ...Typography.caption,
      fontSize: 12,
      lineHeight: 16,
    },
    replyTextMe: { color: 'rgba(255,255,255,0.65)' },
    replyTextOther: { color: Colors.textSecondary },
  });
