// Canonical light "docs" design tokens for the Aza developer area.
// Extracted from the guides page so every developer surface reads as one product:
// white content, gray-900 ink, a deep-green chrome (nav/sidebar) with a lime accent.

export const dev = {
  // Surfaces
  bg:        '#ffffff',
  bgSubtle:  '#f8f9fa',
  surface:   '#ffffff',
  // Ink ramp (all AA on white)
  ink:       '#111827', // gray-900 — headings
  body:      '#374151', // gray-700 — body copy
  muted:     '#6b7280', // gray-500 — secondary
  faint:     '#9ca3af', // gray-400 — tertiary / meta
  // Borders
  border:    '#e5e7eb', // gray-200
  borderSoft:'#f3f4f6', // gray-100
  // Brand
  green:     '#0e2a0e', // deep green — chrome
  greenLink: '#174717', // links / accent text
  green600:  '#2e7d2e',
  lime:      '#B7EE7A', // signature accent
  limeInk:   '#0e2a0e', // text on lime
} as const;

// Semantic colors for callouts / changelog badges (light-theme tuned).
export const semantic = {
  added:      { label: 'Added',      bg: '#eaf7e0', fg: '#1e6b23', ring: '#cdeab3' },
  changed:    { label: 'Changed',    bg: '#e8f0fe', fg: '#1a56db', ring: '#c7dbfb' },
  deprecated: { label: 'Deprecated', bg: '#fff2df', fg: '#b45309', ring: '#fbdca0' },
  fixed:      { label: 'Fixed',      bg: '#e7f6ec', fg: '#1b7a3d', ring: '#c3e9d1' },
  removed:    { label: 'Removed',    bg: '#fdeaea', fg: '#c62828', ring: '#f6c9c9' },
  security:   { label: 'Security',   bg: '#f5eafb', fg: '#7b1fa2', ring: '#e5c9f2' },
} as const;
