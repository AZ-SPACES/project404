import React, { useEffect } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetwork } from '../../providers/NetworkProvider';
import { useAppTheme, Typography, Spacing, Radius } from '../../theme';
import Animated, { useAnimatedStyle, withTiming, useSharedValue } from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';

export function OfflineBanner() {
  const { isConnected, isInternetReachable } = useNetwork();
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  
  // Consider offline if explicitly disconnected or internet is unreachable
  const isOffline = isConnected === false || isInternetReachable === false;
  
  const visible = useSharedValue(0);

  useEffect(() => {
    visible.value = withTiming(isOffline ? 1 : 0, { duration: 300 });
  }, [isOffline, visible]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: visible.value,
      transform: [
        {
          translateY: (1 - visible.value) * -8,
        }
      ]
    };
  });

  // Use high-contrast background for better visibility
  const bannerBg = isDark ? colors.surface : colors.textPrimary;
  const textColor = isDark ? colors.textPrimary : colors.white;
  const iconColor = colors.error;

  return (
    <View style={[styles.container, { top: insets.top + Spacing.xs }]} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.banner,
          animatedStyle,
          { 
            backgroundColor: bannerBg,
            borderColor: isDark ? colors.border : colors.textPrimary,
          }
        ]}
        accessibilityLiveRegion="assertive"
        accessibilityLabel="Offline"
        pointerEvents={isOffline ? 'auto' : 'none'}
      >
        <MaterialIcons name="cloud-off" size={14} color={iconColor} />
        <Text style={[styles.text, { color: textColor }]}>
          Offline
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  text: {
    ...Typography.caption,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
});

