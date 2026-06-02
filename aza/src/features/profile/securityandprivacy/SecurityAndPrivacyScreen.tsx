import React, { ComponentProps } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Switch, Animated, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@react-native-vector-icons/feather';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { MaterialDesignIcons as MaterialCommunityIcons } from '@react-native-vector-icons/material-design-icons';

import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { useProfile } from '../../../providers/ProfileProvider';
import { useE2EE } from '../../../providers/E2EEProvider';
import { useToast } from '../../../providers/ToastProvider';
import { useAuth } from '../../../providers/AuthProvider';
import { cancelAccountDeletion } from '../../../services/api';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';
import { BackButton } from '../../../components/ui/BackButton';
import { extractErrorMessage } from '../../../utils/errorUtils';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "SecurityAndPrivacy">;



type SettingRowProps = (
  | { iconType: 'Feather'; iconName: ComponentProps<typeof Feather>['name'] }
  | { iconType: 'Ionicons'; iconName: ComponentProps<typeof Ionicons>['name'] }
  | { iconType: 'MaterialCommunityIcons'; iconName: ComponentProps<typeof MaterialCommunityIcons>['name'] }
) & {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  showSwitch?: boolean;
  switchValue?: boolean;
  onSwitchChange?: (value: boolean) => void;
};

function SettingRow(props: SettingRowProps) {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const { title, subtitle, onPress, showSwitch, switchValue, onSwitchChange } = props;
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      disabled={showSwitch}
      activeOpacity={0.7}
      accessibilityLabel={title}
    >
      <View style={styles.iconContainer}>
        {props.iconType === 'Feather' && <Feather name={props.iconName} size={20} color={Colors.textPrimary} />}
        {props.iconType === 'Ionicons' && <Ionicons name={props.iconName} size={20} color={Colors.textPrimary} />}
        {props.iconType === 'MaterialCommunityIcons' && <MaterialCommunityIcons name={props.iconName} size={20} color={Colors.textPrimary} />}
      </View>
      <View style={styles.textContainer}>
        <Text style={[Typography.body, styles.rowTitle]}>{title}</Text>
        {subtitle && <Text style={[Typography.caption, styles.rowSubtitle]}>{subtitle}</Text>}
      </View>
      {showSwitch ? (
        <Switch
          value={switchValue}
          onValueChange={onSwitchChange}
          trackColor={{ false: isDark ? Colors.surface : '#E5E7EB', true: Colors.primary }}
          thumbColor={Colors.white}
          ios_backgroundColor={isDark ? Colors.surface : "#E5E7EB"}
          accessibilityRole="switch"
          accessibilityLabel={title}
        />
      ) : (
        <Feather name="chevron-right" size={20} color={Colors.textSecondary} />
      )}
    </TouchableOpacity>
  );
}

export function SecurityAndPrivacyScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const profile = useProfile();
  const navigation = useNavigation<NavigationProp>();
  const scrollY = React.useRef(new Animated.Value(0)).current;
  const { reset: resetE2EE, identity } = useE2EE();
  const { showToast } = useToast();
  const { scheduledDeletionAt, login, userToken, hasPasscode, isKYCVerified } = useAuth();
  const [isResettingE2EE, setIsResettingE2EE] = React.useState(false);
  const [isCancellingDeletion, setIsCancellingDeletion] = React.useState(false);

  const handleCancelDeletion = React.useCallback(() => {
    Alert.alert(
      'Cancel account deletion?',
      'Your account will remain active and no data will be deleted.',
      [
        { text: 'Go back', style: 'cancel' },
        {
          text: 'Cancel deletion',
          onPress: async () => {
            setIsCancellingDeletion(true);
            try {
              await cancelAccountDeletion();
              // Clear scheduledDeletionAt from local auth state
              if (userToken) {
                login({ token: userToken, hasPasscode, isKYCVerified, scheduledDeletionAt: null });
              }
              showToast('Deletion cancelled. Your account is active.', 'success');
            } catch (e: unknown) {
              showToast(extractErrorMessage(e, 'Failed to cancel deletion.'), 'error');
            } finally {
              setIsCancellingDeletion(false);
            }
          },
        },
      ],
    );
  }, [userToken, hasPasscode, isKYCVerified, login, showToast]);

  const handleResetEncryption = React.useCallback(() => {
    if (isResettingE2EE) return;
    Alert.alert(
      'Reset encryption keys?',
      'This will delete your chat identity keys from this device and clear all locally cached conversations. ' +
        'Your past message history will become unreadable on this device. ' +
        "New keys will be generated and published on your next chat send.\n\n" +
        'Tell your contacts to expect a "key changed" warning the next time they message you. ' +
        'Continue only if you suspect your device or keys have been compromised.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            if (!identity) {
              showToast('Encryption is still initializing. Try again in a moment.', 'error');
              return;
            }
            setIsResettingE2EE(true);
            try {
              await resetE2EE();
              showToast('Encryption keys reset.', 'success');
            } catch (e: unknown) {
              showToast(extractErrorMessage(e, 'Could not reset keys.'), 'error');
            } finally {
              setIsResettingE2EE(false);
            }
          },
        },
      ],
    );
  }, [identity, isResettingE2EE, resetE2EE, showToast]);

  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [40, 70],
    outputRange: [0, 1],
    extrapolate: "clamp" });

  const headerBorderOpacity = scrollY.interpolate({
    inputRange: [40, 70],
    outputRange: [0, 1],
    extrapolate: "clamp" });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" />
      
      <Animated.View 
        style={[
          styles.header,
          {
            borderBottomColor: headerBorderOpacity.interpolate({
              inputRange: [0, 1],
              outputRange: ["transparent", Colors.border] }) }
        ]}
      >
        <BackButton onPress={() => navigation.goBack()} />
        <Animated.View style={[styles.headerTitleContainer, { opacity: headerTitleOpacity }]}>
          <Text style={[Typography.h3, styles.headerTitle]}>Security and privacy</Text>
        </Animated.View>
        <View style={{ width: 40 }} />
      </Animated.View>

      <Animated.ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
        scrollEventThrottle={16}
      >
        <View style={styles.titleSection}>
          <Text style={[Typography.h1, styles.mainTitle]}>Security and privacy</Text>
        </View>

        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Security</Text>

          {scheduledDeletionAt && (
            <TouchableOpacity
              style={[styles.deletionBanner, { borderColor: Colors.error }]}
              onPress={handleCancelDeletion}
              disabled={isCancellingDeletion}
              activeOpacity={0.8}
            >
              <Feather name="alert-triangle" size={18} color={Colors.error} style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={[Typography.body, { color: Colors.error, fontWeight: '700' }]}>
                  Account deletion scheduled
                </Text>
                <Text style={[Typography.caption, { color: Colors.error, marginTop: 2 }]}>
                  Deletes on {new Date(scheduledDeletionAt).toLocaleDateString()}. Tap to cancel.
                </Text>
              </View>
            </TouchableOpacity>
          )}

          <SettingRow
            iconType="Feather"
            iconName="shield"
            title="Password"
            onPress={() => navigation.navigate("ChangePassword")}
          />
          
          <SettingRow
            iconType="MaterialCommunityIcons"
            iconName="fingerprint"
            title="2-step verification"
            subtitle={profile.twoFactorEnabled ? "Status: On" : "Status: Off"}
            onPress={() => navigation.navigate("TwoStepVerification")}
          />

          <SettingRow
            iconType="Feather"
            iconName="users"
            title="Recovery contacts"
            subtitle="Up to 3 trusted people who can help you"
            onPress={() => navigation.navigate("AccountRecoveryContacts")}
          />

          <SettingRow
            iconType="Feather"
            iconName="smartphone"
            title="Devices"
            subtitle="Manage your devices"
            onPress={() => navigation.navigate("Devices")}
          />
          
          <SettingRow
            iconType="MaterialCommunityIcons"
            iconName="face-recognition"
            title="App security"
            subtitle="Passcode, biometrics and auto-lock settings"
            onPress={() => navigation.navigate("AppSecurity")}
          />
          
          <SettingRow 
            iconType="Feather" 
            iconName="log-out" 
            title="Log out everywhere" 
            subtitle="Use if you've logged in on a public device or lost your phone"
            onPress={() => navigation.navigate("LogoutEverywhere")}
          />
          
          <SettingRow
            iconType="Feather"
            iconName="lock"
            title="Secure your account"
            subtitle="Use in the case of a stolen phone or suspicious transactions"
            onPress={() => navigation.navigate("SecureAccount")}
          />

          <SettingRow
            iconType="Feather"
            iconName="lock"
            title="Freeze Wallet"
            subtitle="Temporarily block all transfers"
            onPress={() => navigation.navigate("WalletFreeze")}
          />

          <SettingRow
            iconType="Feather"
            iconName="refresh-cw"
            title="Reset encryption keys"
            subtitle="Replace your chat identity keys and clear cached conversations. Use if you suspect a compromise."
            onPress={handleResetEncryption}
          />
        </View>

        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Privacy</Text>
          
          <SettingRow 
            iconType="Feather" 
            iconName="search" 
            title="Find me by" 
            subtitle="Choose how people on Aza can find your account"
            onPress={() => navigation.navigate("FindMeBy")}
          />

          
          <SettingRow 
            iconType="Feather" 
            iconName="mail" 
            title="Bill forwarding email" 
            subtitle="Set up an email to receive bills and invoices. Received files will be set up as draft payments to review"
            onPress={() => navigation.navigate("BillForwardingIntro")}
          />


          <SettingRow
            iconType="Ionicons" 
            iconName="id-card-outline" 
            title="Biometric data" 
            subtitle="Allow Aza to store and use your selfie and ID for automated verification"
            showSwitch
            switchValue={profile.biometricData}
            onSwitchChange={(v) => profile.updateProfile({ biometricData: v })}
          />
          
          <SettingRow 
            iconType="Feather" 
            iconName="info" 
            title="Privacy policy" 
            subtitle="Learn how we protect and use your personal information"
            onPress={() => navigation.navigate("PrivacyPolicy")}
          />

          <SettingRow 
            iconType="Feather" 
            iconName="trash-2" 
            title="Delete account" 
            subtitle="Permanently delete your Aza account and data"
            onPress={() => navigation.navigate("DeleteAccount")}
          />
        </View>
        
        <View style={styles.spacer} />
      </Animated.ScrollView>

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
    paddingBottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    height: 60 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: isDark ? Colors.white10 : "rgba(22, 51, 0, 0.04)",
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1 },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center' },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary },
  scrollContent: {
    paddingBottom: Spacing.xl },
  titleSection: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.xl },
  mainTitle: {
    color: Colors.textPrimary },
  section: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: Spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xl },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: isDark ? Colors.white10 : "rgba(22, 51, 0, 0.04)",
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingRight: Spacing.sm },
  rowTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4 },
  rowSubtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20 },
  spacer: {
    height: Spacing.xl },
  deletionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    padding: Spacing.md,
    marginBottom: Spacing.xl,
    backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : '#FFF5F5',
  },
  });
}


