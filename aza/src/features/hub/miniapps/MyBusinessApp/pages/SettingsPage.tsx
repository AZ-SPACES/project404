import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, KeyboardAvoidingView, Platform,
  TouchableOpacity, Image, Switch, Alert, ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@react-native-vector-icons/feather';
import { Spacing, Radius } from '../../../../../theme';
import { NavProps } from '../types';
import { extractData } from '../helpers';
import {
  updateMerchant, uploadMerchantLogo,
  getMerchantAutoPayoutSettings, updateMerchantAutoPayoutSettings,
  getMerchantNotificationPrefs, updateMerchantNotificationPrefs,
} from '../../../../../services/api';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../../../lib/queryKeys';
import { queryClient } from '../../../../../lib/queryClient';
import { extractErrorMessage } from '../../../../../utils/errorUtils';
import InternalHeader from '../components/InternalHeader';
import FieldInput from '../components/FieldInput';
import PickerRow from '../components/PickerRow';
import PrimaryButton from '../components/PrimaryButton';

const SCHEDULES = ['DAILY', 'WEEKLY', 'MONTHLY'];
const SCHEDULE_LABELS: Record<string, string> = { DAILY: 'Daily', WEEKLY: 'Weekly', MONTHLY: 'Monthly' };

const NOTIFICATION_FIELDS: { key: string; label: string }[] = [
  { key: 'emailPaymentReceived', label: 'Payment received' },
  { key: 'emailDisputeOpened', label: 'Dispute opened' },
  { key: 'emailPayoutCompleted', label: 'Payout completed' },
  { key: 'emailPayoutFailed', label: 'Payout failed' },
  { key: 'emailInvoicePaid', label: 'Invoice paid' },
  { key: 'emailWeeklySummary', label: 'Weekly summary' },
  { key: 'emailApiKeyCreated', label: 'API key created' },
  { key: 'emailLowBalance', label: 'Low balance alert' },
];

export default function SettingsPage({ merchant, goBack, Colors, styles }: NavProps) {
  // Business profile
  const [businessName, setBusinessName] = useState(merchant?.businessName ?? '');
  const [businessEmail, setBusinessEmail] = useState(merchant?.businessEmail ?? '');
  const [businessPhone, setBusinessPhone] = useState(merchant?.businessPhone ?? '');
  const [businessDescription, setBusinessDescription] = useState(merchant?.businessDescription ?? '');
  const [supportEmail, setSupportEmail] = useState(merchant?.supportEmail ?? '');
  const [checkoutTagline, setCheckoutTagline] = useState(merchant?.checkoutTagline ?? '');
  const [brandColor, setBrandColor] = useState(merchant?.brandColor ?? '');
  const [taxEnabled, setTaxEnabled] = useState(!!merchant?.taxEnabled);
  const [taxRate, setTaxRate] = useState(
    merchant?.taxRate != null ? String(merchant.taxRate) : '',
  );
  const [taxLabel, setTaxLabel] = useState(merchant?.taxLabel ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Auto-payout
  const { data: autoPayout } = useQuery({
    queryKey: queryKeys.merchantAutoPayout(),
    queryFn: async () => extractData(await getMerchantAutoPayoutSettings()),
    staleTime: 60_000,
  });
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoSchedule, setAutoSchedule] = useState('WEEKLY');
  const [autoMinBalance, setAutoMinBalance] = useState('');
  const [savingAutoPayout, setSavingAutoPayout] = useState(false);

  useEffect(() => {
    if (autoPayout) {
      setAutoEnabled(!!autoPayout.autoPayoutEnabled);
      setAutoSchedule(autoPayout.autoPayoutSchedule ?? 'WEEKLY');
      setAutoMinBalance(autoPayout.autoPayoutMinBalance != null ? String(autoPayout.autoPayoutMinBalance) : '');
    }
  }, [autoPayout]);

  // Notification preferences
  const { data: prefs } = useQuery({
    queryKey: queryKeys.merchantNotificationPrefs(),
    queryFn: async () => extractData(await getMerchantNotificationPrefs()),
    staleTime: 60_000,
  });
  const [notif, setNotif] = useState<Record<string, boolean>>({});
  const [lowBalanceThreshold, setLowBalanceThreshold] = useState('');
  const [savingNotif, setSavingNotif] = useState(false);

  useEffect(() => {
    if (prefs) {
      const next: Record<string, boolean> = {};
      NOTIFICATION_FIELDS.forEach(({ key }) => { next[key] = !!prefs[key]; });
      setNotif(next);
      setLowBalanceThreshold(prefs.lowBalanceThreshold != null ? String(prefs.lowBalanceThreshold) : '');
    }
  }, [prefs]);

  const pickLogo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (result.canceled || !result.assets?.[0]) return;
      setUploadingLogo(true);
      const asset = result.assets[0];
      await uploadMerchantLogo({
        uri: asset.uri,
        name: asset.fileName ?? 'logo.jpg',
        type: asset.mimeType ?? 'image/jpeg',
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.merchant() });
    } catch (e: unknown) {
      Alert.alert('Error', extractErrorMessage(e, 'Failed to upload logo.'));
    } finally {
      setUploadingLogo(false);
    }
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      await updateMerchant({
        businessName: businessName.trim() || undefined,
        businessEmail: businessEmail.trim() || undefined,
        businessPhone: businessPhone.trim() || undefined,
        businessDescription: businessDescription.trim() || undefined,
        supportEmail: supportEmail.trim() || undefined,
        checkoutTagline: checkoutTagline.trim() || undefined,
        brandColor: brandColor.trim() || undefined,
        taxEnabled,
        taxRate: taxRate ? parseFloat(taxRate) : undefined,
        taxLabel: taxLabel.trim() || undefined,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.merchant() });
      Alert.alert('Saved', 'Business profile updated.');
    } catch (e: unknown) {
      Alert.alert('Error', extractErrorMessage(e, 'Failed to update profile.'));
    } finally {
      setSavingProfile(false);
    }
  };

  const saveAutoPayout = async () => {
    setSavingAutoPayout(true);
    try {
      await updateMerchantAutoPayoutSettings({
        autoPayoutEnabled: autoEnabled,
        autoPayoutSchedule: autoSchedule as 'DAILY' | 'WEEKLY' | 'MONTHLY',
        autoPayoutMinBalance: autoMinBalance ? parseFloat(autoMinBalance) : undefined,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.merchantAutoPayout() });
      Alert.alert('Saved', 'Auto-payout settings updated.');
    } catch (e: unknown) {
      Alert.alert('Error', extractErrorMessage(e, 'Failed to update auto-payout settings.'));
    } finally {
      setSavingAutoPayout(false);
    }
  };

  const saveNotifications = async () => {
    setSavingNotif(true);
    try {
      await updateMerchantNotificationPrefs({
        ...notif,
        lowBalanceThreshold: lowBalanceThreshold ? parseFloat(lowBalanceThreshold) : undefined,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.merchantNotificationPrefs() });
      Alert.alert('Saved', 'Notification preferences updated.');
    } catch (e: unknown) {
      Alert.alert('Error', extractErrorMessage(e, 'Failed to update notification preferences.'));
    } finally {
      setSavingNotif(false);
    }
  };

  const switchRow = (label: string, value: boolean, onChange: (v: boolean) => void) => (
    <View
      key={label}
      style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingVertical: Spacing.sm,
      }}
    >
      <Text style={{ fontSize: 14, color: Colors.textPrimary, flex: 1 }}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: Colors.border, true: Colors.primary }}
        thumbColor="#fff"
      />
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled">
        <InternalHeader title="Business Settings" onBack={goBack} Colors={Colors} styles={styles} />

        {/* Logo */}
        <View style={{ alignItems: 'center', marginBottom: Spacing.lg }}>
          <TouchableOpacity onPress={pickLogo} disabled={uploadingLogo} accessibilityLabel="Change business logo">
            {merchant?.logoUrl ? (
              <Image source={{ uri: merchant.logoUrl }} style={{ width: 88, height: 88, borderRadius: 44 }} />
            ) : (
              <View style={{
                width: 88, height: 88, borderRadius: 44, backgroundColor: Colors.surface,
                borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center',
              }}>
                <Feather name="briefcase" size={32} color={Colors.textSecondary} />
              </View>
            )}
            <View style={{
              position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14,
              backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
            }}>
              {uploadingLogo ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="camera" size={14} color="#fff" />}
            </View>
          </TouchableOpacity>
          <Text style={{ fontSize: 12, color: Colors.textSecondary, marginTop: Spacing.sm }}>
            Tap to change logo
          </Text>
        </View>

        {/* Business profile */}
        <Text style={[styles.sectionDivider, { color: Colors.textSecondary, borderBottomColor: Colors.border }]}>BUSINESS PROFILE</Text>
        <FieldInput label="Business Name" value={businessName} onChangeText={setBusinessName} placeholder="My Business" Colors={Colors} styles={styles} />
        <FieldInput label="Business Email" value={businessEmail} onChangeText={setBusinessEmail} placeholder="hello@business.com" keyboardType="email-address" Colors={Colors} styles={styles} />
        <FieldInput label="Business Phone" value={businessPhone} onChangeText={setBusinessPhone} placeholder="+233 ..." keyboardType="phone-pad" Colors={Colors} styles={styles} />
        <FieldInput label="Description" value={businessDescription} onChangeText={setBusinessDescription} placeholder="What does your business do?" multiline Colors={Colors} styles={styles} />
        <FieldInput label="Support Email" value={supportEmail} onChangeText={setSupportEmail} placeholder="support@business.com" keyboardType="email-address" Colors={Colors} styles={styles} />

        {/* Checkout branding */}
        <Text style={[styles.sectionDivider, { color: Colors.textSecondary, borderBottomColor: Colors.border }]}>CHECKOUT BRANDING</Text>
        <FieldInput label="Checkout Tagline" value={checkoutTagline} onChangeText={setCheckoutTagline} placeholder="Thanks for shopping with us!" Colors={Colors} styles={styles} />
        <FieldInput label="Brand Color (hex)" value={brandColor} onChangeText={setBrandColor} placeholder="#1A73E8" Colors={Colors} styles={styles} />
        {/^#([0-9A-Fa-f]{6})$/.test(brandColor.trim()) && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: -Spacing.sm, marginBottom: Spacing.md }}>
            <View style={{ width: 20, height: 20, borderRadius: 4, backgroundColor: brandColor.trim(), borderWidth: 1, borderColor: Colors.border }} />
            <Text style={{ fontSize: 12, color: Colors.textSecondary }}>Preview</Text>
          </View>
        )}

        {/* Tax */}
        <Text style={[styles.sectionDivider, { color: Colors.textSecondary, borderBottomColor: Colors.border }]}>TAX</Text>
        {switchRow('Charge tax at checkout', taxEnabled, setTaxEnabled)}
        {taxEnabled && (
          <>
            <FieldInput label="Tax Rate (%)" value={taxRate} onChangeText={setTaxRate} placeholder="15" keyboardType="decimal-pad" Colors={Colors} styles={styles} />
            <FieldInput label="Tax Label" value={taxLabel} onChangeText={setTaxLabel} placeholder="VAT" Colors={Colors} styles={styles} />
          </>
        )}
        <PrimaryButton label="Save Profile" onPress={saveProfile} loading={savingProfile} Colors={Colors} styles={styles} />

        {/* Auto-payout */}
        <Text style={[styles.sectionDivider, { color: Colors.textSecondary, borderBottomColor: Colors.border, marginTop: Spacing.xl }]}>AUTO-PAYOUT</Text>
        {switchRow('Automatically pay out to wallet', autoEnabled, setAutoEnabled)}
        {autoEnabled && (
          <>
            <PickerRow
              label="Schedule"
              options={SCHEDULES}
              optionLabels={SCHEDULE_LABELS}
              value={autoSchedule}
              onChange={setAutoSchedule}
              Colors={Colors}
              styles={styles}
            />
            <FieldInput label="Minimum Balance (GHS)" value={autoMinBalance} onChangeText={setAutoMinBalance} placeholder="100.00" keyboardType="decimal-pad" Colors={Colors} styles={styles} />
          </>
        )}
        <PrimaryButton label="Save Auto-Payout" onPress={saveAutoPayout} loading={savingAutoPayout} Colors={Colors} styles={styles} />

        {/* Notifications */}
        <Text style={[styles.sectionDivider, { color: Colors.textSecondary, borderBottomColor: Colors.border, marginTop: Spacing.xl }]}>EMAIL NOTIFICATIONS</Text>
        {NOTIFICATION_FIELDS.map(({ key, label }) =>
          switchRow(label, !!notif[key], (v) => setNotif((p) => ({ ...p, [key]: v }))),
        )}
        {notif.emailLowBalance && (
          <FieldInput label="Low Balance Threshold (GHS)" value={lowBalanceThreshold} onChangeText={setLowBalanceThreshold} placeholder="50.00" keyboardType="decimal-pad" Colors={Colors} styles={styles} />
        )}
        <PrimaryButton label="Save Notifications" onPress={saveNotifications} loading={savingNotif} Colors={Colors} styles={styles} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
