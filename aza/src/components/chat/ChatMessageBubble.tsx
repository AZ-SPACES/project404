import React, { memo, useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, TextStyle, Animated, Modal, Dimensions, ScrollView, Platform } from 'react-native';
import { Feather } from '@react-native-vector-icons/feather';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../theme';
import type { Message } from './chatTypes';
import { getDocIcon, formatBytes } from './chatTypes';
import { useReactionStore, EmojiReaction } from '../../store/reactionStore';
import { extractFirstUrl, fetchLinkPreview, LinkPreview } from '../../utils/linkPreview';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ----------------------------------------------------------------------------
// Props
// ----------------------------------------------------------------------------
type ChatMessageBubbleProps = {
  message: Message;
  onLongPress?: () => void;
  onImagePress?: (uri: string) => void;
  onPayPress?: (amount: number) => void;
  bubbleColor?: string | undefined;
  isLastInGroup?: boolean;
  isNew?: boolean;
};

// ----------------------------------------------------------------------------
// Text formatting — WhatsApp syntax *bold* _italic_ ~strikethrough~
// ----------------------------------------------------------------------------
type Segment = { text: string; bold?: boolean; italic?: boolean; strike?: boolean };

function parseMarkdown(input: string): Segment[] {
  const TOKEN_RE = /(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g;
  const parts: Segment[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = TOKEN_RE.exec(input)) !== null) {
    if (match.index > last) parts.push({ text: input.slice(last, match.index) });
    const token = match[0];
    if (token.startsWith('*')) parts.push({ text: token.slice(1, -1), bold: true });
    else if (token.startsWith('_')) parts.push({ text: token.slice(1, -1), italic: true });
    else parts.push({ text: token.slice(1, -1), strike: true });
    last = match.index + token.length;
  }
  if (last < input.length) parts.push({ text: input.slice(last) });
  return parts;
}

function FormattedText({ text, style }: { text: string; style: TextStyle | TextStyle[] }) {
  const segments = useMemo(() => parseMarkdown(text), [text]);
  const hasFormatting = segments.some((s) => s.bold || s.italic || s.strike);
  if (!hasFormatting) return <Text style={style}>{text}</Text>;
  return (
    <Text style={style}>
      {segments.map((seg, i) => (
        <Text
          key={i}
          style={[
            seg.bold && { fontWeight: '700' },
            seg.italic && { fontStyle: 'italic' },
            seg.strike && { textDecorationLine: 'line-through' },
          ]}
        >
          {seg.text}
        </Text>
      ))}
    </Text>
  );
}

// ----------------------------------------------------------------------------
// Link preview card
// ----------------------------------------------------------------------------
function LinkPreviewCard({ url, isMe }: { url: string; isMe: boolean }) {
  const { colors: Colors } = useAppTheme();
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchLinkPreview(url).then((p) => {
      if (!cancelled) { setPreview(p); setLoaded(true); }
    });
    return () => { cancelled = true; };
  }, [url]);

  if (!loaded || !preview || (!preview.title && !preview.description)) return null;

  const cardBg = isMe ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.05)';
  const textColor = isMe ? 'rgba(255,255,255,0.95)' : Colors.textPrimary;
  const subColor = isMe ? 'rgba(255,255,255,0.6)' : Colors.textSecondary;

  return (
    <View style={[lpStyles.card, { backgroundColor: cardBg }]}>
      {!!preview.image && (
        <Image source={{ uri: preview.image }} style={lpStyles.cardImage} resizeMode="cover" />
      )}
      <View style={lpStyles.cardBody}>
        {!!preview.siteName && (
          <Text style={[lpStyles.cardSite, { color: subColor }]} numberOfLines={1}>
            {preview.siteName}
          </Text>
        )}
        {!!preview.title && (
          <Text style={[lpStyles.cardTitle, { color: textColor }]} numberOfLines={2}>
            {preview.title}
          </Text>
        )}
        {!!preview.description && (
          <Text style={[lpStyles.cardDesc, { color: subColor }]} numberOfLines={2}>
            {preview.description}
          </Text>
        )}
      </View>
    </View>
  );
}

const lpStyles = StyleSheet.create({
  card: { borderRadius: 8, overflow: 'hidden', marginTop: 6, marginBottom: 2 },
  cardImage: { width: '100%', height: 120 },
  cardBody: { padding: 8, gap: 2 },
  cardSite: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  cardTitle: { fontSize: 13, fontWeight: '700', lineHeight: 18 },
  cardDesc: { fontSize: 12, lineHeight: 16 },
});

// ----------------------------------------------------------------------------
// Reaction bar
// ----------------------------------------------------------------------------
const EMPTY_REACTIONS: EmojiReaction[] = [];

function ReactionBar({ messageId, isMe }: { messageId: string; isMe: boolean }) {
  const reactions = useReactionStore((s) => s.reactions[messageId] ?? EMPTY_REACTIONS);
  const removeReaction = useReactionStore((s) => s.removeReaction);
  const addReaction = useReactionStore((s) => s.addReaction);

  if (reactions.length === 0) return null;

  return (
    <View style={[rbStyles.row, isMe ? rbStyles.rowMe : rbStyles.rowOther]}>
      {reactions.map((r) => (
        <TouchableOpacity
          key={r.emoji}
          style={[rbStyles.chip, r.byMe && rbStyles.chipActive]}
          activeOpacity={0.7}
          onPress={() => r.byMe ? removeReaction(messageId, r.emoji) : addReaction(messageId, r.emoji)}
        >
          <Text style={rbStyles.emoji}>{r.emoji}</Text>
          {r.count > 1 && <Text style={rbStyles.count}>{r.count}</Text>}
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ----------------------------------------------------------------------------
// Full-screen image viewer
// ----------------------------------------------------------------------------
export function FullScreenImageViewer({ uri, onClose }: { uri: string; onClose: () => void }) {
  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <View style={fsStyles.backdrop}>
        <TouchableOpacity style={fsStyles.closeBtn} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="x" size={24} color="#fff" />
        </TouchableOpacity>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={fsStyles.scrollContent}
          maximumZoomScale={5}
          minimumZoomScale={1}
          bouncesZoom
          centerContent
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
        >
          <Image source={{ uri }} style={fsStyles.image} resizeMode="contain" />
        </ScrollView>
      </View>
    </Modal>
  );
}

const fsStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
  closeBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 20,
    right: 20,
    zIndex: 10,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  image: { width: SCREEN_W, height: SCREEN_H * 0.8 },
});

const rbStyles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 3, paddingHorizontal: 4 },
  rowMe: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  chipActive: { backgroundColor: 'rgba(23,71,23,0.15)', borderWidth: 1, borderColor: 'rgba(23,71,23,0.3)' },
  emoji: { fontSize: 13 },
  count: { fontSize: 11, fontWeight: '600', color: '#555' },
});

// ----------------------------------------------------------------------------
// Deterministic waveform from message id seed
// ----------------------------------------------------------------------------
function generateWaveform(seed: string, bars = 32): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = Math.imul(hash << 5, hash) + seed.charCodeAt(i);
  }
  return Array.from({ length: bars }, (_, i) => {
    const v = Math.abs(Math.sin(hash * (i + 1) * 1.618 + i * 0.37));
    return 0.15 + v * 0.85;
  });
}

// ----------------------------------------------------------------------------
// Audio bubble with real playback
// ----------------------------------------------------------------------------
type AudioBubbleInnerProps = {
  message: Message;
  isMe: boolean;
  bubbleColor: string | undefined;
  replyPreview: React.ReactNode;
  metaRow: React.ReactNode;
  styles: ReturnType<typeof createStyles>;
  Colors: ThemeColors;
  receivedBubbleBg: string;
};

const AudioBubbleInner = memo(function AudioBubbleInner({
  message,
  isMe,
  bubbleColor,
  replyPreview,
  metaRow,
  styles,
  Colors,
  receivedBubbleBg,
}: AudioBubbleInnerProps) {
  const source = useMemo(
    () => (message.uri ? { uri: message.uri } : undefined),
    [message.uri]
  );
  const player = useAudioPlayer(source, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);

  const isPlaying = status.playing;
  const currentSecs = status.currentTime ?? 0;
  const totalSecs = status.duration ?? message.duration ?? 0;
  const progress = totalSecs > 0 ? Math.min(currentSecs / totalSecs, 1) : 0;

  // Seek back to 0 when playback ends so the play button works again
  useEffect(() => {
    if (status.didJustFinish) {
      player.seekTo(0).catch(() => {});
    }
  }, [status.didJustFinish, player]);

  // Speed control: cycle 1× → 1.5× → 2× → 1×
  const [speed, setSpeed] = useState<1 | 1.5 | 2>(1);
  const handleSpeedToggle = useCallback(() => {
    const next: 1 | 1.5 | 2 = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(next);
    player.setPlaybackRate(next);
  }, [speed, player]);

  const sentTailColor = bubbleColor || Colors.primary;
  const waveformBars = useMemo(() => generateWaveform(message.id), [message.id]);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = () => {
    if (!message.uri) return;
    if (isPlaying) player.pause();
    else player.play();
  };

  return (
    <>
      {!isMe && <View style={[styles.tailReceived, { borderTopColor: receivedBubbleBg }]} />}
      <View
        style={[
          styles.bubble,
          styles.audioBubble,
          isMe ? styles.bubbleMe : styles.bubbleOther,
          isMe && bubbleColor ? { backgroundColor: bubbleColor } : null,
          !isMe && { backgroundColor: receivedBubbleBg },
        ]}
      >
        {replyPreview}
        <View style={styles.audioRow}>
          <TouchableOpacity
            style={[
              styles.audioPlayBtn,
              { backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : Colors.primary + '15' },
            ]}
            onPress={handlePlayPause}
            disabled={!message.uri}
          >
            <Feather
              name={isPlaying ? 'pause' : 'play'}
              size={16}
              color={isMe ? '#FFF' : Colors.primary}
              style={{ marginLeft: isPlaying ? 0 : 2 }}
            />
          </TouchableOpacity>
          {/* Waveform bars */}
          <View style={styles.audioWaveform}>
            {waveformBars.map((amp, i) => {
              const played = i / waveformBars.length <= progress;
              return (
                <View
                  key={i}
                  style={[
                    styles.waveBar,
                    {
                      height: Math.max(3, amp * 22),
                      backgroundColor: played
                        ? (isMe ? 'rgba(255,255,255,0.95)' : Colors.primary)
                        : (isMe ? 'rgba(255,255,255,0.3)' : Colors.border),
                    },
                  ]}
                />
              );
            })}
          </View>
          <Text style={[styles.audioTime, isMe ? styles.textMe : styles.textOther]}>
            {formatDuration(isPlaying ? currentSecs : (message.duration ?? 0))}
          </Text>
          <TouchableOpacity onPress={handleSpeedToggle} style={styles.speedBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Text style={[styles.speedText, { color: isMe ? 'rgba(255,255,255,0.8)' : Colors.primary }]}>
              {speed === 1 ? '1×' : speed === 1.5 ? '1.5×' : '2×'}
            </Text>
          </TouchableOpacity>
        </View>
        {metaRow}
      </View>
      {isMe && <View style={[styles.tailSent, { borderTopColor: sentTailColor }]} />}
    </>
  );
});

// ----------------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------------
export const ChatMessageBubble = memo(function ChatMessageBubble({
  message,
  onLongPress,
  onImagePress,
  onPayPress,
  bubbleColor,
  isLastInGroup = true,
  isNew = false,
}: ChatMessageBubbleProps) {
  const { colors: Colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(Colors, isDark), [Colors, isDark]);
  const isMe = message.sender === 'me';

  // Spring-in animation for newly sent/received messages
  const springAnim = useRef(new Animated.Value(isNew ? 0.7 : 1)).current;
  const fadeAnim = useRef(new Animated.Value(isNew ? 0 : 1)).current;
  useEffect(() => {
    if (isNew) {
      Animated.parallel([
        Animated.spring(springAnim, { toValue: 1, friction: 7, tension: 140, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Tap-to-see-full-timestamp
  const [showFullTime, setShowFullTime] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlePress = useCallback(() => {
    setShowFullTime(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setShowFullTime(false), 2500);
  }, []);
  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  const fullTimestamp = useMemo(() => {
    const d = new Date(message.timestamp);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
      ' · ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [message.timestamp]);
  const receivedBubbleBg = isDark ? Colors.surface : '#FFFFFF';
  const sentTailColor = bubbleColor || Colors.primary;
  const isImageType = message.type === 'image';
  const docIcon = getDocIcon(message.mimeType);
  const replyInfo = message.replyToMessage;

  // Detect payment messages sent as E2EE JSON text (persisted via sendText)
  const paymentData = useMemo(() => {
    if (message.type === 'payment') {
      return { amount: message.paymentAmount ?? 0, mode: message.paymentMode ?? 'send', status: message.paymentStatus };
    }
    if (typeof message.text === 'string' && message.text.startsWith('{"__payment":')) {
      try {
        const p = JSON.parse(message.text);
        if (p.__payment === true) return { amount: p.amount ?? 0, mode: p.mode ?? 'send', status: p.status as typeof message.paymentStatus };
      } catch {}
    }
    return null;
  }, [message.type, message.text, message.paymentAmount, message.paymentMode, message.paymentStatus]);

  const expiryLabel = useMemo(() => {
    if (!message.expiresAt || message.expiresAt <= 0) return null;
    const remaining = message.expiresAt - Date.now();
    if (remaining <= 0) return null;
    if (remaining < 60_000) return `${Math.ceil(remaining / 1000)}s`;
    if (remaining < 3_600_000) return `${Math.ceil(remaining / 60_000)}m`;
    if (remaining < 86_400_000) return `${Math.ceil(remaining / 3_600_000)}h`;
    return `${Math.ceil(remaining / 86_400_000)}d`;
  }, [message.expiresAt]);

  const statusIcon = useMemo(() => {
    if (!isMe || !message.status) return null;
    const gray = 'rgba(255,255,255,0.6)';
    const blue = '#53BDEB';
    if (message.status === 'sent') {
      return <Feather name="check" size={12} color={gray} style={styles.statusIcon} />;
    }
    if (message.status === 'delivered') {
      return (
        <View style={styles.doubleCheck}>
          <Feather name="check" size={12} color={gray} />
          <Feather name="check" size={12} color={gray} style={styles.secondCheck} />
        </View>
      );
    }
    if (message.status === 'read') {
      return (
        <View style={styles.doubleCheck}>
          <Feather name="check" size={12} color={blue} />
          <Feather name="check" size={12} color={blue} style={styles.secondCheck} />
        </View>
      );
    }
    return null;
  }, [isMe, message.status, styles.statusIcon, styles.doubleCheck, styles.secondCheck]);

  const hasCaption = !!message.caption;
  const overlayMeta = isImageType && !hasCaption;

  const timerColor = isMe ? 'rgba(255,255,255,0.75)' : '#9CA3AF';
  const metaRow = (
    <View style={[styles.metaContainer, overlayMeta && styles.metaContainerOverlay]}>
      {message.isStarred && (
        <Feather name="star" size={10} color={isMe ? 'rgba(255,255,255,0.8)' : '#F59E0B'} style={{ marginRight: 4 }} />
      )}
      {message.isEdited && (
        <Text style={[styles.editedLabel, isMe ? styles.timeTextMe : styles.timeTextOther, overlayMeta && styles.timeTextOverlay]}>
          edited ·{' '}
        </Text>
      )}
      {expiryLabel && (
        <View style={styles.expiryBadge}>
          <Feather name="clock" size={10} color={timerColor} />
          <Text style={[styles.expiryText, { color: timerColor }]}>{expiryLabel}</Text>
        </View>
      )}
      <Text style={[styles.timeText, isMe ? styles.timeTextMe : styles.timeTextOther, overlayMeta && styles.timeTextOverlay]}>
        {showFullTime ? fullTimestamp : message.time}
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

  // Bubble radius overrides for grouped messages (not the last in a group)
  const groupedBubbleStyle = !isLastInGroup
    ? { borderBottomRightRadius: isMe ? 16 : undefined, borderBottomLeftRadius: isMe ? undefined : 16 }
    : null;

  // URL detection for link preview (text messages only)
  const firstUrl = useMemo(() => {
    if (message.type && message.type !== 'text') return null;
    if (!message.text) return null;
    return extractFirstUrl(message.text);
  }, [message.type, message.text]);

  return (
    <Animated.View style={[styles.bubbleWrapper, { opacity: fadeAnim, transform: [{ scale: springAnim }] }]}>
      <TouchableOpacity
        onPress={handlePress}
        onLongPress={onLongPress}
        delayLongPress={250}
        activeOpacity={0.9}
        style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowOther]}
      >
        {isImageType && message.uri ? (
          <TouchableOpacity
            activeOpacity={0.95}
            onPress={() => onImagePress?.(message.uri!)}
            onLongPress={onLongPress}
            delayLongPress={250}
            style={[
              styles.imageBubble,
              isMe ? styles.bubbleMe : styles.bubbleOther,
              isMe && bubbleColor ? { backgroundColor: bubbleColor } : null,
              !isMe && { backgroundColor: receivedBubbleBg },
              hasCaption && { padding: 4 },
              groupedBubbleStyle,
            ]}
          >
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
          </TouchableOpacity>
        ) : message.type === 'video' && message.uri ? (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => onImagePress?.(message.uri!)}
            onLongPress={onLongPress}
            delayLongPress={250}
            style={[
              styles.imageBubble,
              isMe ? styles.bubbleMe : styles.bubbleOther,
              isMe && bubbleColor ? { backgroundColor: bubbleColor } : null,
              !isMe && { backgroundColor: receivedBubbleBg },
              groupedBubbleStyle,
            ]}
          >
            <Image
              source={{ uri: message.thumbnailUri ?? message.uri }}
              style={styles.imageContent}
              resizeMode="cover"
            />
            <View style={styles.videoOverlay}>
              <View style={styles.videoPlayBtn}>
                <Feather name="play" size={22} color="#fff" style={{ marginLeft: 3 }} />
              </View>
              {!!message.duration && (
                <Text style={styles.videoDuration}>
                  {Math.floor(message.duration / 60)}:{String(Math.floor(message.duration % 60)).padStart(2, '0')}
                </Text>
              )}
            </View>
            <View style={styles.imageOverlay}>{metaRow}</View>
          </TouchableOpacity>
        ) : message.type === 'document' ? (
          <>
            {!isMe && (
              <View style={[styles.tailReceived, !isLastInGroup && styles.tailHidden, { borderTopColor: receivedBubbleBg }]} />
            )}
            <View
              style={[
                styles.bubble,
                styles.docBubble,
                isMe ? styles.bubbleMe : styles.bubbleOther,
                isMe && bubbleColor ? { backgroundColor: bubbleColor } : null,
                !isMe && { backgroundColor: receivedBubbleBg },
                groupedBubbleStyle,
              ]}
            >
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
            {isMe && (
              <View style={[styles.tailSent, !isLastInGroup && styles.tailHidden, { borderTopColor: sentTailColor }]} />
            )}
          </>
        ) : message.type === 'audio' ? (
          <AudioBubbleInner
            message={message}
            isMe={isMe}
            bubbleColor={bubbleColor}
            replyPreview={replyPreview}
            metaRow={metaRow}
            styles={styles}
            Colors={Colors}
            receivedBubbleBg={receivedBubbleBg}
          />
        ) : paymentData ? (
          <View style={styles.paymentCard}>
            <View style={styles.paymentBrand}>
              <View style={styles.paymentBrandDot}>
                <Text style={styles.paymentBrandDotText}>₵</Text>
              </View>
              <Text style={styles.paymentBrandLabel}>AZA Pay</Text>
            </View>
            <Text style={styles.paymentAmount}>
              GH¢{paymentData.amount.toFixed(2)}
            </Text>
            <Text style={styles.paymentSubtitle}>
              {paymentData.mode === 'request'
                ? isMe ? 'Payment Request' : 'Requested'
                : isMe ? 'Sent' : 'Received'}
            </Text>
            {!isMe && paymentData.mode === 'request' && paymentData.status === 'pending' && (
              <TouchableOpacity
                style={styles.paymentPayBtn}
                activeOpacity={0.85}
                onPress={() => onPayPress?.(paymentData.amount)}
              >
                <Text style={styles.paymentPayBtnText}>Pay GH¢{paymentData.amount.toFixed(2)}</Text>
              </TouchableOpacity>
            )}
            {paymentData.status && paymentData.status !== 'pending' && (
              <View style={[styles.paymentStatusBadge, paymentData.status === 'paid' ? styles.paymentStatusPaid : styles.paymentStatusDeclined]}>
                <Text style={styles.paymentStatusText}>
                  {paymentData.status === 'paid' ? 'Paid' : 'Declined'}
                </Text>
              </View>
            )}
            <View style={[styles.metaContainer, { marginTop: 8 }]}>
              <Text style={[styles.timeText, styles.timeTextPayment]}>{message.time}</Text>
            </View>
          </View>
        ) : (
          <>
            {!isMe && (
              <View style={[styles.tailReceived, !isLastInGroup && styles.tailHidden, { borderTopColor: receivedBubbleBg }]} />
            )}
            <View
              style={[
                styles.bubble,
                isMe ? styles.bubbleMe : styles.bubbleOther,
                isMe && bubbleColor ? { backgroundColor: bubbleColor } : null,
                !isMe && { backgroundColor: receivedBubbleBg },
                groupedBubbleStyle,
              ]}
            >
              {replyPreview}
              <FormattedText
                text={message.text}
                style={[styles.text, isMe ? styles.textMe : styles.textOther]}
              />
              {firstUrl && <LinkPreviewCard url={firstUrl} isMe={isMe} />}
              {metaRow}
            </View>
            {isMe && (
              <View style={[styles.tailSent, !isLastInGroup && styles.tailHidden, { borderTopColor: sentTailColor }]} />
            )}
          </>
        )}
      </TouchableOpacity>

      {/* Reactions rendered outside the TouchableOpacity so they don't trigger long-press */}
      <ReactionBar messageId={message.id} isMe={isMe} />
    </Animated.View>
  );
});


// ----------------------------------------------------------------------------
// Typing indicator — placed here as it uses the same style factory
// ----------------------------------------------------------------------------
export const ChatTypingIndicator = memo(function ChatTypingIndicator() {
  const { colors: Colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(Colors, isDark), [Colors, isDark]);
  const receivedBubbleBg = isDark ? Colors.surface : '#FFFFFF';
  return (
    <View style={[styles.messageRow, styles.messageRowOther]}>
      <View style={[styles.tailReceived, { borderTopColor: receivedBubbleBg }]} />
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
const createStyles = (Colors: ThemeColors, isDark: boolean) => {
  const receivedBubbleBg = isDark ? Colors.surface : '#FFFFFF';
  return StyleSheet.create({
    bubbleWrapper: { width: '100%' },
    messageRow: { flexDirection: 'row', width: '100%', alignItems: 'flex-end' },
    messageRowMe: { justifyContent: 'flex-end' },
    messageRowOther: { justifyContent: 'flex-start' },
    bubble: {
      maxWidth: '75%',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      borderRadius: 16,
    },
    bubbleMe: { backgroundColor: Colors.primary, borderBottomRightRadius: 0 },
    bubbleOther: { backgroundColor: receivedBubbleBg, borderRadius: 16, borderBottomLeftRadius: 0 },
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
    doubleCheck: { flexDirection: 'row', alignItems: 'center', marginLeft: 4 },
    secondCheck: { marginLeft: -6 },
    tailSent: {
      width: 0,
      height: 0,
      borderTopWidth: 9,
      borderLeftWidth: 8,
      borderTopColor: Colors.primary,
      borderLeftColor: 'transparent',
    },
    tailReceived: {
      width: 0,
      height: 0,
      borderTopWidth: 9,
      borderRightWidth: 8,
      borderTopColor: receivedBubbleBg,
      borderRightColor: 'transparent',
    },
    tailHidden: { opacity: 0 },
    expiryBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, marginRight: 4 },
    expiryText: { ...Typography.caption, fontSize: 10, fontWeight: '600' },
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
      height: 24,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    waveBar: {
      flex: 1,
      borderRadius: 2,
      minHeight: 3,
    },
    speedBtn: {
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: 'rgba(128,128,128,0.15)',
    },
    speedText: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: -0.3,
    },
    editedLabel: {
      ...Typography.caption,
      fontSize: 10,
      fontStyle: 'italic',
    },
    // Video bubble overlay
    videoOverlay: {
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    videoPlayBtn: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    videoDuration: {
      position: 'absolute',
      bottom: 8,
      right: 10,
      color: '#fff',
      fontSize: 12,
      fontWeight: '600',
      textShadowColor: 'rgba(0,0,0,0.6)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
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
    replyPreviewMe: { backgroundColor: 'rgba(255,255,255,0.15)' },
    replyPreviewOther: { backgroundColor: 'rgba(0,0,0,0.05)' },
    replyBar: { width: 3 },
    replyContent: { flex: 1, paddingHorizontal: 8, paddingVertical: 4 },
    replySender: {
      ...Typography.caption,
      fontSize: 11,
      fontWeight: '700',
      marginBottom: 1,
    },
    replySenderMe: { color: 'rgba(255,255,255,0.85)' },
    replySenderOther: { color: Colors.primary },
    replyText: { ...Typography.caption, fontSize: 12, lineHeight: 16 },
    replyTextMe: { color: 'rgba(255,255,255,0.65)' },
    replyTextOther: { color: Colors.textSecondary },
    // Payment card bubble
    paymentCard: {
      backgroundColor: '#1C1C1E',
      borderRadius: 20,
      padding: Spacing.lg,
      width: 220,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 8,
    },
    paymentBrand: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.md },
    paymentBrandDot: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: Colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    paymentBrandDotText: { color: '#fff', fontSize: 12, fontWeight: '700', lineHeight: 14 },
    paymentBrandLabel: { color: 'rgba(255,255,255,0.6)', ...Typography.caption, fontWeight: '600', fontSize: 13 },
    paymentAmount: { color: '#fff', fontSize: 36, fontWeight: '700', letterSpacing: -1, lineHeight: 42 },
    paymentSubtitle: {
      color: 'rgba(255,255,255,0.5)',
      ...Typography.caption,
      fontSize: 13,
      marginTop: 2,
      marginBottom: Spacing.md,
    },
    paymentPayBtn: {
      backgroundColor: '#fff',
      borderRadius: Radius.full,
      paddingVertical: 10,
      alignItems: 'center',
      marginBottom: 4,
    },
    paymentPayBtnText: { color: '#000', fontWeight: '700', fontSize: 15 },
    paymentStatusBadge: {
      borderRadius: Radius.full,
      paddingVertical: 6,
      paddingHorizontal: Spacing.md,
      alignSelf: 'flex-start',
      marginBottom: 4,
    },
    paymentStatusPaid: { backgroundColor: Colors.primary + '33' },
    paymentStatusDeclined: { backgroundColor: '#EF444433' },
    paymentStatusText: { color: '#fff', ...Typography.caption, fontWeight: '600', fontSize: 12 },
    timeTextPayment: { color: 'rgba(255,255,255,0.4)' },
  });
};
