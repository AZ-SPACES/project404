import { ThemeColors } from '../../../../theme';
import { createStyles } from './styles';

export type Page =
  | 'loading'
  | 'intro'
  | 'under_review'
  | 'rejected'
  | 'suspended'
  | 'dashboard'
  | 'cash_in'
  | 'redeem';

export interface AgentData {
  status: string;            // NONE | PENDING | ACTIVE | SUSPENDED | REJECTED
  tier?: string;
  code?: string | null;
  floatBalance?: number;
  commissionAccruedGhs?: number;
  floatLimit?: number | null;
}

export interface NavProps {
  navigate: (page: Page) => void;
  goBack: () => void;
  agent: AgentData | null;
  refresh: () => void;
  Colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}
