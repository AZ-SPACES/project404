import React, { useState, useCallback } from 'react';
import { View, Text, ActivityIndicator,} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../../navigation/types';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useAppTheme, Spacing } from '../../../../theme';
import { getMerchant } from '../../../../services/api';

import { Page, MerchantData, NavProps } from './types';
import { createStyles } from './styles';
import { extractData } from './helpers';

import IntroPage from './pages/IntroPage';
import UnderReviewPage from './pages/UnderReviewPage';
import DashboardPage from './pages/DashboardPage';
import SessionsPage from './pages/SessionsPage';
import CreateSessionPage from './pages/CreateSessionPage';
import ApiKeysPage from './pages/ApiKeysPage';
import WebhooksPage from './pages/WebhooksPage';
import PayoutsPage from './pages/PayoutsPage';
import StoreQrPage from './pages/StoreQrPage';

// Local interface just for the exported component props
interface LocalMiniAppProps {
  onClose?: () => void;
}

export default function MyBusinessApp({ onClose }: LocalMiniAppProps) {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [pageStack, setPageStack] = useState<Page[]>(['loading']);
  const [merchant, setMerchant] = useState<MerchantData | null>(null);

  const navigate = useCallback((page: Page) => {
    setPageStack(prev => [...prev, page]);
  }, []);

  const goBack = useCallback(() => {
    setPageStack(prev => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  const handleMerchantUpdate = useCallback((m: MerchantData) => {
    setMerchant(m);
  }, []);

  const loadMerchant = useCallback(() => {
    setPageStack(['loading']);
    getMerchant()
      .then((res: any) => {
        const m = extractData(res);
        setMerchant(m);
        if (!m || !m.status) { setPageStack(['intro']); return; }
        switch (m.status) {
          case 'ACTIVE': setPageStack(['dashboard']); break;
          case 'PENDING':
          case 'PENDING_KYB':
            navigation.navigate('MerchantKYBIntro', { merchantId: m.id });
            setPageStack(['intro']);
            break;
          case 'KYB_SUBMITTED':
          case 'KYB_UNDER_REVIEW':
          case 'MORE_INFO_REQUIRED': setPageStack(['under_review']); break;
          case 'SUSPENDED': setPageStack(['suspended']); break;
          case 'REJECTED': setPageStack(['rejected']); break;
          default: setPageStack(['under_review']);
        }
      })
      .catch(() => {
        setPageStack(['intro']);
      });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      loadMerchant();
    }, [loadMerchant])
  );

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
