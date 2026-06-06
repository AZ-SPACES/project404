import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, Dimensions, Image } from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@react-native-vector-icons/feather';
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
  onSendMoney?: () => void;
  onRequestMoney?: () => void;
  onGif?: () => void;
  onLocation?: () => void;
  onContact?: () => void;
  onPoll?: () => void;
  onSticker?: () => void;
};

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------
const EXTRA_TILES_ROW1 = [
  { icon: 'film', label: 'GIF', color: '#EC4899' },
  { icon: 'map-pin', label: 'Location', color: '#10B981' },
] as const;

const EXTRA_TILES_ROW2 = [
  { icon: 'user', label: 'Contact', color: '#8B5CF6' },
  { icon: 'bar-chart-2', label: 'Poll', color: '#F59E0B' },
  { icon: 'smile', label: 'Sticker', color: '#06B6D4' },
] as const;

export const ChatAttachmentModal = memo(function ChatAttachmentModal({
  visible,
  isDark,
  anchor,
  onClose,
  onPhotos,
  onCamera,
  onDocument,
  onSendMoney,
  onRequestMoney,
  onGif,
  onLocation,
  onContact,
  onPoll,
  onSticker,
}: ChatAttachmentModalProps) {
  const { colors: Colors } = useAppTheme();
  const styles = useMemo(() => createStyles(Colors, isDark), [Colors, isDark]);
  const screenWidth = Dimensions.get('window').width;
  const CARD_WIDTH = Math.min(screenWidth - Spacing.lg * 2, 320);

  const handlers = useMemo(() => [onPhotos, onCamera, onDocument], [onPhotos, onCamera, onDocument]);
  const extraHandlers1 = useMemo(() => [onGif, onLocation], [onGif, onLocation]);
  const extraHandlers2 = useMemo(() => [onContact, onPoll, onSticker], [onContact, onPoll, onSticker]);
  const showRow1 = !!(onGif || onLocation);
  const showRow2 = !!(onContact || onPoll || onSticker);

  const cardLeft = anchor
    ? Math.max(Spacing.lg, Math.min(anchor.left, screenWidth - CARD_WIDTH - Spacing.lg))
    : Spacing.lg;

  const showMoneySection = !!(onSendMoney || onRequestMoney);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <BlurView intensity={20} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      </Pressable>
      {anchor && (
        <View style={[styles.card, { position: 'absolute', top: anchor.top, left: cardLeft, width: CARD_WIDTH }]}>
          {showMoneySection && (
            <>
              <View style={styles.moneySection}>
                <View style={styles.moneyHeader}>
                  <Image source={require('../../assets/aza-z.png')} style={styles.azaPayIcon} />
                  <Text style={styles.moneyTitle}>AZA Pay</Text>
                </View>
                <View style={styles.moneyActions}>
                  {onSendMoney && (
                    <TouchableOpacity style={styles.moneyBtn} onPress={onSendMoney} activeOpacity={0.85}>
                      <Feather name="arrow-up-right" size={16} color="#fff" />
                      <Text style={styles.moneyBtnLabel}>Send</Text>
                    </TouchableOpacity>
                  )}
                  {onRequestMoney && (
                    <TouchableOpacity style={[styles.moneyBtn, styles.moneyBtnSecondary]} onPress={onRequestMoney} activeOpacity={0.85}>
                      <Feather name="arrow-down-left" size={16} color={Colors.primary} />
                      <Text style={[styles.moneyBtnLabel, styles.moneyBtnLabelSecondary]}>Request</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              <View style={styles.divider} />
            </>
          )}
          <View style={styles.tilesRow}>
            {ATTACHMENT_TILES.map((tile, idx) => (
              <TouchableOpacity key={tile.label} style={styles.tile} onPress={handlers[idx]} activeOpacity={0.8}>
                <View style={styles.tileIcon}>
                  <Feather name={tile.icon as any} size={20} color={tile.color} />
                </View>
                <Text style={styles.tileLabel}>{tile.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {showRow1 && (
            <View style={[styles.tilesRow, { borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', paddingTop: 0 }]}>
              {EXTRA_TILES_ROW1.map((tile, idx) => {
                const handler = extraHandlers1[idx];
                if (!handler) return null;
                return (
                  <TouchableOpacity key={tile.label} style={styles.tile} onPress={handler} activeOpacity={0.8}>
                    <View style={styles.tileIcon}>
                      <Feather name={tile.icon as any} size={20} color={tile.color} />
                    </View>
                    <Text style={styles.tileLabel}>{tile.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          {showRow2 && (
            <View style={[styles.tilesRow, { borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', paddingTop: 0 }]}>
              {EXTRA_TILES_ROW2.map((tile, idx) => {
                const handler = extraHandlers2[idx];
                if (!handler) return null;
                return (
                  <TouchableOpacity key={tile.label} style={styles.tile} onPress={handler} activeOpacity={0.8}>
                    <View style={styles.tileIcon}>
                      <Feather name={tile.icon as any} size={20} color={tile.color} />
                    </View>
                    <Text style={styles.tileLabel}>{tile.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
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
      borderRadius: Radius.md,
      overflow: 'hidden',
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    },
    // Money (AZA Pay) section
    moneySection: {
      backgroundColor: isDark ? '#0a2200' : '#f0fce8',
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.sm,
      gap: Spacing.sm,
    },
    azaPayIcon: {
      width: 26,
      height: 26,
      borderRadius: 6,
    },
    moneyTitle: {
      ...Typography.body,
      fontWeight: '700',
      color: Colors.primary,
      fontSize: 14,
    },
    moneyHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    moneyActions: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    moneyBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: Colors.primary,
      borderRadius: Radius.sm,
      paddingVertical: 8,
      paddingHorizontal: Spacing.md,
    },
    moneyBtnSecondary: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: Colors.border,
    },
    moneyBtnLabel: {
      ...Typography.body,
      fontWeight: '500',
      color: '#fff',
      fontSize: 14,
    },
    moneyBtnLabelSecondary: {
      color: Colors.textPrimary,
    },
    divider: {
      height: 1,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    },
    // Regular attachment tiles
    tilesRow: {
      flexDirection: 'row',
      padding: Spacing.sm,
    },
    tile: {
      alignItems: 'center',
      gap: 6,
      flex: 1,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.xs,
    },
    tileIcon: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tileLabel: {
      ...Typography.caption,
      fontWeight: '500',
      color: Colors.textSecondary,
      fontSize: 12,
      textAlign: 'center',
    },
  });
