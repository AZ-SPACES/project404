import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, StatusBar, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Feather } from '@react-native-vector-icons/feather';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme, ThemeColors, Typography, Spacing } from '../../../theme';
import { BackButton } from '../../../components/ui/BackButton';
import { getChatbaseToken } from '../../../services/api';

const BOT_ID = 'lcXHLFPWBcPsUbKaDDbeK';
const BASE_URL = `https://www.chatbase.co/chatbot-iframe/${BOT_ID}`;

export default function ChatbotScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const isDark = Colors.isDark;
  const navigation = useNavigation();
  const [chatUrl, setChatUrl] = useState<string | null>(null);

  useEffect(() => {
    getChatbaseToken()
      .then(res => {
        const token = res.data?.data?.token;
        setChatUrl(token ? `${BASE_URL}?token=${encodeURIComponent(token)}` : BASE_URL);
      })
      .catch(() => setChatUrl(BASE_URL));
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" />

      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} size={28} />
        <View style={styles.headerCenter}>
          <View style={styles.headerIcon}>
            <Feather name="cpu" size={14} color={Colors.primary} />
          </View>
          <View>
            <Text style={styles.headerTitle}>AZA Support</Text>
            <Text style={styles.headerSubtitle}>AI-powered · Replies instantly</Text>
          </View>
        </View>
        <View style={{ width: 44 }} />
      </View>

      {!chatUrl ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <WebView
          source={{ uri: chatUrl }}
          style={styles.webview}
          showsVerticalScrollIndicator={false}
          startInLoadingState
          renderLoading={() => (
            <View style={[StyleSheet.absoluteFill, styles.loader]}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    header: {
      height: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.border,
    },
    headerCenter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    headerIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: Colors.primary + '18',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      ...Typography.body,
      fontWeight: '700',
      color: Colors.textPrimary,
    },
    headerSubtitle: {
      ...Typography.caption,
      color: Colors.textSecondary,
    },
    loader: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: Colors.background,
    },
    webview: {
      flex: 1,
      backgroundColor: Colors.background,
    },
  });
}
