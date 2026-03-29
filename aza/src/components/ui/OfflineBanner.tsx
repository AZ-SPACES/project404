import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetwork } from '../../providers/NetworkProvider';
import { useAppTheme, Typography, Spacing } from '../../theme';

export function OfflineBanner() {
  const { isConnected, isInternetReachable } = useNetwork();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  
  const isOffline = isConnected === false || isInternetReachable === false;
  
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: isOffline ? 1 : 0,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [isOffline, opacity]);

  return (
    <Animated.View
      style={[
        styles.banner, 
        { 
          opacity,
          backgroundColor: colors.error,
          paddingTop: Math.max(insets.top, Spacing.sm),
        }
      ]}
      accessibilityLiveRegion="assertive"
      accessibilityLabel="No internet connection"
      pointerEvents={isOffline ? 'auto' : 'none'}
    >
      <View style={styles.container}>
        <Text style={[styles.text, { color: colors.white }]}>
          No internet connection
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
  },
  container: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    ...Typography.caption,
    fontWeight: '600',
  },
});


