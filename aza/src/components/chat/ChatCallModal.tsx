import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../theme';
import { MenuAnchor } from './chatTypes';

type ChatCallModalProps = {
  visible: boolean;
  isDark: boolean;
  anchor: MenuAnchor | null;
  onClose: () => void;
  onAudioCall: () => void;
  onVideoCall: () => void;
};

const MODAL_WIDTH = 200;

export const ChatCallModal = memo(function ChatCallModal({
  visible,
  isDark,
  anchor,
  onClose,
  onAudioCall,
  onVideoCall,
}: ChatCallModalProps) {
  const { colors: Colors } = useAppTheme();
  const styles = useMemo(() => createStyles(Colors, isDark), [Colors, isDark]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <BlurView intensity={20} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      </Pressable>
      {anchor && (
        <View
          style={[styles.menuCard, { position: 'absolute', top: anchor.top, right: anchor.right, width: MODAL_WIDTH }]}
          pointerEvents="box-none"
        >
          <View style={styles.caret} />
          <View style={styles.menuInner}>
            <TouchableOpacity style={[styles.menuItem, styles.menuItemBorder]} onPress={onAudioCall} activeOpacity={0.7}>
              <Feather name="phone" size={18} color={Colors.textPrimary} />
              <Text style={styles.menuItemLabel}>Voice Call</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.menuItem} onPress={onVideoCall} activeOpacity={0.7}>
              <Feather name="video" size={18} color={Colors.textPrimary} />
              <Text style={styles.menuItemLabel}>Video Call</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </Modal>
  );
});

const createStyles = (Colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
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
    menuItemLabel: { ...Typography.body, fontWeight: '500', color: Colors.textPrimary },
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
