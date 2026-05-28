import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import { useAppTheme, ThemeColors, Typography, Spacing } from '../../../theme';
import { WebView } from 'react-native-webview';

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL || 'https://aza.systems/privacy-policy';

export default function PrivacyPolicyScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation();
  const isDark = Colors.isDark;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" />
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="chevron-left" size={28} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 44 }} />
      </View>
      <WebView
        source={{ uri: `${WEB_URL}/privacy-policy` }}
        style={{ flex: 1, backgroundColor: Colors.background }}
        showsVerticalScrollIndicator={false}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }]}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        )}
      />
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
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: Spacing.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.border,
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: isDark ? Colors.white10 : "rgba(22,51,0,0.04)",
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: Colors.textPrimary,
    },
    content: {
      padding: Spacing.lg,
      paddingBottom: Spacing.xl * 2,
    },
    title: {
      ...Typography.h1,
      color: Colors.textPrimary,
      marginBottom: Spacing.xs,
    },
    lastUpdated: {
      ...Typography.caption,
      color: Colors.textSecondary,
      marginBottom: Spacing.xl,
    },
    heading: {
      ...Typography.h2,
      color: Colors.textPrimary,
      marginTop: Spacing.lg,
      marginBottom: Spacing.sm,
    },
    paragraph: {
      ...Typography.body,
      color: Colors.textSecondary,
      lineHeight: 24,
    },
  });
}
