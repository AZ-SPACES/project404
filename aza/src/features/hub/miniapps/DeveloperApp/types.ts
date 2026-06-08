import { ThemeColors } from '../../../../theme';

export type Page = 'list' | 'create' | 'detail';

export interface OAuthClientData {
  id: string;
  clientId: string;
  clientSecret?: string; // only present right after create/rotate
  appName: string;
  appDescription?: string;
  logoUrl?: string;
  websiteUrl?: string;
  redirectUris: string[];
  allowedScopes: string[];
  active: boolean;
  createdAt?: string;
}

export interface NavProps {
  navigate: (page: Page, params?: any) => void;
  goBack: () => void;
  Colors: ThemeColors;
}
