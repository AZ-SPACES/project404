import { useDisplayContext } from '../providers/DisplayProvider';

export const LightColors = {
  primary:    '#174717',
  secondary:  '#B7EE7A',
  accent:     '#E6ECE1',
  error:      '#EA4335',
  warning:    '#FF6D00',
  info:       '#4285F4',
  textPrimary:   '#0E0F0C',
  textSecondary: '#5F6368',
  background: '#E6ECE1',
  surface:    '#F8F9FA',
  border:     '#DADCE0',
  white: '#FFFFFF',
  black: '#000000',
  white10: 'rgba(255, 255, 255, 0.1)',
  white20: 'rgba(255, 255, 255, 0.2)',
  white30: 'rgba(255, 255, 255, 0.3)',
  white40: 'rgba(255, 255, 255, 0.4)',
  white50: 'rgba(255, 255, 255, 0.5)',
  white60: 'rgba(255, 255, 255, 0.6)',
  white70: 'rgba(255, 255, 255, 0.7)',
  white80: 'rgba(255, 255, 255, 0.8)',
  white90: 'rgba(255, 255, 255, 0.9)',
  black10: 'rgba(0, 0, 0, 0.1)',
  black20: 'rgba(0, 0, 0, 0.2)',
  black30: 'rgba(0, 0, 0, 0.3)',
  black40: 'rgba(0, 0, 0, 0.4)',
  black50: 'rgba(0, 0, 0, 0.5)',
  black60: 'rgba(0, 0, 0, 0.6)',
  black70: 'rgba(0, 0, 0, 0.7)',
  black80: 'rgba(0, 0, 0, 0.8)',
  black90: 'rgba(0, 0, 0, 0.9)',
} as const;

export const DarkColors = {
  ...LightColors,
  primary:    '#174717',
  secondary:  '#B7EE7A',
  accent:     '#2D3748', 
  error:      '#F28B82', 
  warning:    '#FFB74D',
  info:       '#8AB4F8',
  textPrimary:   '#F8F9FA',
  textSecondary: '#9AA0A6',
  background: '#121212',
  surface:    '#1E1E1E',
  border:     '#3C4043',
} as const;

export type ThemeColors = {
  [K in keyof typeof LightColors]: string;
};

export function useAppTheme() {
  const { activeColorScheme } = useDisplayContext();
  const colors = activeColorScheme === 'dark' ? DarkColors : LightColors;
  return { colors };
}

export const Typography = {
  h1:      { fontSize: 32, fontWeight: '700' },
  h2:      { fontSize: 24, fontWeight: '600' },
  h3:      { fontSize: 18, fontWeight: '600' },
  bodyLg:  { fontSize: 16, fontWeight: '400' },
  body:    { fontSize: 14, fontWeight: '400' },
  caption: { fontSize: 12, fontWeight: '400' },
  button:  { fontSize: 16, fontWeight: '600' },
} as const;

export const Spacing = { xs:4, sm:8, md:16, lg:24, xl:32 } as const;
export const Radius  = { sm:8, md:12, lg:16, full:999 } as const;