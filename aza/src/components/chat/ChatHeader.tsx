import React, { memo, useMemo, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions } from 'react-native';
import { Feather } from '@react-native-vector-icons/feather';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../theme';
import type { MenuAnchor } from './chatTypes';
import { BackButton } from '../ui/BackButton';

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
  isCallMenuOpen?: boolean;
  onCallPress?: (anchor: MenuAnchor) => void;
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
  isCallMenuOpen,
  onCallPress,
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

  const callButtonRef = useRef<React.ElementRef<typeof TouchableOpacity>>(null);
  
  const handleCallPress = useCallback(() => {
    callButtonRef.current?.measure(
      (_x: number, _y: number, width: number, height: number, pageX: number, pageY: number) => {
        const screenWidth = Dimensions.get('window').width;
        if (onCallPress) {
          onCallPress({ top: pageY + height + 6, right: screenWidth - pageX - width });
        }
      },
    );
  }, [onCallPress]);

  return (
    <View style={styles.header}>
      <BackButton onPress={onBack} style={styles.iconButton} />

      <TouchableOpacity
        style={styles.profileInfo}
        activeOpacity={0.7}
        onPress={onProfilePress}
        disabled={!onProfilePress}
      >
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatar} accessibilityLabel={name} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: isDark ? Colors.surface : '#e2e8f0', alignItems: 'center', justifyContent: 'center' }]}>
            <Feather name="user" size={24} color={Colors.textSecondary} />
          </View>
        )}
        <View style={styles.nameContainer}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          {online && <Text style={styles.onlineText}>online</Text>}
        </View>
      </TouchableOpacity>

      <View style={styles.rightActions}>
        <TouchableOpacity
          ref={callButtonRef}
          style={[styles.iconButton, isCallMenuOpen && styles.iconButtonActive]}
          activeOpacity={0.8}
          onPress={handleCallPress}
        >
          <Feather name="phone" size={20} color={isCallMenuOpen ? Colors.primary : Colors.textPrimary} />
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
