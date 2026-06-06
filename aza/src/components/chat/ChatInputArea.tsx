import React, { memo, useMemo, useRef, useCallback, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Platform } from 'react-native';
import { Feather } from '@react-native-vector-icons/feather';
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../theme';
import type { AttachmentAnchor, ReplyInfo } from './chatTypes';

// ----------------------------------------------------------------------------
// Props
// ----------------------------------------------------------------------------
type ChatInputAreaProps = {
  message: string;
  setMessage: (val: string) => void;
  onSend: () => void;
  onAddPress: (anchor: AttachmentAnchor) => void;
  isAddOpen: boolean;
  replyTo?: ReplyInfo | null;
  onCancelReply?: () => void;
  onSendAudio?: (uri: string, duration: number) => void;
  onScheduleSend?: (delaySecs: number) => void;
};

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------
export const ChatInputArea = memo(function ChatInputArea({
  message,
  setMessage,
  onSend,
  onAddPress,
  isAddOpen,
  replyTo,
  onCancelReply,
  onSendAudio,
  onScheduleSend,
}: ChatInputAreaProps) {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.background === '#121212';
  const styles = useMemo(() => createStyles(Colors, isDark), [Colors, isDark]);
  const addButtonRef = useRef<React.ElementRef<typeof TouchableOpacity>>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Audio recording state
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);

  const showIcon = false; // no icon in input field
  const isMessageEmpty = !message.trim();
  const recordMode = useRef<'none' | 'tap' | 'hold'>('none');

  // Handle audio timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordDuration(prev => prev + 1);
      }, 1000);
    } else {
      setRecordDuration(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const handleStartRecording = useCallback(async () => {
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) return;
      await AudioModule.setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  }, [audioRecorder]);

  const handleStopRecording = useCallback(async () => {
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      setIsRecording(false);
      if (uri && onSendAudio && recordDuration > 0) {
        onSendAudio(uri, recordDuration);
      }
    } catch (err) {
      console.error('Failed to stop recording', err);
      setIsRecording(false);
    }
  }, [audioRecorder, onSendAudio, recordDuration]);

  const handleCancelRecording = useCallback(async () => {
    try {
      await audioRecorder.stop();
    } catch (e) {}
    setIsRecording(false);
    recordMode.current = 'none';
  }, [audioRecorder]);

  const handleMicPress = useCallback(() => {
    if (recordMode.current === 'none' && !isRecording) {
      handleStartRecording();
      recordMode.current = 'tap';
    } else if (recordMode.current === 'tap' && isRecording) {
      handleStopRecording();
      recordMode.current = 'none';
    }
  }, [isRecording, handleStartRecording, handleStopRecording]);

  const handleMicLongPress = useCallback(() => {
    if (!isRecording) {
      handleStartRecording();
      recordMode.current = 'hold';
    }
  }, [isRecording, handleStartRecording]);

  const handleMicPressOut = useCallback(() => {
    if (recordMode.current === 'hold') {
      handleStopRecording();
      recordMode.current = 'none';
    }
  }, [handleStopRecording]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAddPress = useCallback(() => {
    addButtonRef.current?.measure(
      (_x: number, _y: number, width: number, _height: number, _pageX: number, pageY: number) => {
        const CARD_HEIGHT_ESTIMATE = 290;
        onAddPress({ top: pageY - CARD_HEIGHT_ESTIMATE - 8, left: _pageX, buttonWidth: width });
      },
    );
  }, [onAddPress]);

  const handleFocus = useCallback(() => setIsFocused(true), []);
  const handleBlur = useCallback(() => setIsFocused(false), []);

  return (
    <View>
      {replyTo ? (
        <View style={styles.replyBanner}>
          <View style={[styles.replyBannerBar, { backgroundColor: Colors.primary }]} />
          <View style={styles.replyBannerContent}>
            <Text style={styles.replyBannerSender} numberOfLines={1}>
              Replying to {replyTo.sender === 'me' ? 'yourself' : 'them'}
            </Text>
            <Text style={styles.replyBannerText} numberOfLines={1}>
              {replyTo.text}
            </Text>
          </View>
          <TouchableOpacity onPress={onCancelReply} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="x" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.container}>
        {!isRecording && (
          <TouchableOpacity
            ref={addButtonRef}
            style={[styles.actionButton, isAddOpen && styles.actionButtonActive]}
            activeOpacity={0.8}
            onPress={handleAddPress}
          >
            <Feather name={isAddOpen ? 'x' : 'plus'} size={22} color={Colors.white} />
          </TouchableOpacity>
        )}

        <View style={[styles.inputWrapper, isRecording && styles.recordingWrapper]}>
          {isRecording ? (
            <View style={styles.recordingContent}>
              <View style={styles.recordingIndicator} />
              <Text style={styles.recordingTime}>{formatDuration(recordDuration)}</Text>
              <TouchableOpacity onPress={handleCancelRecording} style={styles.cancelRecordBtn}>
                <Text style={styles.cancelRecordText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {showIcon && (
                <Feather name="message-square" size={20} color={Colors.textSecondary} style={styles.icon} />
              )}
              <TextInput
                underlineColorAndroid="transparent"
                style={styles.textInput}
                placeholder="Type here"
                placeholderTextColor={Colors.textSecondary}
                value={message}
                onChangeText={setMessage}
                onFocus={handleFocus}
                onBlur={handleBlur}
                multiline
                accessibilityLabel="Message input"
              />
            </>
          )}
        </View>

        {isMessageEmpty ? (
          <TouchableOpacity 
            style={[styles.actionButton, isRecording && { backgroundColor: '#EF4444' }]} 
            activeOpacity={0.8} 
            onPress={handleMicPress}
            onLongPress={handleMicLongPress}
            onPressOut={handleMicPressOut}
          >
            <Feather name={isRecording ? "stop-circle" : "mic"} size={20} color={Colors.white} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.actionButton}
            activeOpacity={0.8}
            onPress={onSend}
            onLongPress={onScheduleSend ? () => onScheduleSend(0) : undefined}
            delayLongPress={500}
          >
            <Feather name="send" size={20} color={Colors.white} style={styles.sendIcon} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

// ----------------------------------------------------------------------------
// Styles
// ----------------------------------------------------------------------------
const createStyles = (Colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
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
      backgroundColor: Colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionButtonActive: { backgroundColor: Colors.textPrimary },
    inputWrapper: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? Colors.surface : Colors.white,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: isDark ? Colors.border : 'rgba(0,0,0,0.1)',
      paddingHorizontal: Spacing.md,
      minHeight: 44,
      maxHeight: 120,
    },
    icon: { marginRight: Spacing.sm },
    textInput: {
      flex: 1,
      ...Typography.body,
      fontSize: 15,
      color: Colors.textPrimary,
      paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    },
    sendIcon: { marginRight: 2, marginTop: 2 },
    recordingWrapper: {
      backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.05)',
      borderColor: isDark ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.2)',
    },
    recordingContent: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    },
    recordingIndicator: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: '#EF4444',
      marginRight: Spacing.sm,
    },
    recordingTime: {
      ...Typography.body,
      fontWeight: '600',
      color: Colors.textPrimary,
      flex: 1,
    },
    cancelRecordBtn: {
      paddingHorizontal: Spacing.sm,
    },
    cancelRecordText: {
      ...Typography.caption,
      color: Colors.textSecondary,
      fontWeight: '600',
    },
    // Reply banner
    replyBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: Spacing.lg,
      paddingRight: Spacing.md,
      backgroundColor: isDark ? Colors.surface : '#F9FAFB',
      borderTopLeftRadius: 8,
      borderTopRightRadius: 8,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: Colors.border,
      overflow: 'hidden',
    },
    replyBannerBar: {
      width: 3,
      alignSelf: 'stretch',
    },
    replyBannerContent: {
      flex: 1,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    replyBannerSender: {
      ...Typography.caption,
      fontSize: 12,
      fontWeight: '600',
      color: Colors.primary,
      marginBottom: 1,
    },
    replyBannerText: {
      ...Typography.caption,
      fontSize: 13,
      color: Colors.textSecondary,
    },
  });

