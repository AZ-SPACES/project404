import React from 'react';

export type MiniAppCategory =
  | 'Finance'
  | 'Bills & Utilities'
  | 'Entertainment'
  | 'Shopping'
  | 'Transport'
  | 'Business'
  | 'Productivity'
  | 'Games';

export interface MiniAppTheme {
  background: string;
  surface: string;
  primary: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
}

const DEFAULT_THEME: MiniAppTheme = {
  background: '#000000',
  surface: '#111111',
  primary: '#B7EE7A',
  textPrimary: '#FFFFFF',
  textSecondary: '#AAAAAA',
  border: '#333333',
};

export function resolveTheme(theme?: MiniAppTheme): MiniAppTheme {
  return theme ?? DEFAULT_THEME;
}

export interface MiniAppProps {
  onClose: () => void;
  /** Host app colors — used for loading states and custom headers. */
  theme?: MiniAppTheme;
}

export interface MiniAppMeta {
  id: string;
  name: string;
  description: string;
  /** Emoji icon or local image require */
  icon: string | any;
  /** Solid background color for the icon tile */
  color?: string;
  category: MiniAppCategory;
}

export interface MiniAppEntry extends MiniAppMeta {
  component: React.ComponentType<MiniAppProps>;
}
