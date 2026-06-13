import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme, Spacing, Typography } from '../../../../theme';
import { Page, OAuthClientData, MiniAppData } from './types';
import ClientsListPage from './pages/ClientsListPage';
import CreateClientPage from './pages/CreateClientPage';
import ClientDetailPage from './pages/ClientDetailPage';
import MiniAppsListPage from './pages/MiniAppsListPage';
import SubmitMiniAppPage from './pages/SubmitMiniAppPage';

type Tab = 'oauth' | 'miniapps';

interface StackEntry {
  page: Page;
  params?: any;
}

export default function DeveloperApp() {
  const { colors: Colors } = useAppTheme();
  const [tab, setTab] = useState<Tab>('oauth');
  const [stack, setStack] = useState<StackEntry[]>([{ page: 'list' }]);
  const [miniStack, setMiniStack] = useState<StackEntry[]>([{ page: 'miniapps' }]);

  const navigate = useCallback((page: Page, params?: any) => {
    if (['miniapps', 'miniapp_submit', 'miniapp_detail'].includes(page)) {
      setMiniStack(prev => [...prev, { page, params }]);
      setTab('miniapps');
    } else {
      setStack(prev => [...prev, { page, params }]);
    }
  }, []);

  const goBack = useCallback(() => {
    if (tab === 'miniapps') {
      setMiniStack(prev => (prev.length > 1 ? prev.slice(0, -1) : prev));
    } else {
      setStack(prev => (prev.length > 1 ? prev.slice(0, -1) : prev));
    }
  }, [tab]);

  const navProps = { navigate, goBack, Colors };
  const current = stack[stack.length - 1] ?? { page: 'list' as Page };
  const miniCurrent = miniStack[miniStack.length - 1] ?? { page: 'miniapps' as Page };

  // Pages that have their own header — hide tab bar
  const isDeepPage = tab === 'oauth'
    ? current.page !== 'list'
    : miniCurrent.page !== 'miniapps';

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: Colors.background }]} edges={['top', 'bottom']}>
      {/* Tab bar — hidden when navigated deep */}
      {!isDeepPage && (
        <View style={[styles.tabBar, { borderBottomColor: Colors.border }]}>
          {(['oauth', 'miniapps'] as Tab[]).map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.tab, t === tab && { borderBottomColor: Colors.primary, borderBottomWidth: 2 }]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.tabText, { color: t === tab ? Colors.primary : Colors.textSecondary }]}>
                {t === 'oauth' ? 'OAuth Apps' : 'Mini Apps'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.content}>
        {/* OAuth tab */}
        {tab === 'oauth' && (
          <>
            {current.page === 'list' && <ClientsListPage {...navProps} />}
            {current.page === 'create' && <CreateClientPage {...navProps} />}
            {current.page === 'detail' && (
              <ClientDetailPage
                {...navProps}
                client={current.params?.client as OAuthClientData}
                justCreated={current.params?.justCreated}
              />
            )}
          </>
        )}

        {/* Mini Apps tab */}
        {tab === 'miniapps' && (
          <>
            {miniCurrent.page === 'miniapps' && <MiniAppsListPage {...navProps} />}
            {miniCurrent.page === 'miniapp_submit' && <SubmitMiniAppPage {...navProps} />}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: { ...Typography.body, fontWeight: '600', fontSize: 14 },
  content: { flex: 1 },
});
