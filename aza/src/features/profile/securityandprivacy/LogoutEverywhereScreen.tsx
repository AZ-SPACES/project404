import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@react-native-vector-icons/feather';
import { MaterialDesignIcons as MaterialCommunityIcons } from '@react-native-vector-icons/material-design-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { useAppTheme, ThemeColors, Typography, Spacing } from '../../../theme';
import Button from '../../../components/ui/Button';
import { useAuth } from '../../../providers/AuthProvider';
import { useToast } from '../../../providers/ToastProvider';
import { logoutEverywhere as logoutEverywhereApi } from '../../../services/api';
import { BackButton } from '../../../components/ui/BackButton';

export function LogoutEverywhereScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'LogoutEverywhere'>>();
  const { logout } = useAuth();
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await logoutEverywhereApi();
      showToast("All sessions have been revoked.", "success");
      // Small delay for the toast to be seen before logout resets navigation
      setTimeout(() => logout(), 500);
    } catch (e) {
      showToast("Failed to revoke all sessions. Please try again.", "error");
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.titleSection}>
          <Text style={[Typography.h1, styles.mainTitle]}>Log out everywhere</Text>
          <Text style={[Typography.bodyLg, styles.mainDescription]}>
            To prevent unauthorised access, you can log out of Aza on all devices, including public ones.
          </Text>
        </View>

        <View style={styles.contentSection}>
          <Text style={[Typography.body, styles.sectionLabel]}>What happens</Text>
          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="cellphone-lock" size={28} color={Colors.textPrimary} style={styles.icon} />
            <View style={styles.infoTextContainer}>
              <Text style={[Typography.bodyLg, styles.infoTitle]}>We'll log you out of all devices</Text>
              <Text style={[Typography.body, styles.infoSubtitle]}>
                No one will be able to access your account without additional verification.
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="fingerprint" size={28} color={Colors.textPrimary} style={styles.icon} />
            <View style={styles.infoTextContainer}>
              <Text style={[Typography.bodyLg, styles.infoTitle]}>You'll set a new password</Text>
              <Text style={[Typography.body, styles.infoSubtitle]}>
                We'll help you reset your password when you next log in for added security.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button 
          title="Log out" 
          onPress={handleLogout}
          backgroundColor={Colors.primary}
          textColor={Colors.secondary}
          borderRadius={24}
          loading={isLoading}
          disabled={isLoading}
        />
      </View>
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center' },
  scrollContent: {
    paddingBottom: 100 },
  titleSection: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl },
  mainTitle: {
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    fontSize: 32 },
  mainDescription: {
    color: Colors.textSecondary,
    lineHeight: 24 },
  contentSection: {
    paddingHorizontal: Spacing.lg },
  sectionLabel: {
    color: Colors.textSecondary,
    marginBottom: Spacing.md },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: Spacing.lg },
  infoRow: {
    flexDirection: 'row',
    marginBottom: Spacing.xl },
  icon: {
    marginRight: Spacing.md,
    marginTop: 2 },
  infoTextContainer: {
    flex: 1 },
  infoTitle: {
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4 },
  infoSubtitle: {
    color: Colors.textSecondary,
    lineHeight: 20 },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background } });
}


