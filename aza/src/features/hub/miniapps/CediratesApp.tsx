import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { MiniAppProps } from './types';
import { useAppTheme, Typography, Spacing } from '../../../theme';
import { CloseButton } from '../../../components/ui/CloseButton';
import Button from '../../../components/ui/Button';

type Tab = 'rates' | 'converter' | 'fuel';

const URLS: Record<Tab, string> = {
  rates: 'https://cedirates.com/exchange-rates/usd-to-ghs/',
  converter: 'https://cedirates.com/currency-converter/?Amount=500&From=USD&To=GHS&Rate=CediRatesAverage',
  fuel: 'https://cedirates.com/fuel-prices/gh/',
};

export default function CediratesApp({ onClose }: MiniAppProps) {
  const { colors } = useAppTheme();
  const [activeTab, setActiveTab] = useState<Tab>('rates');
  const [isLoading, setIsLoading] = useState(true);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>CediRates</Text>
        <CloseButton onPress={onClose} />
      </View>

      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        <Button
          title="Rates"
          onPress={() => setActiveTab('rates')}
          backgroundColor={activeTab === 'rates' ? colors.primary : 'transparent'}
          textColor={activeTab === 'rates' ? '#FFFFFF' : colors.textSecondary}
          style={styles.tabButton}
        />
        <Button
          title="Converter"
          onPress={() => setActiveTab('converter')}
          backgroundColor={activeTab === 'converter' ? colors.primary : 'transparent'}
          textColor={activeTab === 'converter' ? '#FFFFFF' : colors.textSecondary}
          style={styles.tabButton}
        />
        <Button
          title="Fuel"
          onPress={() => setActiveTab('fuel')}
          backgroundColor={activeTab === 'fuel' ? colors.primary : 'transparent'}
          textColor={activeTab === 'fuel' ? '#FFFFFF' : colors.textSecondary}
          style={styles.tabButton}
        />
      </View>

      <View style={styles.webviewContainer}>
        {isLoading && (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}
        <WebView
          key={activeTab} // Force re-render on tab change to reset loading state cleanly if needed
          source={{ uri: URLS[activeTab] }}
          style={styles.webview}
          onLoadStart={() => setIsLoading(true)}
          onLoadEnd={() => setIsLoading(false)}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  headerTitle: {
    ...Typography.h2,
    fontWeight: '700',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    gap: Spacing.sm,
  },
  tabButton: {
    flex: 1,
    minHeight: 40,
    paddingVertical: Spacing.sm,
    paddingHorizontal: 0,
  },
  webviewContainer: {
    flex: 1,
    position: 'relative',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loaderContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
});
