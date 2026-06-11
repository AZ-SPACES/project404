import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../../../../theme';
import { Page, OAuthClientData } from './types';
import ClientsListPage from './pages/ClientsListPage';
import CreateClientPage from './pages/CreateClientPage';
import ClientDetailPage from './pages/ClientDetailPage';

interface StackEntry {
  page: Page;
  params?: any;
}

export default function DeveloperApp() {
  const { colors: Colors } = useAppTheme();
  const [stack, setStack] = useState<StackEntry[]>([{ page: 'list' }]);

  const navigate = useCallback((page: Page, params?: any) => {
    setStack(prev => [...prev, { page, params }]);
  }, []);

  const goBack = useCallback(() => {
    setStack(prev => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  const current = stack[stack.length - 1] ?? { page: 'list' as Page };
  const navProps = { navigate, goBack, Colors };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: Colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.root}>
        {current.page === 'list' && (
          <ClientsListPage {...navProps} />
        )}
        {current.page === 'create' && (
          <CreateClientPage {...navProps} />
        )}
        {current.page === 'detail' && (
          <ClientDetailPage
            {...navProps}
            client={current.params?.client as OAuthClientData}
            justCreated={current.params?.justCreated}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
