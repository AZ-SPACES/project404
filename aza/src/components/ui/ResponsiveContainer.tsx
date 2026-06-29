import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useResponsive, ContentMaxWidth } from '../../theme';

interface ResponsiveContainerProps {
  children: React.ReactNode;
  /**
   * Max content width on tablets. Defaults to `normal` (640pt) — good for forms,
   * settings, single-column flows. Use `wide` for dashboards/lists.
   */
  maxWidth?: number;
  style?: StyleProp<ViewStyle>;
  /** Inner content style (applied to the width-capped column). */
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * Centers single-column content and caps its width on tablets so screens designed
 * for phones don't stretch edge-to-edge on iPad. On phones it's a transparent
 * pass-through (no layout change), so it's safe to wrap any screen body.
 *
 * Usage:
 *   <ResponsiveContainer>
 *     ...existing phone screen body...
 *   </ResponsiveContainer>
 */
export function ResponsiveContainer({
  children,
  maxWidth = ContentMaxWidth.normal,
  style,
  contentStyle,
}: ResponsiveContainerProps) {
  const { isTablet } = useResponsive();

  if (!isTablet) {
    // Phone: no-op wrapper, preserves existing layout exactly.
    return <View style={[styles.flex, style]}>{children}</View>;
  }

  return (
    <View style={[styles.tabletOuter, style]}>
      <View style={[styles.tabletInner, { maxWidth }, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tabletOuter: {
    flex: 1,
    alignItems: 'center',
  },
  tabletInner: {
    flex: 1,
    width: '100%',
  },
});
