import React from 'react';

export type MiniAppCategory =
  | 'Finance'
  | 'Bills & Utilities'
  | 'Entertainment'
  | 'Shopping'
  | 'Transport'
  | 'Business';

export interface MiniAppMeta {
  id: string;
  name: string;
  description: string;
  /** Emoji icon rendered on the tile */
  icon: string;
  /** Solid background color for the icon tile */
  color: string;
  category: MiniAppCategory;
}

export interface MiniAppProps {
  /** Call to close the mini app player */
  onClose: () => void;
}

export interface MiniAppEntry extends MiniAppMeta {
  component: React.ComponentType<MiniAppProps>;
}
