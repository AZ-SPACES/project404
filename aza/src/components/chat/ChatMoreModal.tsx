import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../theme';
import type { MoreAction, MenuAnchor } from './chatTypes';
import { MENU_WIDTH } from './chatTypes';

// ----------------------------------------------------------------------------
// Props
// ----------------------------------------------------------------------------
type ChatMoreModalProps = {
  visible: boolean;
  isDark: boolean;
  isMuted: boolean;
  contactName: string;
  anchor: MenuAnchor | null;
  onClose: () => void;
  actions: MoreAction[];
};

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------
export const ChatMoreModal = memo(function ChatMoreModal({
  visible,
  isDark,
  anchor,
  onClose,
  actions,
}: ChatMoreModalProps) {
  const { colors: Colors } = useAppTheme();
  const styles = useMemo(() => createStyles(Colors, isDark), [Colors, isDark]);

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
                <Text style={[styles.menuItemLabel, { color: action.color ?? Colors.textPrimary }]}>
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
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
