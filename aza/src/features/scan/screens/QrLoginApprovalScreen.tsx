import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Alert, Image, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { useAppTheme, ThemeColors } from '../../../theme';
import { RootStackParamList } from '../../../navigation/types';
import { authorizeQrLogin, fetchOAuthClientInfo } from '../../../services/api';
import Button from '../../../components/ui/Button';

type RouteType = RouteProp<RootStackParamList, 'QrLoginApproval'>;

const SITE_ICONS: Record<string, string> = {
  ADMIN: 'shield-checkmark',
  MERCHANT: 'storefront',
  DEVELOPER: 'code-slash',
  THIRD_PARTY: 'apps',
};

const SCOPE_LABELS: Record<string, { label: string; description: string; icon: string }> = {
  identity:     { label: 'Your identity',    description: 'Name, username, and profile photo', icon: 'person-circle-outline' },
  email:        { label: 'Email address',    description: 'Your registered email',              icon: 'mail-outline' },
  phone:        { label: 'Phone number',     description: 'Your registered phone number',       icon: 'call-outline' },
  'wallet:read':{ label: 'Wallet balance',   description: 'Read-only balance and currency',     icon: 'wallet-outline' },
};

type OAuthClientInfo = {
  clientId: string;
  appName: string;
  appDescription?: string;
  logoUrl?: string;
  websiteUrl?: string;
  allowedScopes: string[];
};

const QrLoginApprovalScreen = () => {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteType>();
  const { challengeToken, siteType, siteName, oauthClientId, oauthScopes } = route.params;

  const isThirdParty = siteType === 'THIRD_PARTY';
  const requestedScopes = oauthScopes ? oauthScopes.split(',').filter(Boolean) : [];

  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [clientInfo, setClientInfo] = useState<OAuthClientInfo | null>(null);
  const [clientLoading, setClientLoading] = useState(isThirdParty);

  const iconName = (SITE_ICONS[siteType] ?? 'globe') as never;

  useEffect(() => {
    if (!isThirdParty || !oauthClientId) return;
    fetchOAuthClientInfo(oauthClientId)
      .then(info => setClientInfo(info))
      .catch(() => {/* non-fatal; fall back to generic display */})
      .finally(() => setClientLoading(false));
  }, [isThirdParty, oauthClientId]);

  async function handleApprove() {
    setLoading(true);
    try {
      await authorizeQrLogin(challengeToken);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDone(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authorization failed';
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', msg, [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } finally {
      setLoading(false);
    }
  }

  function handleDeny() {
    navigation.goBack();
  }

  const displayName = isThirdParty
    ? (clientInfo?.appName ?? siteName)
    : siteName;

  if (done) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successCard}>
          <View style={[styles.iconCircle, { backgroundColor: Colors.primary + '20' }]}>
            <Ionicons name="checkmark-circle" size={48} color={Colors.primary} />
          </View>
          <Text style={styles.successTitle}>
            {isThirdParty ? 'Access granted' : 'Login approved'}
          </Text>
          <Text style={styles.successSub}>
            {isThirdParty
              ? `${displayName} can now access your account with the permissions you approved.`
              : `You can now continue in the ${displayName}.`}
          </Text>
          <Button
            title="Done"
            onPress={() => navigation.goBack()}
            backgroundColor={Colors.primary}
            textColor={Colors.black}
            borderRadius={26}
            paddingVertical={0}
            style={{ height: 52 }}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (isThirdParty && clientLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerLoader}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {isThirdParty && clientInfo?.logoUrl ? (
          <Image source={{ uri: clientInfo.logoUrl }} style={styles.appLogo} />
        ) : (
          <View style={[styles.iconCircle, { backgroundColor: Colors.primary + '20' }]}>
            <Ionicons name={iconName} size={40} color={Colors.primary} />
          </View>
        )}

        <Text style={styles.title}>
          {isThirdParty ? 'Authorize app?' : 'Authorize login?'}
        </Text>

        {isThirdParty ? (
          <>
            <Text style={styles.subtitle}>
              <Text style={styles.appName}>{displayName}</Text>
              {' is requesting access to your AZA account.'}
            </Text>

            {clientInfo?.appDescription ? (
              <Text style={styles.appDescription}>{clientInfo.appDescription}</Text>
            ) : null}

            {requestedScopes.length > 0 && (
              <View style={styles.scopesCard}>
                <Text style={styles.scopesTitle}>This app will be able to see:</Text>
                {requestedScopes.map(scope => {
                  const info = SCOPE_LABELS[scope];
                  return info ? (
                    <View key={scope} style={styles.scopeRow}>
                      <Ionicons name={info.icon as never} size={20} color={Colors.primary} />
                      <View style={styles.scopeText}>
                        <Text style={styles.scopeLabel}>{info.label}</Text>
                        <Text style={styles.scopeDesc}>{info.description}</Text>
                      </View>
                    </View>
                  ) : null;
                })}
              </View>
            )}
          </>
        ) : (
          <Text style={styles.subtitle}>
            A sign-in was requested for the{'\n'}
            <Text style={styles.appName}>{displayName}</Text>
          </Text>
        )}

        <View style={styles.warningBox}>
          <Ionicons name="information-circle-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.warningText}>
            {isThirdParty
              ? 'Only approve if you initiated this from a trusted device. You can revoke access at any time.'
              : 'Only approve if you initiated this login from a trusted device.'}
          </Text>
        </View>

        <View style={styles.actions}>
          <Button
            title={isThirdParty ? 'Approve Access' : 'Approve Login'}
            onPress={handleApprove}
            loading={loading}
            backgroundColor={Colors.primary}
            textColor={Colors.black}
            borderRadius={26}
            paddingVertical={0}
            style={{ height: 52 }}
          />
          <Button
            title="Deny"
            onPress={handleDeny}
            disabled={loading}
            backgroundColor="transparent"
            fontWeight="600"
            borderRadius={26}
            paddingVertical={0}
            style={{ height: 52, borderWidth: 0 }}
            textStyle={{ color: Colors.textSecondary }}
          />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

function createStyles(Colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    backButton: {
      padding: 16,
      alignSelf: 'flex-start',
    },
    content: {
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 40,
    },
    centerLoader: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    appLogo: {
      width: 80,
      height: 80,
      borderRadius: 20,
      marginBottom: 24,
    },
    iconCircle: {
      width: 88,
      height: 88,
      borderRadius: 44,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 24,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: Colors.textPrimary,
      marginBottom: 8,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 15,
      color: Colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 8,
    },
    appName: {
      color: Colors.textPrimary,
      fontWeight: '600',
    },
    appDescription: {
      fontSize: 13,
      color: Colors.textSecondary,
      textAlign: 'center',
      marginBottom: 16,
      lineHeight: 18,
    },
    scopesCard: {
      width: '100%',
      backgroundColor: Colors.surface,
      borderRadius: 16,
      padding: 16,
      marginTop: 8,
      marginBottom: 16,
      gap: 14,
    },
    scopesTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: Colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    scopeRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    scopeText: {
      flex: 1,
    },
    scopeLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.textPrimary,
    },
    scopeDesc: {
      fontSize: 12,
      color: Colors.textSecondary,
      marginTop: 1,
    },
    warningBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      backgroundColor: Colors.surface,
      borderRadius: 12,
      padding: 14,
      marginBottom: 32,
      width: '100%',
    },
    warningText: {
      flex: 1,
      fontSize: 13,
      color: Colors.textSecondary,
      lineHeight: 18,
    },
    actions: {
      width: '100%',
      gap: 12,
    },
    successCard: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    successTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: Colors.textPrimary,
      marginTop: 20,
      marginBottom: 8,
    },
    successSub: {
      fontSize: 15,
      color: Colors.textSecondary,
      textAlign: 'center',
      marginBottom: 40,
      lineHeight: 22,
    },
  });
}

export default QrLoginApprovalScreen;
