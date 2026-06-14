import React, { useState, useCallback, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppTheme } from '../../../../theme';
import { getAgent } from '../../../../services/api';
import { queryKeys } from '../../../../lib/queryKeys';

import { Page, AgentData, NavProps } from './types';
import { extractData } from './helpers';
import { createStyles } from './styles';

import IntroPage from './pages/IntroPage';
import StatusPage from './pages/StatusPage';
import DashboardPage from './pages/DashboardPage';
import CashInPage from './pages/CashInPage';
import RedeemCodePage from './pages/RedeemCodePage';

interface LocalMiniAppProps {
  onClose?: () => void;
}

export default function AzaAgentApp(_: LocalMiniAppProps) {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const queryClient = useQueryClient();

  const [pageStack, setPageStack] = useState<Page[]>(['loading']);

  const navigate = useCallback((page: Page) => setPageStack(prev => [...prev, page]), []);
  const goBack = useCallback(
    () => setPageStack(prev => (prev.length > 1 ? prev.slice(0, -1) : prev)),
    [],
  );

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.agent(),
    queryFn: getAgent,
    staleTime: 60_000,
  });

  const agent: AgentData | null = data ? extractData(data) : null;

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.agent() });
    queryClient.invalidateQueries({ queryKey: queryKeys.wallet() });
  }, [queryClient]);

  // Route to the right landing page whenever the backing agent status changes.
  useEffect(() => {
    if (isLoading) {
      setPageStack(['loading']);
      return;
    }
    const status = isError || !agent ? 'NONE' : agent.status;
    switch (status) {
      case 'ACTIVE':
        setPageStack(['dashboard']);
        break;
      case 'PENDING':
        setPageStack(['under_review']);
        break;
      case 'SUSPENDED':
        setPageStack(['suspended']);
        break;
      case 'REJECTED':
        setPageStack(['rejected']);
        break;
      default:
        setPageStack(['intro']);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent?.status, isLoading, isError]);

  const currentPage = pageStack[pageStack.length - 1];

  const navProps: NavProps = { navigate, goBack, agent, refresh, Colors, styles };

  const renderPage = () => {
    switch (currentPage) {
      case 'loading':
        return (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        );
      case 'intro':
        return <IntroPage {...navProps} />;
      case 'under_review':
        return (
          <StatusPage
            {...navProps}
            icon="hourglass-top"
            title="Application under review"
            message="Thanks for applying. Our team is reviewing your details and we’ll let you know once you’re approved."
          />
        );
      case 'suspended':
        return (
          <StatusPage
            {...navProps}
            icon="block"
            iconColor={Colors.error || '#D1222E'}
            title="Agent access suspended"
            message="Your agent account has been suspended. Please contact support for help."
          />
        );
      case 'rejected':
        return (
          <StatusPage
            {...navProps}
            icon="cancel"
            iconColor={Colors.error || '#D1222E'}
            title="Application not approved"
            message="Your agent application was not approved. Contact support if you believe this is a mistake."
          />
        );
      case 'dashboard':
        return <DashboardPage {...navProps} />;
      case 'cash_in':
        return <CashInPage {...navProps} />;
      case 'redeem':
        return <RedeemCodePage {...navProps} />;
      default:
        return null;
    }
  };

  return <View style={[styles.root, { backgroundColor: Colors.background }]}>{renderPage()}</View>;
}
