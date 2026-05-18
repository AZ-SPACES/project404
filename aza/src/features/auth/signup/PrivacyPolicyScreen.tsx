import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useAppTheme, ThemeColors, Typography, Spacing } from '../../../theme';

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
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>AZA Privacy Policy</Text>
        <Text style={styles.lastUpdated}>Last updated: {new Date().toLocaleDateString()}</Text>

        <Text style={styles.paragraph}>
          At AZA Financial Services Ltd, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and related services.
        </Text>

        <Text style={styles.heading}>1. Information We Collect</Text>
        <Text style={styles.paragraph}>
          We may collect personal information such as your name, email address, phone number, date of birth, and financial information when you register for an account or use our services.
        </Text>

        <Text style={styles.heading}>2. How We Use Your Information</Text>
        <Text style={styles.paragraph}>
          We use the information we collect to provide, maintain, and improve our services, process transactions, communicate with you, and comply with legal obligations.
        </Text>

        <Text style={styles.heading}>3. Sharing Your Information</Text>
        <Text style={styles.paragraph}>
          We do not sell your personal information. We may share your information with trusted third-party service providers to help us operate our business, or as required by law.
        </Text>
        
        <Text style={styles.heading}>4. Data Security</Text>
        <Text style={styles.paragraph}>
          We implement industry-standard security measures to protect your personal information from unauthorized access, alteration, disclosure, or destruction.
        </Text>

        <Text style={styles.heading}>5. Your Rights</Text>
        <Text style={styles.paragraph}>
          You have the right to access, update, or delete your personal information. You can manage your privacy settings within the AZA app or contact our support team.
        </Text>

        <Text style={styles.heading}>6. Contact Us</Text>
        <Text style={styles.paragraph}>
          If you have questions or concerns about this Privacy Policy, please contact us through the Help & Support section of the app.
        </Text>
      </ScrollView>
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
