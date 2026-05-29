import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ActivityIndicator,} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../../navigation/types';
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import { useAppTheme, Spacing } from '../../../../theme';
import { getMerchant } from '../../../../services/api';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../../lib/queryKeys';

import { Page, MerchantData, NavProps } from './types';
import { extractData } from './helpers';
import { createStyles } from './styles';

import IntroPage from './pages/IntroPage';
import UnderReviewPage from './pages/UnderReviewPage';
import DashboardPage from './pages/DashboardPage';
import SessionsPage from './pages/SessionsPage';
import CreateSessionPage from './pages/CreateSessionPage';
import ApiKeysPage from './pages/ApiKeysPage';
import WebhooksPage from './pages/WebhooksPage';
import PayoutsPage from './pages/PayoutsPage';
import StoreQrPage from './pages/StoreQrPage';
import CustomersPage from './pages/CustomersPage';
import DisputesPage from './pages/DisputesPage';
import InvoicesPage from './pages/InvoicesPage';
import SettlementsPage from './pages/SettlementsPage';
import DiscountCodesPage from './pages/DiscountCodesPage';
import AuditLogsPage from './pages/AuditLogsPage';

// Local interface just for the exported component props
interface LocalMiniAppProps {
  onClose?: () => void;
}

export default function MyBusinessApp({ onClose }: LocalMiniAppProps) {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [pageStack, setPageStack] = useState<Page[]>(['loading']);

  const navigate = useCallback((page: Page) => {
    setPageStack(prev => [...prev, page]);
  }, []);

  const goBack = useCallback(() => {
    setPageStack(prev => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  const { data: merchantData, isLoading, isError } = useQuery({
    queryKey: queryKeys.merchant(),
    queryFn: getMerchant,
    staleTime: 5 * 60_000,
    retry: (failureCount, error: any) =>
      error?.response?.status !== 404 && failureCount < 1,
  });

  const merchant: MerchantData | null = merchantData ? extractData(merchantData) : null;

  const handleMerchantUpdate = useCallback((_m: MerchantData) => {
    // Invalidation handled by React Query; query auto-refetches
  }, []);

  useEffect(() => {
    if (isLoading) { setPageStack(['loading']); return; }
    if (isError || !merchant || !merchant.status) { setPageStack(['intro']); return; }
    switch (merchant.status) {
      case 'ACTIVE': setPageStack(['dashboard']); break;
      case 'PENDING':
      case 'PENDING_KYB':
        navigation.navigate('MerchantKYBIntro', { merchantId: merchant.id });
        setPageStack(['intro']);
        break;
      case 'KYB_SUBMITTED':
      case 'KYB_UNDER_REVIEW':
      case 'MORE_INFO_REQUIRED': setPageStack(['under_review']); break;
      case 'SUSPENDED': setPageStack(['suspended']); break;
      case 'REJECTED': setPageStack(['rejected']); break;
      default: setPageStack(['under_review']);
    }
  }, [merchant, isLoading, isError, navigation]);

  const currentPage = pageStack[pageStack.length - 1];

  const navProps: NavProps = {
    navigate, goBack, merchant, onMerchantUpdate: handleMerchantUpdate, Colors, styles,
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'loading':
        return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;
      case 'intro':
        return <IntroPage {...navProps} />;
      case 'under_review':
        return <UnderReviewPage {...navProps} />;
      case 'suspended':
        return (
          <View style={[styles.center, { padding: Spacing.lg }]}>
            <MaterialIcons name="block" size={48} color={Colors.error || "#D1222E"} />
            <Text style={[styles.introTitle, { color: Colors.textPrimary, marginTop: Spacing.md }]}>Account Suspended</Text>
            <Text style={[styles.introSubtitle, { color: Colors.textSecondary }]}>
              Your merchant account has been suspended. Please contact support.
            </Text>
          </View>
        );
      case 'rejected':
        return (
          <View style={[styles.center, { padding: Spacing.lg }]}>
            <MaterialIcons name="cancel" size={48} color={Colors.error || "#D1222E"} />
            <Text style={[styles.introTitle, { color: Colors.textPrimary, marginTop: Spacing.md }]}>Application Rejected</Text>
            <Text style={[styles.introSubtitle, { color: Colors.textSecondary }]}>
              {merchant?.rejectionReason ?? 'Your KYB application was not approved. Please contact support for details.'}
            </Text>
          </View>
        );
      case 'dashboard':
        return <DashboardPage {...navProps} />;
      case 'sessions':
        return <SessionsPage {...navProps} />;
      case 'create_session':
        return <CreateSessionPage {...navProps} />;
      case 'api_keys':
        return <ApiKeysPage {...navProps} />;
      case 'webhooks':
        return <WebhooksPage {...navProps} />;
      case 'payouts':
        return <PayoutsPage {...navProps} />;
      case 'store_qr':
        return <StoreQrPage {...navProps} />;
      case 'customers':
        return <CustomersPage {...navProps} />;
      case 'disputes':
        return <DisputesPage {...navProps} />;
      case 'invoices':
        return <InvoicesPage {...navProps} />;
      case 'settlements':
        return <SettlementsPage {...navProps} />;
      case 'discount_codes':
        return <DiscountCodesPage {...navProps} />;
      case 'audit_logs':
        return <AuditLogsPage {...navProps} />;
      default:
        return null;
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: Colors.background }]}>
      {renderPage()}
    </View>
  );
}
