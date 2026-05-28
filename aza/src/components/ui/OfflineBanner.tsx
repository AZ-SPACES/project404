import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetwork } from '../../providers/NetworkProvider';
import { useAppTheme, Typography, Spacing, Radius } from '../../theme';
import Animated, { useAnimatedStyle, withTiming, useSharedValue, runOnJS, withSpring } from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { MaterialIcons } from '@react-native-vector-icons/material-icons';

export function OfflineBanner() {
  const { isConnected, isInternetReachable } = useNetwork();
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  
  // Consider offline if explicitly disconnected or internet is unreachable
  const isOffline = isConnected === false || isInternetReachable === false;
  const [isDismissed, setIsDismissed] = useState(false);
  
  const visible = useSharedValue(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    if (isOffline && !isDismissed) {
      visible.value = withTiming(1, { duration: 300 });
      translateX.value = withTiming(0, { duration: 300 });
      translateY.value = withTiming(0, { duration: 300 });
    } else {
      visible.value = withTiming(0, { duration: 300 });
    }
  }, [isOffline, isDismissed, visible, translateX, translateY]);

  // Reset dismissed state when network comes back online
  useEffect(() => {
    if (!isOffline) {
      setIsDismissed(false);
    }
  }, [isOffline]);

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  const panGesture = Gesture.Pan()
    .onChange((event) => {
      // Allow dragging in any direction
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      // Dismiss if dragged up
      if (event.translationY < -20 || event.velocityY < -500) {
        runOnJS(handleDismiss)();
      } else {
        // Otherwise, spring back to original position
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: visible.value,
      transform: [
        {
          translateX: translateX.value,
        },
        {
          translateY: translateY.value + (1 - visible.value) * -8,
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
      <GestureDetector gesture={panGesture}>
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
          pointerEvents={isOffline && !isDismissed ? 'auto' : 'none'}
        >
          <MaterialIcons name="cloud-off" size={14} color={iconColor} />
          <Text style={[styles.text, { color: textColor }]}>
            Offline
          </Text>
        </Animated.View>
      </GestureDetector>
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

