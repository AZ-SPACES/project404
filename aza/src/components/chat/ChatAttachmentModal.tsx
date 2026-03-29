import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../theme';
import type { AttachmentAnchor } from './chatTypes';
import { ATTACHMENT_TILES } from './chatTypes';

// ----------------------------------------------------------------------------
// Props
// ----------------------------------------------------------------------------
type ChatAttachmentModalProps = {
  visible: boolean;
  isDark: boolean;
  anchor: AttachmentAnchor | null;
  onClose: () => void;
  onPhotos: () => void;
  onCamera: () => void;
  onDocument: () => void;
};

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------
export const ChatAttachmentModal = memo(function ChatAttachmentModal({
  visible,
  isDark,
  anchor,
  onClose,
  onPhotos,
  onCamera,
  onDocument,
}: ChatAttachmentModalProps) {
  const { colors: Colors } = useAppTheme();
  const styles = useMemo(() => createStyles(Colors, isDark), [Colors, isDark]);
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
// Styles
// ----------------------------------------------------------------------------
const createStyles = (Colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    card: {
      backgroundColor: isDark ? Colors.surface : Colors.white,
      borderRadius: Radius.lg,
      padding: Spacing.sm,
      flexDirection: 'row',
      elevation: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.14,
      shadowRadius: 16,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    },
    tile: {
      alignItems: 'center',
      gap: 8,
      flex: 1,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.xs,
    },
    tileIcon: {
      width: 56,
      height: 56,
      borderRadius: Radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tileLabel: {
      ...Typography.caption,
      fontWeight: '600',
      color: Colors.textSecondary,
      fontSize: 12,
      textAlign: 'center',
    },
  });
