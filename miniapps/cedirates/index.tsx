import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { MiniAppProps, resolveTheme } from '../types';

type Tab = 'rates' | 'converter' | 'fuel';

const URLS: Record<Tab, string> = {
  rates: 'https://cedirates.com/exchange-rates/usd-to-ghs/',
  converter:
    'https://cedirates.com/currency-converter/?Amount=500&From=USD&To=GHS&Rate=CediRatesAverage',
  fuel: 'https://cedirates.com/fuel-prices/gh/',
};

const TABS: { key: Tab; label: string }[] = [
  { key: 'rates', label: 'Rates' },
  { key: 'converter', label: 'Converter' },
  { key: 'fuel', label: 'Fuel' },
];

export default function CediratesApp({ onClose, theme }: MiniAppProps) {
  const colors = resolveTheme(theme);
  const [activeTab, setActiveTab] = useState<Tab>('rates');
  const [isLoading, setIsLoading] = useState(true);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>CediRates</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close">
          <Text style={[styles.closeText, { color: colors.textSecondary }]}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {TABS.map(({ key, label }) => {
          const active = activeTab === key;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => setActiveTab(key)}
              style={[
                styles.tab,
                active
                  ? { backgroundColor: colors.primary }
                  : { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: active ? colors.background : colors.textSecondary },
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.webviewContainer}>
        {isLoading && (
          <View style={[StyleSheet.absoluteFill, styles.loader]}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}
        <WebView
          key={activeTab}
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
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  title: { fontSize: 20, fontWeight: '700' },
  closeBtn: { padding: 6 },
  closeText: { fontSize: 18, fontWeight: '400' },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    borderRadius: 8,
  },
  tabText: { fontSize: 14, fontWeight: '600' },
  webviewContainer: { flex: 1 },
  webview: { flex: 1, backgroundColor: 'transparent' },
  loader: { justifyContent: 'center', alignItems: 'center', zIndex: 1 },
});
