import React from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { MiniAppProps, resolveTheme } from '../types';

export default function RadioApp({ theme }: MiniAppProps) {
  const colors = resolveTheme(theme);

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: 'https://radio.com.gh/' }}
        style={styles.webview}
        domStorageEnabled
        javaScriptEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        startInLoadingState
        renderLoading={() => (
          <View style={[StyleSheet.absoluteFill, styles.loader, { backgroundColor: colors.background }]}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  webview: { flex: 1 },
  loader: { justifyContent: 'center', alignItems: 'center' },
});
