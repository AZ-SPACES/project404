import React, { useCallback } from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Feather } from '@react-native-vector-icons/feather';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../../theme';

interface BackButtonProps {
  onPress: () => void;
  color?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export function BackButton({ onPress, color, size = 24, style }: BackButtonProps) {
  const { colors: Colors } = useAppTheme();

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [onPress]);

  return (
    <TouchableOpacity
      onPress={handlePress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityLabel="Go back"
      accessibilityRole="button"
      activeOpacity={0.6}
      style={[
        styles.button,
        { backgroundColor: Colors.isDark ? Colors.white10 : 'rgba(22, 51, 0, 0.04)' },
        style,
      ]}
    >
      <Feather name="chevron-left" size={size} color={color ?? Colors.textPrimary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
