import React, { memo, useMemo, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../theme';
import type { MenuAnchor } from './chatTypes';

// ----------------------------------------------------------------------------
// Props
// ----------------------------------------------------------------------------
type ChatHeaderProps = {
  name: string;
  avatar: string;
  online: boolean;
  onBack: () => void;
  onProfilePress?: () => void;
  isMenuOpen: boolean;
  onMorePress: (anchor: MenuAnchor) => void;
};

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------
export const ChatHeader = memo(function ChatHeader({
  name,
  avatar,
  online,
  onBack,
  onProfilePress,
  isMenuOpen,
  onMorePress,
}: ChatHeaderProps) {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.background === '#121212';
  const styles = useMemo(() => createStyles(Colors, isDark), [Colors, isDark]);
  const moreButtonRef = useRef<React.ElementRef<typeof TouchableOpacity>>(null);

  const handleMorePress = useCallback(() => {
    moreButtonRef.current?.measure(
      (_x: number, _y: number, width: number, height: number, pageX: number, pageY: number) => {
        const screenWidth = Dimensions.get('window').width;
        onMorePress({ top: pageY + height + 6, right: screenWidth - pageX - width });
      },
    );
  }, [onMorePress]);

  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.iconButton} onPress={onBack} activeOpacity={0.8}>
        <Feather name="chevron-left" size={24} color={Colors.textPrimary} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.profileInfo}
        activeOpacity={0.7}
        onPress={onProfilePress}
        disabled={!onProfilePress}
      >
        <Image source={{ uri: avatar }} style={styles.avatar} accessibilityLabel={name} />
        <View style={styles.nameContainer}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          {online && <Text style={styles.onlineText}>online</Text>}
        </View>
      </TouchableOpacity>

      <View style={styles.rightActions}>
        <TouchableOpacity style={styles.iconButton} activeOpacity={0.8}>
          <Feather name="video" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          ref={moreButtonRef}
          style={[styles.iconButton, isMenuOpen && styles.iconButtonActive]}
          activeOpacity={0.8}
          onPress={handleMorePress}
        >
          <Feather
            name="more-horizontal"
            size={20}
            color={isMenuOpen ? Colors.primary : Colors.textPrimary}
          />
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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      justifyContent: 'space-between',
    },
    iconButton: {
      width: 44,
      height: 44,
      borderRadius: Radius.full,
      backgroundColor: isDark ? Colors.surface : 'rgba(22,51,0,0.07)',
      borderWidth: 1,
      borderColor: Colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconButtonActive: {
      backgroundColor: isDark ? Colors.primary + '22' : Colors.primary + '15',
      borderColor: Colors.primary,
    },
    profileInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: Spacing.sm },
    avatar: { width: 44, height: 44, borderRadius: Radius.full, marginRight: Spacing.sm },
    nameContainer: { flex: 1, paddingRight: Spacing.sm },
    name: { ...Typography.bodyLg, fontWeight: '700', color: Colors.textPrimary },
    onlineText: { ...Typography.caption, fontWeight: '600', color: Colors.primary },
    rightActions: { flexDirection: 'row', gap: Spacing.sm },
  });
