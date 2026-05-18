import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useAppTheme, ThemeColors, Typography, Spacing } from '../../../theme';

export default function TermsOfServiceScreen() {
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
        <Text style={styles.headerTitle}>Terms of Service</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>AZA Terms of Service</Text>
        <Text style={styles.lastUpdated}>Last updated: {new Date().toLocaleDateString()}</Text>

        <Text style={styles.paragraph}>
          Welcome to AZA. These Terms of Service ("Terms") govern your use of the AZA mobile application and related services provided by AZA Financial Services Ltd ("we", "our", or "us"). By using our services, you agree to these Terms.
        </Text>

        <Text style={styles.heading}>1. Eligibility</Text>
        <Text style={styles.paragraph}>
          You must be at least 18 years old to use our services. By using AZA, you represent and warrant that you meet this requirement.
        </Text>

        <Text style={styles.heading}>2. Account Security</Text>
        <Text style={styles.paragraph}>
          You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorized use of your account.
        </Text>

        <Text style={styles.heading}>3. Use of Services</Text>
        <Text style={styles.paragraph}>
          You agree not to use AZA for any unlawful or prohibited activities. We reserve the right to suspend or terminate your account if you violate these Terms.
        </Text>
        
        <Text style={styles.heading}>4. Transactions</Text>
        <Text style={styles.paragraph}>
          All transactions made through AZA are subject to our review. We may delay or cancel transactions that appear suspicious or violate our policies.
        </Text>

        <Text style={styles.heading}>5. Changes to Terms</Text>
        <Text style={styles.paragraph}>
          We may update these Terms from time to time. We will notify you of any material changes via the app or email. Continued use of AZA constitutes acceptance of the updated Terms.
        </Text>

        <Text style={styles.heading}>6. Contact Us</Text>
        <Text style={styles.paragraph}>
          If you have any questions about these Terms, please contact us through the Help & Support section of the app.
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
