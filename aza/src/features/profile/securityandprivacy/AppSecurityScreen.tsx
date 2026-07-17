import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Switch, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@react-native-vector-icons/feather';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { MaterialDesignIcons as MaterialCommunityIcons } from '@react-native-vector-icons/material-design-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as LocalAuthentication from 'expo-local-authentication';
import { RootStackParamList } from '../../../navigation/types';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';
import { useAuth } from '../../../providers/AuthProvider';
import { useSecurity, LOCK_TIMEOUT_OPTIONS } from '../../../providers/SecurityProvider';
import { BackButton } from '../../../components/ui/BackButton';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'AppSecurity'>;
type AppSecurityRouteProp = RouteProp<RootStackParamList, 'AppSecurity'>;

export function AppSecurityScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavProp>();
  const route = useRoute<AppSecurityRouteProp>();
  const { isBiometricsEnabled, toggleBiometrics } = useAuth();
  const { appLockEnabled, setAppLockEnabled, lockTimeoutMs, setLockTimeout } = useSecurity();
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [showTimeoutPicker, setShowTimeoutPicker] = useState(false);

  // Disable app lock if we returned here after passcode verification
  useEffect(() => {
    const params = route.params as { disableAppLock?: boolean } | undefined;
    if (params?.disableAppLock) {
      setAppLockEnabled(false);
    }
  }, [route.params]);

  useEffect(() => {
    LocalAuthentication.hasHardwareAsync().then(has => {
      if (!has) { setBiometricsAvailable(false); return; }
      LocalAuthentication.isEnrolledAsync().then(enrolled => setBiometricsAvailable(enrolled));
    });
  }, []);

  const handleBiometricsToggle = async (enabled: boolean) => {
    if (enabled && !biometricsAvailable) {
      Alert.alert(
        'Biometrics not available',
        'Your device does not have biometrics enrolled. Please set up Face ID or fingerprint in your device settings.',
      );
      return;
    }
    if (enabled) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Confirm your identity to enable biometrics',
        fallbackLabel: 'Use Passcode',
      });
      if (!result.success) return;
    }
    toggleBiometrics(enabled);
  };

  const currentTimeoutLabel =
    LOCK_TIMEOUT_OPTIONS.find(o => o.value === lockTimeoutMs)?.label ?? '5 minutes';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" />

      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.titleSection}>
          <Text style={styles.mainTitle}>App security</Text>
          <Text style={styles.mainSubtitle}>
            Control how Aza locks and who can unlock it.
          </Text>
        </View>

        {/* Master toggle */}
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.iconWrap}>
              <Feather name="lock" size={22} color={Colors.textPrimary} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>App lock</Text>
              <Text style={styles.rowSubtitle}>
                {appLockEnabled
                  ? 'Aza locks when you leave the app'
                  : 'Aza opens without asking for passcode or biometrics'}
              </Text>
            </View>
            <Switch
              value={appLockEnabled}
              onValueChange={async (val) => {
                if (!val) {
                  navigation.navigate('VerifyPasscode', {
                    onSuccessScreen: 'AppSecurity',
                    onSuccessParams: { disableAppLock: true },
                  });
                } else {
                  await setAppLockEnabled(true);
                }
              }}
              trackColor={{ false: isDark ? Colors.surface : '#E5E7EB', true: Colors.primary }}
              thumbColor={Colors.white}
              ios_backgroundColor={isDark ? Colors.surface : '#E5E7EB'}
            />
          </View>
        </View>

        {appLockEnabled && (
          <>
        {/* Unlock method */}
        <Text style={[styles.sectionLabel, { marginTop: Spacing.xl }]}>Unlock method</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.iconWrap}>
              <MaterialCommunityIcons name="face-recognition" size={22} color={Colors.textPrimary} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>
                {isBiometricsEnabled ? 'Biometrics enabled' : 'Use biometrics'}
              </Text>
              <Text style={styles.rowSubtitle}>
                {isBiometricsEnabled
                  ? 'Face ID or fingerprint unlocks the app'
                  : 'Use Face ID or fingerprint instead of passcode'}
              </Text>
            </View>
            <Switch
              value={isBiometricsEnabled}
              onValueChange={handleBiometricsToggle}
              trackColor={{ false: isDark ? Colors.surface : '#E5E7EB', true: Colors.primary }}
              thumbColor={Colors.white}
              ios_backgroundColor={isDark ? Colors.surface : '#E5E7EB'}
            />
          </View>

          <View style={styles.separator} />

          <TouchableOpacity
            style={styles.row}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('VerifyPasscode', { onSuccessScreen: 'CreatePasscode', onSuccessParams: { mode: 'change' } })}
          >
            <View style={styles.iconWrap}>
              <Feather name="hash" size={22} color={Colors.textPrimary} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Change passcode</Text>
              <Text style={styles.rowSubtitle}>Update your 4-digit unlock passcode</Text>
            </View>
            <Feather name="chevron-right" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Auto-lock */}
        <Text style={[styles.sectionLabel, { marginTop: Spacing.xl }]}>Auto-lock</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.row}
            activeOpacity={0.7}
            onPress={() => setShowTimeoutPicker(v => !v)}
          >
            <View style={styles.iconWrap}>
              <Feather name="clock" size={22} color={Colors.textPrimary} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Lock after</Text>
              <Text style={styles.rowSubtitle}>
                Lock when app has been in background for {currentTimeoutLabel.toLowerCase()}
              </Text>
            </View>
            <View style={styles.valueChip}>
              <Text style={styles.valueChipText}>{currentTimeoutLabel}</Text>
            </View>
          </TouchableOpacity>

          {showTimeoutPicker && (
            <View style={styles.timeoutOptions}>
              {LOCK_TIMEOUT_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={styles.timeoutOption}
                  activeOpacity={0.7}
                  onPress={() => { setLockTimeout(opt.value); setShowTimeoutPicker(false); }}
                >
                  <Text style={[
                    styles.timeoutOptionText,
                    lockTimeoutMs === opt.value && styles.timeoutOptionSelected,
                  ]}>
                    {opt.label}
                  </Text>
                  {lockTimeoutMs === opt.value && (
                    <Feather name="check" size={16} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

          </>
        )}

        {/* Info box */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={18} color={Colors.textSecondary} />
          <Text style={styles.infoText}>
            Aza will always ask for authentication before confirming payments, regardless of these settings.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: Colors.background },
    header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.sm },
    scroll: { paddingHorizontal: Spacing.lg, paddingBottom: 40 },
    titleSection: { marginTop: Spacing.md, marginBottom: Spacing.xl },
    mainTitle: {
      fontSize: Typography.h1.fontSize,
      fontWeight: Typography.h1.fontWeight,
      color: Colors.textPrimary,
      marginBottom: 6,
    },
    mainSubtitle: {
      fontSize: 15,
      color: Colors.textSecondary,
      lineHeight: 22,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: Colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: Spacing.sm,
    },
    card: {
      backgroundColor: isDark ? Colors.surface : '#FFFFFF',
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: Colors.border,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: 14,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(22,51,0,0.05)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.md,
    },
    rowText: { flex: 1, paddingRight: Spacing.sm },
    rowTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: Colors.textPrimary,
      marginBottom: 3,
    },
    rowSubtitle: {
      fontSize: 13,
      color: Colors.textSecondary,
      lineHeight: 18,
    },
    separator: {
      height: 1,
      backgroundColor: Colors.border,
      marginHorizontal: Spacing.md,
    },
    valueChip: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(22,51,0,0.06)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
    },
    valueChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: Colors.primary,
    },
    timeoutOptions: {
      borderTopWidth: 1,
      borderTopColor: Colors.border,
      paddingVertical: Spacing.xs,
    },
    timeoutOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: 13,
    },
    timeoutOptionText: {
      fontSize: 15,
      color: Colors.textPrimary,
    },
    timeoutOptionSelected: {
      fontWeight: '600',
      color: Colors.primary,
    },
    infoBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      backgroundColor: isDark ? Colors.surface : '#F9FAFB',
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: Radius.sm,
      padding: 14,
      marginTop: Spacing.xl,
    },
    infoText: {
      flex: 1,
      fontSize: 13,
      color: Colors.textSecondary,
      lineHeight: 19,
    },
  });
}
