import React, { memo, useMemo, useRef, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, TextInput, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../theme';
import type { AttachmentAnchor } from './chatTypes';

// ----------------------------------------------------------------------------
// Props
// ----------------------------------------------------------------------------
type ChatInputAreaProps = {
  message: string;
  setMessage: (val: string) => void;
  onSend: () => void;
  onAddPress: (anchor: AttachmentAnchor) => void;
  isAddOpen: boolean;
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
}: ChatInputAreaProps) {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.background === '#121212';
  const styles = useMemo(() => createStyles(Colors, isDark), [Colors, isDark]);
  const addButtonRef = useRef<React.ElementRef<typeof TouchableOpacity>>(null);

  const handleAddPress = useCallback(() => {
    addButtonRef.current?.measure(
      (_x: number, _y: number, width: number, _height: number, _pageX: number, pageY: number) => {
        const CARD_HEIGHT_ESTIMATE = 130;
        onAddPress({ top: pageY - CARD_HEIGHT_ESTIMATE - 8, left: Spacing.lg, buttonWidth: width });
      },
    );
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
  });
