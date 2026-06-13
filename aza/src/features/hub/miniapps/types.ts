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

export interface MiniAppProps {
  onClose: () => void;
  /** Host app colors passed down for loading states and custom headers. */
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
  /** Community apps: remote HTTPS URL rendered in a WebView. */
  url?: string;
  /** Community apps: permissions the app declared to the platform. */
  requestedPermissions?: string[];
  developerName?: string;
}

export interface MiniAppEntry extends MiniAppMeta {
  /** Native component — present for built-in apps. Absent for community (WebView) apps. */
  component?: React.ComponentType<MiniAppProps>;
}
