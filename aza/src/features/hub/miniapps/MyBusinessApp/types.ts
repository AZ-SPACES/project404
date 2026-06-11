import { ThemeColors } from '../../../../theme';
import { createStyles } from './styles';

export type Page =
  | 'loading'
  | 'intro'
  | 'under_review'
  | 'rejected'
  | 'suspended'
  | 'dashboard'
  | 'sessions'
  | 'create_session'
  | 'api_keys'
  | 'webhooks'
  | 'payouts'
  | 'store_qr'
  | 'customers'
  | 'disputes'
  | 'invoices'
  | 'settlements'
  | 'discount_codes'
  | 'audit_logs'
  | 'settings'
  | 'team'
  | 'plans';

export interface MerchantData {
  id: string;
  businessName: string;
  businessHandle: string;
  businessEmail?: string;
  businessPhone?: string;
  businessDescription?: string;
  logoUrl?: string;
  category?: string;
  status: string;
  balance?: number;
  currency?: string;
  totalVolume?: number;
  feeRateBps?: number;
  rejectionReason?: string;
  moreInfoRequest?: string;
  brandColor?: string;
  checkoutTagline?: string;
  supportEmail?: string;
  taxEnabled?: boolean;
  taxRate?: number;
  taxLabel?: string;
}

export interface NavProps {
  navigate: (page: Page) => void;
  goBack: () => void;
  merchant: MerchantData | null;
  onMerchantUpdate: (m: MerchantData) => void;
  Colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}
 
