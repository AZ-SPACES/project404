export const Colors = {
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
} as const;

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