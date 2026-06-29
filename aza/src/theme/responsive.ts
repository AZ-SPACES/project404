import { useWindowDimensions } from 'react-native';

/**
 * Responsive breakpoints for Aza.
 *
 * IMPORTANT: this is driven by `useWindowDimensions()`, NOT `Dimensions.get('window')`.
 * On iPad the app window can be resized at runtime (rotation, Split View, Slide Over,
 * Stage Manager), and `Dimensions.get()` is read-once so it goes stale. Always size
 * tablet-aware UI from the `useResponsive()` hook below.
 */
export const Breakpoints = {
  /** >= this width is treated as a tablet (iPad mini portrait is 744pt). */
  tablet: 700,
  /** >= this width is a large tablet / full-screen iPad Pro. */
  largeTablet: 1000,
} as const;

/** Max readable width for single-column content on big screens. */
export const ContentMaxWidth = {
  /** Forms, settings, chat threads, single-column flows. */
  normal: 640,
  /** Wider reading surfaces (dashboards, lists that benefit from more room). */
  wide: 820,
} as const;

export interface ResponsiveInfo {
  width: number;
  height: number;
  /** True on iPad-sized windows (also true for an iPad in Split View at >= 700pt). */
  isTablet: boolean;
  /** True on full-screen large iPads. */
  isLargeTablet: boolean;
  /** True when the window is wider than it is tall. */
  isLandscape: boolean;
  /**
   * Whether a master-detail (two-pane) layout is appropriate. Only when the window
   * is genuinely wide — a portrait iPad or a narrow Split View stays single-column.
   */
  canSplitView: boolean;
}

export function useResponsive(): ResponsiveInfo {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= Breakpoints.tablet;
  const isLargeTablet = width >= Breakpoints.largeTablet;
  const isLandscape = width > height;
  return {
    width,
    height,
    isTablet,
    isLargeTablet,
    isLandscape,
    canSplitView: width >= Breakpoints.largeTablet,
  };
}
