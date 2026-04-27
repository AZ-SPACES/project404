import React, { memo, useMemo, useRef, useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
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
}: ChatInputAreaProps) {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.background === '#121212';
  const styles = useMemo(() => createStyles(Colors, isDark), [Colors, isDark]);
  const addButtonRef = useRef<React.ElementRef<typeof TouchableOpacity>>(null);
  const [isFocused, setIsFocused] = useState(false);

  const showIcon = !isFocused && !message;

  const handleAddPress = useCallback(() => {
    addButtonRef.current?.measure(
      (_x: number, _y: number, width: number, _height: number, _pageX: number, pageY: number) => {
        const CARD_HEIGHT_ESTIMATE = 130;
        onAddPress({ top: pageY - CARD_HEIGHT_ESTIMATE - 8, left: Spacing.lg, buttonWidth: width });
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
        <TouchableOpacity
          ref={addButtonRef}
          style={[styles.actionButton, isAddOpen && styles.actionButtonActive]}
          activeOpacity={0.8}
          onPress={handleAddPress}
        >
          <Feather name={isAddOpen ? 'x' : 'plus'} size={22} color={Colors.white} />
        </TouchableOpacity>

        <View style={styles.inputWrapper}>
          {showIcon && (
            <Feather name="message-square" size={20} color={Colors.textSecondary} style={styles.icon} />
          )}
          <TextInput
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
        </View>

        <TouchableOpacity style={styles.actionButton} activeOpacity={0.8} onPress={onSend}>
          <Feather name="send" size={20} color={Colors.white} style={styles.sendIcon} />
        </TouchableOpacity>
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
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Colors.border,
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

