import React, { ComponentProps, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@react-native-vector-icons/feather';
import { MaterialDesignIcons as MaterialCommunityIcons } from '@react-native-vector-icons/material-design-icons';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';
import { useProfile } from '../../../providers/ProfileProvider';
import { BackButton } from '../../../components/ui/BackButton';
import { setDefault2faMethod } from '../../../services/api';

type VerificationMethodProps = (
  | { iconType: 'Feather'; iconName: ComponentProps<typeof Feather>['name'] }
  | { iconType: 'MaterialCommunityIcons'; iconName: ComponentProps<typeof MaterialCommunityIcons>['name'] }
  | { iconType: 'Ionicons'; iconName: ComponentProps<typeof Ionicons>['name'] }
) & {
  title: string;
  description: string;
  securityLevel: 'Very secure' | 'Fairly secure';
  isVerySecure?: boolean;
  onPress?: () => void;
  onSetDefault?: () => void;
  settingDefault?: boolean;
};



export function TwoStepVerificationScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const isDark = Colors.isDark;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'TwoStepVerification'>>();
  const profile = useProfile();
  const { fetchProfile } = profile;
  const [settingDefault, setSettingDefault] = useState<string | null>(null);

  const handleSetDefault = async (method: string) => {
    setSettingDefault(method);
    try {
      await setDefault2faMethod(method);
      fetchProfile();
    } catch {
      Alert.alert('Error', 'Could not update default method. Please try again.');
    } finally {
      setSettingDefault(null);
    }
  };

  const enabledMethodCount = [
    profile.totpEnabled,
    profile.smsTwoFactorEnabled,
    profile.emailTwoFactorEnabled,
    profile.appTwoFactorEnabled,
    profile.passkeysEnabled,
  ].filter(Boolean).length;

  const VerificationMethod = (props: VerificationMethodProps & { isEnabled?: boolean; methodKey?: string }) => {
    const { title, description, securityLevel, isVerySecure, onPress, isEnabled, methodKey } = props;
    const isDefault = isEnabled && methodKey != null && profile.defaultTwoFactorMethod === methodKey;
    const canSetDefault = isEnabled && !isDefault && enabledMethodCount > 1 && methodKey != null;
    return (
      <TouchableOpacity style={styles.methodRow} onPress={onPress} activeOpacity={0.7}>
        <View style={styles.iconContainer}>
          {props.iconType === 'Feather' && <Feather name={props.iconName} size={24} color={isEnabled ? Colors.primary : Colors.textPrimary} />}
          {props.iconType === 'MaterialCommunityIcons' && <MaterialCommunityIcons name={props.iconName} size={24} color={isEnabled ? Colors.primary : Colors.textPrimary} />}
          {props.iconType === 'Ionicons' && <Ionicons name={props.iconName} size={24} color={isEnabled ? Colors.primary : Colors.textPrimary} />}
        </View>
        <View style={styles.methodInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <Text style={[Typography.bodyLg, styles.methodTitle]}>{title}</Text>
            {isDefault && (
              <View style={styles.defaultBadge}>
                <Text style={styles.defaultBadgeText}>Default</Text>
              </View>
            )}
            {isEnabled && !isDefault && (
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>Enabled</Text>
              </View>
            )}
          </View>
          <Text style={[Typography.body, styles.methodDescription]}>{description}</Text>
          <Text style={[Typography.body, styles.securityLevel, isVerySecure ? styles.verySecure : styles.fairlySecure]}>
            {securityLevel}
          </Text>
          {canSetDefault && (
            <TouchableOpacity
              onPress={() => handleSetDefault(methodKey!)}
              disabled={settingDefault === methodKey}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.setDefaultText}>
                {settingDefault === methodKey ? 'Setting...' : 'Set as default'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <Feather name="chevron-right" size={20} color={Colors.textSecondary} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" />
      
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.titleSection}>
          <Text style={[Typography.h1, styles.mainTitle]}>2-step verification</Text>
          <Text style={[Typography.bodyLg, styles.mainDescription]}>
            Manage how you complete 2-step verification. It's an extra layer of security on your account, on top of your password.
          </Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[Typography.body, styles.sectionLabel]}>Your verification methods</Text>
        </View>
        <View style={styles.divider} />

        <View style={styles.contentSection}>
          <VerificationMethod
            iconType="MaterialCommunityIcons"
            iconName="fingerprint"
            title="Passkeys"
            description="Log in with the more secure face and fingerprint recognition."
            securityLevel="Very secure"
            isVerySecure
            isEnabled={profile.passkeysEnabled}
            methodKey="PASSKEY"
            onPress={() => navigation.navigate(profile.passkeysEnabled ? 'DisablePasskey' : 'PasskeySetup')}
          />

          <VerificationMethod
            iconType="Feather"
            iconName="smartphone"
            title="Aza app"
            description="Verify yourself with this app. No need to wait for a text, and you just need an internet connection."
            securityLevel="Very secure"
            isVerySecure
            isEnabled={profile.appTwoFactorEnabled}
            methodKey="APP"
            onPress={() => navigation.navigate('AzaAppSetup')}
          />

          <VerificationMethod
            iconType="Ionicons"
            iconName="chatbubble-outline"
            title="Text message"
            description="Receive a verification code by text. You'll need phone signal for this."
            securityLevel="Fairly secure"
            isEnabled={profile.smsTwoFactorEnabled}
            methodKey="SMS"
            onPress={() => navigation.navigate(profile.smsTwoFactorEnabled ? 'DisableSms' : 'SmsSetup')}
          />
        </View>

        <View style={[styles.sectionHeader, { marginTop: Spacing.xl }]}>
          <Text style={[Typography.body, styles.sectionLabel]}>Other verification methods</Text>
        </View>
        <View style={styles.divider} />

        <View style={styles.contentSection}>
          <VerificationMethod
            iconType="MaterialCommunityIcons"
            iconName="shield-check-outline"
            title="Authenticator app"
            description="Use an app like Google Authenticator or Authy to get codes."
            securityLevel="Very secure"
            isVerySecure
            onPress={() => navigation.navigate(profile.totpEnabled ? 'DisableTotp' : 'TotpSetup')}
            isEnabled={profile.totpEnabled}
            methodKey="TOTP"
          />
        </View>

        {profile.twoFactorEnabled && (
          <>
            <View style={[styles.sectionHeader, { marginTop: Spacing.xl }]}>
              <Text style={[Typography.body, styles.sectionLabel]}>Backup</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.contentSection}>
              <VerificationMethod
                iconType="MaterialCommunityIcons"
                iconName="key-outline"
                title="Recovery codes"
                description="Use a one-time backup code if you can't access any of your verification methods."
                securityLevel="Very secure"
                isVerySecure
                onPress={() => navigation.navigate('ManageRecoveryCodes')}
              />
            </View>
          </>
        )}
      </ScrollView>
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
    backgroundColor: isDark ? Colors.white10 : "rgba(22, 51, 0, 0.04)",
    justifyContent: 'center',
    alignItems: 'center' },
  scrollContent: {
    paddingBottom: Spacing.xl },
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
  sectionHeader: {
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md },
  sectionLabel: {
    color: Colors.textSecondary },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: Spacing.lg,
    marginHorizontal: Spacing.lg },
  contentSection: {
    paddingHorizontal: Spacing.lg },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Spacing.md,
    marginBottom: Spacing.sm },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md },
  methodInfo: {
    flex: 1 },
  methodTitle: {
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4 },
  methodDescription: {
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 4 },
  securityLevel: {
    fontWeight: '600',
    fontSize: 14 },
  verySecure: {
    color: isDark ? Colors.primary : '#1E5128', // Dark green
  },
  fairlySecure: {
    color: Colors.textSecondary,
  },
  activeBadge: {
    backgroundColor: isDark ? 'rgba(34, 197, 94, 0.2)' : '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: isDark ? '#4ADE80' : '#166534',
  },
  defaultBadge: {
    backgroundColor: isDark ? 'rgba(183, 238, 122, 0.2)' : '#F0FDF4',
    borderWidth: 1,
    borderColor: isDark ? Colors.primary : '#86EFAC',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  setDefaultText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
    marginTop: 6,
    textDecorationLine: 'underline',
  },
});
}
