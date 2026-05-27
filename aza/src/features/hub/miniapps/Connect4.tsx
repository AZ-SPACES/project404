import React from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { MiniAppProps } from './types';
import { useAppTheme } from '../../../theme';

export default function Connect4({ onClose }: MiniAppProps) {
  const { colors: Colors } = useAppTheme();

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: 'https://kenrick95.github.io/c4/' }}
        style={styles.webview}
        domStorageEnabled={true}
        javaScriptEnabled={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        scalesPageToFit={true}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={[StyleSheet.absoluteFill, styles.loadingContainer, { backgroundColor: Colors.background }]}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
