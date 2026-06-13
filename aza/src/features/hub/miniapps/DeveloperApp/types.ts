import { ThemeColors } from '../../../../theme';

export type Page = 'list' | 'create' | 'detail' | 'miniapps' | 'miniapp_submit' | 'miniapp_detail';

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
  merchantId?: string;
  merchantName?: string;
}

export interface NavProps {
  navigate: (page: Page, params?: any) => void;
  goBack: () => void;
  Colors: ThemeColors;
}

export interface MiniAppData {
  id: string;
  name: string;
  description: string;
  category: string;
  iconUrl: string;
  url: string;
  developerName: string;
  supportUrl: string | null;
  version: string;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED';
  requestedPermissions: string[];
  createdAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
}
