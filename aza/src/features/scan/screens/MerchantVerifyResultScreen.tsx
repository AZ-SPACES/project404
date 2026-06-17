import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';
import { BackButton } from '../../../components/ui/BackButton';
import Button from '../../../components/ui/Button';
import { getPublicMerchant } from '../../../services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'MerchantVerifyResult'>;

interface Merchant {
  businessName?: string;
  businessHandle?: string;
  businessDescription?: string;
  logoUrl?: string;
  category?: string;
  status?: string;
  currency?: string;
  brandColor?: string;
  checkoutTagline?: string;
  supportEmail?: string;
}

type State = 'loading' | 'verified' | 'inactive' | 'notfound' | 'error';

function prettyCategory(c?: string) {
  if (!c) return undefined;
  return c.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
}

const MerchantVerifyResultScreen = ({ route, navigation }: Props) => {
  const { handle, amount, note } = route.params;
  const { colors: Colors } = useAppTheme();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const [state, setState] = useState<State>('loading');
  const [merchant, setMerchant] = useState<Merchant | null>(null);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const res = await getPublicMerchant(handle);
      const data: Merchant = res?.data?.data ?? {};
      setMerchant(data);
      setState('verified');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      const status = e?.response?.status;
      // 403 = exists but not ACTIVE; 404 = no such handle.
      setState(status === 403 ? 'inactive' : status === 404 ? 'notfound' : 'error');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }, [handle]);

  useEffect(() => {
    load();
  }, [load]);

  const onPay = () => {
    navigation.navigate('SendAmount', {
      name: merchant?.businessName ?? `@${handle}`,
      username: `@${handle}`,
      avatar: merchant?.logoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(merchant?.businessName ?? handle)}&background=random`,
      identifier: `@${handle}`,
      ...(amount !== undefined ? { amount } : {}),
      ...(note ? { note } : {}),
    });
  };

  const verified = state === 'verified';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={[Typography.h2, { color: Colors.textPrimary, marginLeft: Spacing.md }]}>
          Business Verification
        </Text>
      </View>

      {state === 'loading' ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={[Typography.body, { color: Colors.textSecondary, marginTop: Spacing.md }]}>
            Checking @{handle}…
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View
            style={[
              styles.banner,
              {
                backgroundColor: (verified ? Colors.success : Colors.error) + '22',
                borderColor: verified ? Colors.success : Colors.error,
              },
            ]}
          >
            <View style={[styles.bannerIcon, { backgroundColor: verified ? Colors.success : Colors.error }]}>
              <Ionicons name={verified ? 'shield-checkmark' : 'close'} size={22} color={Colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.bannerTitle, { color: verified ? Colors.success : Colors.error }]}>
                {verified ? 'Verified business' : state === 'inactive' ? 'Not active' : state === 'notfound' ? 'Not found' : 'Couldn’t verify'}
              </Text>
              <Text style={[styles.bannerSubtitle, { color: Colors.textSecondary }]}>
                {verified
                  ? 'This is a KYB-verified business on AZA. It’s safe to pay.'
                  : state === 'inactive'
                  ? `@${handle} is registered but not currently accepting payments. Do not pay until it’s active.`
                  : state === 'notfound'
                  ? `No verified AZA business or user found for @${handle}.`
                  : 'We couldn’t reach the verification service. Check your connection and try again.'}
              </Text>
            </View>
          </View>

          {verified && merchant && (
            <>
              <View style={styles.brandRow}>
                {merchant.logoUrl ? (
                  <Image source={{ uri: merchant.logoUrl }} style={styles.logo} />
                ) : (
                  <View style={[styles.logo, styles.logoFallback]}>
                    <Text style={styles.logoFallbackText}>
                      {(merchant.businessName ?? handle).charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.bizName} numberOfLines={2}>{merchant.businessName ?? `@${handle}`}</Text>
                  <Text style={styles.bizHandle}>@{merchant.businessHandle ?? handle}</Text>
                </View>
              </View>

              {merchant.checkoutTagline ? (
                <Text style={styles.tagline}>{merchant.checkoutTagline}</Text>
              ) : null}

              <View style={styles.card}>
                {prettyCategory(merchant.category) ? (
                  <Row label="Category" value={prettyCategory(merchant.category)} Colors={Colors} />
                ) : null}
                {merchant.businessDescription ? (
                  <Row label="About" value={merchant.businessDescription} Colors={Colors} />
                ) : null}
                <Row label="Currency" value={merchant.currency ?? 'GHS'} Colors={Colors} />
                {merchant.supportEmail ? (
                  <Row label="Support" value={merchant.supportEmail} Colors={Colors} last />
                ) : null}
              </View>

              <Button
                title={amount !== undefined ? `Pay ${merchant.currency ?? 'GHS'} ${amount.toFixed(2)}` : 'Pay this business'}
                onPress={onPay}
                backgroundColor={Colors.primary}
                textColor={Colors.white}
                style={{ marginTop: Spacing.xl }}
              />
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

function Row({
  label,
  value,
  last,
  Colors,
}: {
  label: string;
  value?: string | undefined;
  last?: boolean | undefined;
  Colors: ThemeColors;
}) {
  return (
    <View style={[rowStyles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border }]}>
      <Text style={[rowStyles.label, { color: Colors.textSecondary }]}>{label}</Text>
      <Text style={[rowStyles.value, { color: Colors.textPrimary }]} numberOfLines={3}>
        {value ?? '—'}
      </Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    gap: 12,
  },
  label: { fontSize: 14, flexShrink: 0 },
  value: { fontSize: 14, fontWeight: '600', textAlign: 'right', flexShrink: 1 },
});

function createStyles(Colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.md,
    },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
    content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl * 2 },
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: Spacing.lg,
      borderRadius: Radius.md,
      borderWidth: 1,
      marginBottom: Spacing.xl,
    },
    bannerIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    bannerTitle: { fontSize: 16, fontWeight: '700' },
    bannerSubtitle: { fontSize: 13, marginTop: 4, lineHeight: 18 },
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: Spacing.md },
    logo: { width: 56, height: 56, borderRadius: 12, backgroundColor: Colors.surface },
    logoFallback: { justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
    logoFallbackText: { fontSize: 24, fontWeight: '800', color: Colors.primary },
    bizName: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
    bizHandle: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
    tagline: { fontSize: 14, color: Colors.textSecondary, fontStyle: 'italic', marginBottom: Spacing.md },
    card: {
      backgroundColor: Colors.surface,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: Colors.border,
      paddingHorizontal: Spacing.lg,
    },
  });
}

export default MerchantVerifyResultScreen;
