import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Clipboard,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';
import { MiniAppProps } from './types';
import {
  getMerchant,
  registerMerchant,
  getMerchantKybStatus,
  submitMerchantKyb,
  submitKybFinal,
  getMerchantSessions,
  createMerchantSession,
  getMerchantApiKeys,
  createMerchantApiKey,
  revokeMerchantApiKey,
  getMerchantWebhooks,
  createMerchantWebhook,
  deleteMerchantWebhook,
  getMerchantPayouts,
  requestMerchantPayout,
} from '../../../services/api';

// ── Types ────────────────────────────────────────────────────────────────────

type Page =
  | 'loading'
  | 'intro'
  | 'register'
  | 'kyb_form'
  | 'kyb_docs'
  | 'under_review'
  | 'rejected'
  | 'suspended'
  | 'dashboard'
  | 'sessions'
  | 'create_session'
  | 'api_keys'
  | 'webhooks'
  | 'payouts';

interface MerchantData {
  id: string;
  businessName: string;
  businessHandle: string;
  businessEmail?: string;
  businessPhone?: string;
  businessDescription?: string;
  logoUrl?: string;
  category?: string;
  status: string;
  balance?: number;
  currency?: string;
  totalVolume?: number;
  feeRateBps?: number;
  rejectionReason?: string;
  moreInfoRequest?: string;
}

interface NavProps {
  navigate: (page: Page) => void;
  goBack: () => void;
  merchant: MerchantData | null;
  onMerchantUpdate: (m: MerchantData) => void;
  Colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}

const BUSINESS_CATEGORIES = [
  'RETAIL', 'FOOD_AND_BEVERAGE', 'SERVICES', 'TECHNOLOGY',
  'HEALTHCARE', 'EDUCATION', 'ENTERTAINMENT', 'TRANSPORT',
  'REAL_ESTATE', 'AGRICULTURE', 'FINANCE', 'OTHER',
];

const CATEGORY_LABELS: Record<string, string> = {
  RETAIL: 'Retail', FOOD_AND_BEVERAGE: 'Food & Beverage',
  SERVICES: 'Services', TECHNOLOGY: 'Technology',
  HEALTHCARE: 'Healthcare', EDUCATION: 'Education',
  ENTERTAINMENT: 'Entertainment', TRANSPORT: 'Transport',
  REAL_ESTATE: 'Real Estate', AGRICULTURE: 'Agriculture',
  FINANCE: 'Finance', OTHER: 'Other',
};

const BUSINESS_TYPES = [
  'SOLE_PROPRIETORSHIP', 'PARTNERSHIP', 'LIMITED_LIABILITY',
  'CORPORATION', 'NON_PROFIT', 'OTHER',
];

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  SOLE_PROPRIETORSHIP: 'Sole Proprietorship', PARTNERSHIP: 'Partnership',
  LIMITED_LIABILITY: 'Limited Liability (LLC)', CORPORATION: 'Corporation',
  NON_PROFIT: 'Non-Profit', OTHER: 'Other',
};

const ID_TYPES = ['PASSPORT', 'NATIONAL_ID', 'DRIVERS_LICENSE'];
const ID_TYPE_LABELS: Record<string, string> = {
  PASSPORT: 'Passport', NATIONAL_ID: 'National ID', DRIVERS_LICENSE: "Driver's License",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#FF9800', COMPLETED: '#4CAF50', EXPIRED: '#9E9E9E',
  CANCELLED: '#F44336', ACTIVE: '#4CAF50', PENDING_KYB: '#FF9800',
  KYB_SUBMITTED: '#2196F3', KYB_UNDER_REVIEW: '#2196F3',
  MORE_INFO_REQUIRED: '#FF5722', SUSPENDED: '#F44336', REJECTED: '#F44336',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractData(response: any) {
  return response?.data?.data ?? response?.data;
}

function fmtAmount(amount?: number, currency = 'GHS') {
  if (amount == null) return '—';
  return `${currency === 'GHS' ? 'GH₵' : currency} ${Number(amount).toFixed(2)}`;
}

function fmtDate(dateStr?: string) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GH', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function statusLabel(s: string) {
  return s.replace(/_/g, ' ');
}

// ── Sub-components ───────────────────────────────────────────────────────────

function InternalHeader({
  title,
  onBack,
  Colors,
  styles,
}: {
  title: string;
  onBack: () => void;
  Colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.internalHeader}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
        <Feather name="arrow-left" size={22} color={Colors.textPrimary} />
      </TouchableOpacity>
      <Text style={[styles.internalHeaderTitle, { color: Colors.textPrimary }]}>{title}</Text>
      <View style={styles.backBtn} />
    </View>
  );
}

function StatusBadge({ status, Colors }: { status: string; Colors: ThemeColors }) {
  const color = STATUS_COLORS[status] ?? '#757575';
  return (
    <View style={{ backgroundColor: color + '22', borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 3 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color }}>{statusLabel(status)}</Text>
    </View>
  );
}

function FieldInput({
  label, value, onChangeText, placeholder, keyboardType, secureTextEntry, multiline, Colors, styles,
}: {
  label: string; value: string; onChangeText: (v: string) => void; placeholder?: string;
  keyboardType?: any; secureTextEntry?: boolean; multiline?: boolean;
  Colors: ThemeColors; styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={{ marginBottom: Spacing.md }}>
      <Text style={[styles.fieldLabel, { color: Colors.textSecondary }]}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, { color: Colors.textPrimary, borderColor: Colors.border, backgroundColor: Colors.surface }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textSecondary}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}

function PickerRow({
  label, options, optionLabels, value, onChange, Colors, styles,
}: {
  label: string; options: string[]; optionLabels: Record<string, string>;
  value: string; onChange: (v: string) => void;
  Colors: ThemeColors; styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={{ marginBottom: Spacing.md }}>
      <Text style={[styles.fieldLabel, { color: Colors.textSecondary }]}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm, paddingVertical: 4 }}>
        {options.map((opt) => {
          const active = value === opt;
          return (
            <TouchableOpacity
              key={opt}
              onPress={() => onChange(opt)}
              style={[styles.chip, active && { backgroundColor: Colors.primary, borderColor: Colors.primary }]}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
            >
              <Text style={[styles.chipText, { color: active ? Colors.secondary : Colors.textSecondary }]}>
                {optionLabels[opt] ?? opt}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

function PrimaryButton({
  label, onPress, disabled, loading, Colors, styles,
}: {
  label: string; onPress: () => void; disabled?: boolean; loading?: boolean;
  Colors: ThemeColors; styles: ReturnType<typeof createStyles>;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.primaryBtn, (disabled || loading) && { opacity: 0.45 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {loading
        ? <ActivityIndicator color={Colors.secondary} />
        : <Text style={[styles.primaryBtnText, { color: Colors.secondary }]}>{label}</Text>}
    </TouchableOpacity>
  );
}

// ── Page: Intro ───────────────────────────────────────────────────────────────

function IntroPage({ navigate, Colors, styles }: NavProps) {
  return (
    <ScrollView contentContainerStyle={[styles.pageContent, { alignItems: 'center' }]}>
      <View style={[styles.bigIcon, { backgroundColor: Colors.primary + '18' }]}>
        <Text style={{ fontSize: 56 }}>🏪</Text>
      </View>
      <Text style={[styles.introTitle, { color: Colors.textPrimary }]}>Business on Aza</Text>
      <Text style={[styles.introSubtitle, { color: Colors.textSecondary }]}>
        Accept payments from millions of Aza users. Create payment links, manage payouts, and build with our API.
      </Text>

      <View style={[styles.featureList, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
        {[
          ['💳', 'Accept Payments', 'Instant GHS payments from Aza users'],
          ['🔗', 'Payment Links', 'Share links that open a hosted checkout'],
          ['🔑', 'Developer API', 'Build integrations with your own API keys'],
          ['💸', 'Instant Payouts', 'Withdraw your balance to your Aza wallet'],
        ].map(([icon, title, desc]) => (
          <View key={title as string} style={styles.featureRow}>
            <Text style={{ fontSize: 22, width: 32 }}>{icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.featureTitle, { color: Colors.textPrimary }]}>{title}</Text>
              <Text style={[styles.featureDesc, { color: Colors.textSecondary }]}>{desc}</Text>
            </View>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.primaryBtn, { marginTop: Spacing.xl, width: '100%' }]}
        onPress={() => navigate('register')}
        accessibilityRole="button"
      >
        <Text style={[styles.primaryBtnText, { color: Colors.secondary }]}>Open Business Account</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ── Page: Register ────────────────────────────────────────────────────────────

function RegisterPage({ navigate, goBack, onMerchantUpdate, Colors, styles }: NavProps) {
  const [businessName, setBusinessName] = useState('');
  const [businessHandle, setBusinessHandle] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('RETAIL');
  const [loading, setLoading] = useState(false);

  const handleHandleChange = (v: string) => {
    setBusinessHandle(v.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase());
  };

  const canSubmit = businessName.trim().length >= 2 && businessHandle.length >= 3;

  const submit = async () => {
    setLoading(true);
    try {
      const res = await registerMerchant({
        businessName: businessName.trim(),
        businessHandle,
        category,
        ...(businessEmail.trim() && { businessEmail: businessEmail.trim() }),
        ...(businessPhone.trim() && { businessPhone: businessPhone.trim() }),
        ...(description.trim() && { businessDescription: description.trim() }),
      });
      const merchant = extractData(res);
      if (merchant) {
        onMerchantUpdate(merchant);
        navigate('kyb_form');
      }
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message ?? 'Registration failed. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled">
        <InternalHeader title="Register Business" onBack={goBack} Colors={Colors} styles={styles} />

        <FieldInput label="Business Name *" value={businessName} onChangeText={setBusinessName} placeholder="Acme Ltd" Colors={Colors} styles={styles} />
        <FieldInput label="Business Handle *" value={businessHandle} onChangeText={handleHandleChange} placeholder="acme" Colors={Colors} styles={styles} />
        <Text style={[styles.hint, { color: Colors.textSecondary }]}>@{businessHandle || 'yourhandle'} · lowercase letters, numbers, underscores</Text>

        <PickerRow label="Category" options={BUSINESS_CATEGORIES} optionLabels={CATEGORY_LABELS} value={category} onChange={setCategory} Colors={Colors} styles={styles} />

        <FieldInput label="Business Email" value={businessEmail} onChangeText={setBusinessEmail} placeholder="hello@business.com" keyboardType="email-address" Colors={Colors} styles={styles} />
        <FieldInput label="Business Phone" value={businessPhone} onChangeText={setBusinessPhone} placeholder="+233 XX XXX XXXX" keyboardType="phone-pad" Colors={Colors} styles={styles} />
        <FieldInput label="Description" value={description} onChangeText={setDescription} placeholder="What does your business do?" multiline Colors={Colors} styles={styles} />

        <PrimaryButton label="Continue to KYB" onPress={submit} disabled={!canSubmit} loading={loading} Colors={Colors} styles={styles} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Page: KYB Form ────────────────────────────────────────────────────────────

function KybFormPage({ navigate, goBack, merchant, onMerchantUpdate, Colors, styles }: NavProps) {
  const [businessType, setBusinessType] = useState('SOLE_PROPRIETORSHIP');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [registeredAddress, setRegisteredAddress] = useState('');
  const [city, setCity] = useState('');
  const [taxIdNumber, setTaxIdNumber] = useState('');
  const [website, setWebsite] = useState('');
  const [ownerFullName, setOwnerFullName] = useState('');
  const [ownerIdType, setOwnerIdType] = useState('NATIONAL_ID');
  const [ownerIdNumber, setOwnerIdNumber] = useState('');
  const [loading, setLoading] = useState(false);

  const canSubmit = ownerFullName.trim().length >= 2;

  const submit = async () => {
    setLoading(true);
    try {
      await submitMerchantKyb({
        businessType,
        ownerFullName: ownerFullName.trim(),
        ownerIdType,
        ...(registrationNumber.trim() && { registrationNumber: registrationNumber.trim() }),
        ...(registeredAddress.trim() && { registeredAddress: registeredAddress.trim() }),
        ...(city.trim() && { city: city.trim() }),
        ...(taxIdNumber.trim() && { taxIdNumber: taxIdNumber.trim() }),
        ...(website.trim() && { website: website.trim() }),
        ...(ownerIdNumber.trim() && { ownerIdNumber: ownerIdNumber.trim() }),
      });
      navigate('kyb_docs');
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message ?? 'Failed to save KYB details.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled">
        <InternalHeader title="Business Verification" onBack={goBack} Colors={Colors} styles={styles} />

        <Text style={[styles.sectionNote, { color: Colors.textSecondary }]}>
          We need to verify your business before you can accept payments.
        </Text>

        <PickerRow label="Business Type *" options={BUSINESS_TYPES} optionLabels={BUSINESS_TYPE_LABELS} value={businessType} onChange={setBusinessType} Colors={Colors} styles={styles} />
        <FieldInput label="Registration Number" value={registrationNumber} onChangeText={setRegistrationNumber} placeholder="BN-XXXXXXXX" Colors={Colors} styles={styles} />
        <FieldInput label="Tax ID Number" value={taxIdNumber} onChangeText={setTaxIdNumber} placeholder="TIN-XXXXXXXXX" Colors={Colors} styles={styles} />
        <FieldInput label="Registered Address" value={registeredAddress} onChangeText={setRegisteredAddress} placeholder="123 Main Street" Colors={Colors} styles={styles} />
        <FieldInput label="City" value={city} onChangeText={setCity} placeholder="Accra" Colors={Colors} styles={styles} />
        <FieldInput label="Website" value={website} onChangeText={setWebsite} placeholder="https://yourbusiness.com" keyboardType="url" Colors={Colors} styles={styles} />

        <Text style={[styles.sectionDivider, { color: Colors.textSecondary, borderColor: Colors.border }]}>Owner / Director</Text>
        <FieldInput label="Full Name *" value={ownerFullName} onChangeText={setOwnerFullName} placeholder="John Doe" Colors={Colors} styles={styles} />
        <PickerRow label="ID Type" options={ID_TYPES} optionLabels={ID_TYPE_LABELS} value={ownerIdType} onChange={setOwnerIdType} Colors={Colors} styles={styles} />
        <FieldInput label="ID Number" value={ownerIdNumber} onChangeText={setOwnerIdNumber} placeholder="GHA-XXXXXXXXX-X" Colors={Colors} styles={styles} />

        <PrimaryButton label="Save & Continue" onPress={submit} disabled={!canSubmit} loading={loading} Colors={Colors} styles={styles} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Page: KYB Documents ───────────────────────────────────────────────────────

function KybDocsPage({ navigate, goBack, Colors, styles }: NavProps) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const DOC_TYPES = [
    { type: 'CERTIFICATE_OF_INCORPORATION', label: 'Certificate of Incorporation', required: false },
    { type: 'BUSINESS_REGISTRATION', label: 'Business Registration', required: true },
    { type: 'TAX_CERTIFICATE', label: 'Tax Certificate', required: false },
    { type: 'OWNER_ID_FRONT', label: 'Owner ID (Front)', required: true },
    { type: 'OWNER_ID_BACK', label: 'Owner ID (Back)', required: false },
    { type: 'BANK_STATEMENT', label: 'Bank Statement', required: false },
  ];

  const requiredUploaded = DOC_TYPES.filter(d => d.required).every(d => uploaded.has(d.type));

  const handleUpload = (type: string) => {
    Alert.alert('Upload Document', `Upload your ${DOC_TYPES.find(d => d.type === type)?.label}.\n\nThis feature requires camera/gallery access.`, [
      { text: 'Simulate Upload', onPress: () => setUploaded(prev => new Set([...prev, type])) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const finalSubmit = async () => {
    setSubmitting(true);
    try {
      await submitKybFinal();
      navigate('under_review');
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message ?? 'Submission failed.';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.pageContent}>
      <InternalHeader title="Upload Documents" onBack={goBack} Colors={Colors} styles={styles} />
      <Text style={[styles.sectionNote, { color: Colors.textSecondary }]}>
        Upload clear, legible scans or photos. Accepted formats: PDF, JPG, PNG.
      </Text>

      {DOC_TYPES.map(({ type, label, required }) => {
        const done = uploaded.has(type);
        return (
          <TouchableOpacity
            key={type}
            style={[styles.docRow, { borderColor: done ? Colors.success : Colors.border, backgroundColor: Colors.surface }]}
            onPress={() => handleUpload(type)}
            accessibilityRole="button"
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.docLabel, { color: Colors.textPrimary }]}>
                {label}{required && <Text style={{ color: Colors.error }}> *</Text>}
              </Text>
              <Text style={[styles.docStatus, { color: done ? Colors.success : Colors.textSecondary }]}>
                {done ? 'Uploaded' : 'Tap to upload'}
              </Text>
            </View>
            <Feather
              name={done ? 'check-circle' : 'upload'}
              size={20}
              color={done ? Colors.success : Colors.textSecondary}
            />
          </TouchableOpacity>
        );
      })}

      <PrimaryButton
        label={submitting ? 'Submitting…' : 'Submit Application'}
        onPress={finalSubmit}
        disabled={!requiredUploaded}
        loading={submitting}
        Colors={Colors}
        styles={styles}
      />
      <Text style={[styles.hint, { color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.sm }]}>
        Required documents marked with *
      </Text>
    </ScrollView>
  );
}

// ── Page: Under Review ────────────────────────────────────────────────────────

function UnderReviewPage({ merchant, Colors, styles }: NavProps) {
  const isMoreInfo = merchant?.status === 'MORE_INFO_REQUIRED';
  return (
    <ScrollView contentContainerStyle={[styles.pageContent, { alignItems: 'center' }]}>
      <View style={[styles.bigIcon, { backgroundColor: (isMoreInfo ? '#FF5722' : '#2196F3') + '18' }]}>
        <Text style={{ fontSize: 56 }}>{isMoreInfo ? '📋' : '⏳'}</Text>
      </View>
      <Text style={[styles.introTitle, { color: Colors.textPrimary }]}>
        {isMoreInfo ? 'More Information Needed' : 'Application Submitted'}
      </Text>
      <Text style={[styles.introSubtitle, { color: Colors.textSecondary }]}>
        {isMoreInfo
          ? 'Our team needs additional information before approving your account.'
          : 'Your application is being reviewed. We typically respond within 1–2 business days.'}
      </Text>
      {isMoreInfo && merchant?.moreInfoRequest && (
        <View style={[styles.infoBox, { backgroundColor: '#FF572218', borderColor: '#FF5722' }]}>
          <Text style={[Typography.body as any, { color: Colors.textPrimary }]}>{merchant.moreInfoRequest}</Text>
        </View>
      )}
      <StatusBadge status={merchant?.status ?? 'KYB_SUBMITTED'} Colors={Colors} />
    </ScrollView>
  );
}

// ── Page: Dashboard ───────────────────────────────────────────────────────────

function DashboardPage({ merchant, navigate, Colors, styles }: NavProps) {
  const feePercent = ((merchant?.feeRateBps ?? 150) / 100).toFixed(2);

  return (
    <ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
      {/* Balance card */}
      <View style={[styles.balanceCard, { backgroundColor: Colors.primary }]}>
        <Text style={[styles.balanceLabel, { color: Colors.secondary + 'BB' }]}>Merchant Balance</Text>
        <Text style={[styles.balanceAmount, { color: Colors.secondary }]}>
          {fmtAmount(merchant?.balance, merchant?.currency ?? 'GHS')}
        </Text>
        <View style={styles.balanceRow}>
          <View>
            <Text style={[styles.balanceSub, { color: Colors.secondary + 'BB' }]}>Total Volume</Text>
            <Text style={[styles.balanceSubVal, { color: Colors.secondary }]}>
              {fmtAmount(merchant?.totalVolume, merchant?.currency ?? 'GHS')}
            </Text>
          </View>
          <View>
            <Text style={[styles.balanceSub, { color: Colors.secondary + 'BB' }]}>Platform Fee</Text>
            <Text style={[styles.balanceSubVal, { color: Colors.secondary }]}>{feePercent}%</Text>
          </View>
        </View>
      </View>

      {/* Quick actions */}
      <Text style={[styles.sectionLabel, { color: Colors.textPrimary }]}>Quick Actions</Text>
      <View style={styles.actionGrid}>
        {[
          { icon: 'link', label: 'Payment Link', page: 'create_session' as Page },
          { icon: 'list', label: 'Transactions', page: 'sessions' as Page },
          { icon: 'download', label: 'Payouts', page: 'payouts' as Page },
        ].map(({ icon, label, page }) => (
          <TouchableOpacity
            key={page}
            style={[styles.actionCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
            onPress={() => navigate(page)}
            accessibilityRole="button"
          >
            <Feather name={icon as any} size={24} color={Colors.primary} />
            <Text style={[styles.actionLabel, { color: Colors.textPrimary }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Developer */}
      <Text style={[styles.sectionLabel, { color: Colors.textPrimary }]}>Developer</Text>
      <View style={styles.actionGrid}>
        {[
          { icon: 'key', label: 'API Keys', page: 'api_keys' as Page },
          { icon: 'zap', label: 'Webhooks', page: 'webhooks' as Page },
        ].map(({ icon, label, page }) => (
          <TouchableOpacity
            key={page}
            style={[styles.actionCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
            onPress={() => navigate(page)}
            accessibilityRole="button"
          >
            <Feather name={icon as any} size={24} color={Colors.primary} />
            <Text style={[styles.actionLabel, { color: Colors.textPrimary }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Business info */}
      <View style={[styles.infoCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
        <Text style={[styles.infoCardTitle, { color: Colors.textPrimary }]}>{merchant?.businessName}</Text>
        <Text style={[styles.infoCardHandle, { color: Colors.textSecondary }]}>@{merchant?.businessHandle}</Text>
        {merchant?.category && (
          <Text style={[styles.infoCardHandle, { color: Colors.textSecondary }]}>
            {CATEGORY_LABELS[merchant.category] ?? merchant.category}
          </Text>
        )}
        <View style={{ marginTop: Spacing.sm }}>
          <StatusBadge status={merchant?.status ?? 'ACTIVE'} Colors={Colors} />
        </View>
      </View>
    </ScrollView>
  );
}

// ── Page: Sessions ────────────────────────────────────────────────────────────

function SessionsPage({ navigate, goBack, Colors, styles }: NavProps) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMerchantSessions(0, 30)
      .then(r => setSessions(extractData(r)?.content ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <InternalHeader title="Transactions" onBack={goBack} Colors={Colors} styles={styles} />
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : sessions.length === 0 ? (
        <View style={styles.center}>
          <Feather name="inbox" size={36} color={Colors.textSecondary} />
          <Text style={[Typography.body as any, { color: Colors.textSecondary, marginTop: Spacing.sm }]}>No transactions yet</Text>
          <TouchableOpacity style={{ marginTop: Spacing.md }} onPress={() => navigate('create_session')}>
            <Text style={{ color: Colors.primary, fontWeight: '600' }}>Create Payment Link</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: Spacing.md }}>
          {sessions.map((s) => (
            <View key={s.id} style={[styles.sessionRow, { borderColor: Colors.border, backgroundColor: Colors.surface }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sessionAmount, { color: Colors.textPrimary }]}>
                  {fmtAmount(s.amount, s.currency)}
                </Text>
                <Text style={[styles.sessionDesc, { color: Colors.textSecondary }]} numberOfLines={1}>
                  {s.description ?? 'Payment'}
                </Text>
                <Text style={[styles.sessionDate, { color: Colors.textSecondary }]}>{fmtDate(s.createdAt)}</Text>
              </View>
              <StatusBadge status={s.status} Colors={Colors} />
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ── Page: Create Session ──────────────────────────────────────────────────────

function CreateSessionPage({ goBack, Colors, styles }: NavProps) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [successUrl, setSuccessUrl] = useState('');
  const [cancelUrl, setCancelUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ id: string; link: string } | null>(null);

  const canSubmit = parseFloat(amount) > 0;

  const submit = async () => {
    setLoading(true);
    try {
      const res = await createMerchantSession({
        amount: parseFloat(amount),
        ...(description.trim() && { description: description.trim() }),
        ...(successUrl.trim() && { successUrl: successUrl.trim() }),
        ...(cancelUrl.trim() && { cancelUrl: cancelUrl.trim() }),
      });
      const session = extractData(res);
      if (session?.id) {
        setResult({ id: session.id, link: `https://pay.aza.app/c/${session.id}` });
      }
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message ?? 'Failed to create payment link.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <ScrollView contentContainerStyle={[styles.pageContent, { alignItems: 'center' }]}>
        <InternalHeader title="Payment Link" onBack={goBack} Colors={Colors} styles={styles} />
        <View style={[styles.bigIcon, { backgroundColor: Colors.success + '18' }]}>
          <Feather name="check-circle" size={48} color={Colors.success} />
        </View>
        <Text style={[styles.introTitle, { color: Colors.textPrimary }]}>Link Created!</Text>
        <Text style={[styles.introSubtitle, { color: Colors.textSecondary }]}>
          Share this link with your customer to collect payment.
        </Text>
        <View style={[styles.linkBox, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
          <Text style={[styles.linkText, { color: Colors.primary }]} selectable numberOfLines={2}>
            {result.link}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.primaryBtn, { width: '100%', marginTop: Spacing.md }]}
          onPress={() => {
            Clipboard.setString(result.link);
            Alert.alert('Copied', 'Payment link copied to clipboard.');
          }}
        >
          <Feather name="copy" size={18} color={Colors.secondary} />
          <Text style={[styles.primaryBtnText, { color: Colors.secondary, marginLeft: Spacing.sm }]}>Copy Link</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ marginTop: Spacing.md }} onPress={() => setResult(null)}>
          <Text style={{ color: Colors.primary, fontWeight: '600' }}>Create Another</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled">
        <InternalHeader title="Create Payment Link" onBack={goBack} Colors={Colors} styles={styles} />

        <FieldInput label="Amount (GHS) *" value={amount} onChangeText={setAmount} placeholder="0.00" keyboardType="decimal-pad" Colors={Colors} styles={styles} />
        <FieldInput label="Description" value={description} onChangeText={setDescription} placeholder="What is this payment for?" Colors={Colors} styles={styles} />
        <FieldInput label="Success URL" value={successUrl} onChangeText={setSuccessUrl} placeholder="https://yoursite.com/thanks" keyboardType="url" Colors={Colors} styles={styles} />
        <FieldInput label="Cancel URL" value={cancelUrl} onChangeText={setCancelUrl} placeholder="https://yoursite.com/cancel" keyboardType="url" Colors={Colors} styles={styles} />

        <PrimaryButton label="Generate Link" onPress={submit} disabled={!canSubmit} loading={loading} Colors={Colors} styles={styles} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Page: API Keys ────────────────────────────────────────────────────────────

function ApiKeysPage({ goBack, Colors, styles }: NavProps) {
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getMerchantApiKeys()
      .then(r => setKeys(extractData(r) ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await createMerchantApiKey(newKeyName.trim() || undefined);
      const newKey = extractData(res);
      if (newKey?.rawKey) setRevealedKey(newKey.rawKey);
      setNewKeyName('');
      setShowForm(false);
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error?.message ?? 'Failed to create key.');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = (keyId: string, prefix: string) => {
    Alert.alert('Revoke Key', `Revoke key ${prefix}? This cannot be undone.`, [
      { text: 'Revoke', style: 'destructive', onPress: async () => {
        try {
          await revokeMerchantApiKey(keyId);
          load();
        } catch {
          Alert.alert('Error', 'Failed to revoke key.');
        }
      }},
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View style={{ flex: 1 }}>
      <InternalHeader title="API Keys" onBack={goBack} Colors={Colors} styles={styles} />
      {revealedKey && (
        <View style={[styles.revealBox, { backgroundColor: Colors.success + '18', borderColor: Colors.success }]}>
          <Text style={[styles.revealTitle, { color: Colors.success }]}>Copy your key — shown once only</Text>
          <Text style={[styles.revealKey, { color: Colors.textPrimary }]} selectable numberOfLines={2}>{revealedKey}</Text>
          <TouchableOpacity onPress={() => { Clipboard.setString(revealedKey); Alert.alert('Copied!'); }}>
            <Text style={{ color: Colors.success, fontWeight: '600', marginTop: 4 }}>Copy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ marginTop: 8 }} onPress={() => setRevealedKey(null)}>
            <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: Spacing.md }}>
          {keys.map((k) => (
            <View key={k.id} style={[styles.keyRow, { borderColor: Colors.border, backgroundColor: Colors.surface }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.keyName, { color: Colors.textPrimary }]}>{k.name ?? 'Unnamed Key'}</Text>
                <Text style={[styles.keyPrefix, { color: Colors.textSecondary }]}>{k.keyPrefix}</Text>
                <Text style={[styles.keyDate, { color: Colors.textSecondary }]}>Created {fmtDate(k.createdAt)}</Text>
              </View>
              <TouchableOpacity onPress={() => handleRevoke(k.id, k.keyPrefix)} accessibilityRole="button">
                <Feather name="trash-2" size={18} color={Colors.error} />
              </TouchableOpacity>
            </View>
          ))}

          {showForm ? (
            <View style={[styles.formCard, { borderColor: Colors.border, backgroundColor: Colors.surface }]}>
              <TextInput
                style={[styles.fieldInput, { color: Colors.textPrimary, borderColor: Colors.border, backgroundColor: Colors.background }]}
                placeholder="Key name (optional)"
                placeholderTextColor={Colors.textSecondary}
                value={newKeyName}
                onChangeText={setNewKeyName}
                autoFocus
              />
              <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm }}>
                <TouchableOpacity style={[styles.primaryBtn, { flex: 1 }]} onPress={handleCreate} disabled={creating}>
                  {creating ? <ActivityIndicator color={Colors.secondary} /> : <Text style={[styles.primaryBtnText, { color: Colors.secondary }]}>Create</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={[styles.secondaryBtn, { flex: 1, borderColor: Colors.border }]} onPress={() => setShowForm(false)}>
                  <Text style={[styles.secondaryBtnText, { color: Colors.textPrimary }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            keys.length < 10 && (
              <TouchableOpacity
                style={[styles.addBtn, { borderColor: Colors.primary }]}
                onPress={() => setShowForm(true)}
                accessibilityRole="button"
              >
                <Feather name="plus" size={18} color={Colors.primary} />
                <Text style={[styles.addBtnText, { color: Colors.primary }]}>Create API Key</Text>
              </TouchableOpacity>
            )
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ── Page: Webhooks ────────────────────────────────────────────────────────────

function WebhooksPage({ goBack, Colors, styles }: NavProps) {
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState('checkout.completed');
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getMerchantWebhooks()
      .then(r => setWebhooks(extractData(r) ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!url.startsWith('https://')) {
      Alert.alert('Invalid URL', 'Webhook URL must start with https://');
      return;
    }
    setCreating(true);
    try {
      await createMerchantWebhook(url.trim(), events.trim() || 'checkout.completed');
      setUrl('');
      setEvents('checkout.completed');
      setShowForm(false);
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error?.message ?? 'Failed to create webhook.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = (id: string, endpointUrl: string) => {
    Alert.alert('Delete Webhook', `Remove endpoint ${endpointUrl}?`, [
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteMerchantWebhook(id); load(); }
        catch { Alert.alert('Error', 'Failed to delete webhook.'); }
      }},
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View style={{ flex: 1 }}>
      <InternalHeader title="Webhooks" onBack={goBack} Colors={Colors} styles={styles} />
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: Spacing.md }}>
          {webhooks.map((w) => (
            <View key={w.id} style={[styles.keyRow, { borderColor: Colors.border, backgroundColor: Colors.surface }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.keyName, { color: Colors.textPrimary }]} numberOfLines={1}>{w.url}</Text>
                <Text style={[styles.keyDate, { color: Colors.textSecondary }]}>{w.events}</Text>
              </View>
              <TouchableOpacity onPress={() => handleDelete(w.id, w.url)} accessibilityRole="button">
                <Feather name="trash-2" size={18} color={Colors.error} />
              </TouchableOpacity>
            </View>
          ))}

          {showForm ? (
            <View style={[styles.formCard, { borderColor: Colors.border, backgroundColor: Colors.surface }]}>
              <FieldInput label="Endpoint URL (https://)" value={url} onChangeText={setUrl} placeholder="https://yoursite.com/webhook" keyboardType="url" Colors={Colors} styles={styles} />
              <FieldInput label="Events (comma-separated)" value={events} onChangeText={setEvents} placeholder="checkout.completed,*" Colors={Colors} styles={styles} />
              <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                <TouchableOpacity style={[styles.primaryBtn, { flex: 1 }]} onPress={handleCreate} disabled={creating}>
                  {creating ? <ActivityIndicator color={Colors.secondary} /> : <Text style={[styles.primaryBtnText, { color: Colors.secondary }]}>Add</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={[styles.secondaryBtn, { flex: 1, borderColor: Colors.border }]} onPress={() => setShowForm(false)}>
                  <Text style={[styles.secondaryBtnText, { color: Colors.textPrimary }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            webhooks.length < 5 && (
              <TouchableOpacity style={[styles.addBtn, { borderColor: Colors.primary }]} onPress={() => setShowForm(true)}>
                <Feather name="plus" size={18} color={Colors.primary} />
                <Text style={[styles.addBtnText, { color: Colors.primary }]}>Add Endpoint</Text>
              </TouchableOpacity>
            )
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ── Page: Payouts ─────────────────────────────────────────────────────────────

function PayoutsPage({ merchant, goBack, onMerchantUpdate, Colors, styles }: NavProps) {
  const [amount, setAmount] = useState('');
  const [passcode, setPasscode] = useState('');
  const [loading, setLoading] = useState(false);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [payoutsLoading, setPayoutsLoading] = useState(true);

  useEffect(() => {
    getMerchantPayouts(0, 20)
      .then(r => setPayouts(extractData(r)?.content ?? []))
      .catch(() => {})
      .finally(() => setPayoutsLoading(false));
  }, []);

  const canSubmit = parseFloat(amount) > 0 && passcode.length === 6;

  const submit = async () => {
    const amt = parseFloat(amount);
    if (amt > (merchant?.balance ?? 0)) {
      Alert.alert('Insufficient Balance', 'Payout amount exceeds your merchant balance.');
      return;
    }
    setLoading(true);
    try {
      await requestMerchantPayout(amt, passcode);
      Alert.alert('Success', `GH₵${amt.toFixed(2)} has been transferred to your Aza wallet.`);
      setAmount('');
      setPasscode('');
      if (merchant) onMerchantUpdate({ ...merchant, balance: (merchant.balance ?? 0) - amt });
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error?.message ?? 'Payout failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled">
        <InternalHeader title="Payouts" onBack={goBack} Colors={Colors} styles={styles} />

        <View style={[styles.balanceCard, { backgroundColor: Colors.primary, marginBottom: Spacing.lg }]}>
          <Text style={[styles.balanceLabel, { color: Colors.secondary + 'BB' }]}>Available Balance</Text>
          <Text style={[styles.balanceAmount, { color: Colors.secondary }]}>
            {fmtAmount(merchant?.balance, merchant?.currency ?? 'GHS')}
          </Text>
        </View>

        <Text style={[styles.sectionLabel, { color: Colors.textPrimary }]}>Withdraw to Aza Wallet</Text>
        <FieldInput label="Amount (GHS) *" value={amount} onChangeText={setAmount} placeholder="0.00" keyboardType="decimal-pad" Colors={Colors} styles={styles} />
        <FieldInput label="Passcode *" value={passcode} onChangeText={setPasscode} placeholder="Enter 6-digit passcode" keyboardType="number-pad" secureTextEntry Colors={Colors} styles={styles} />
        <PrimaryButton label="Request Payout" onPress={submit} disabled={!canSubmit} loading={loading} Colors={Colors} styles={styles} />

        {!payoutsLoading && payouts.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: Colors.textPrimary, marginTop: Spacing.xl }]}>Payout History</Text>
            {payouts.map((p, i) => (
              <View key={p.id ?? i} style={[styles.sessionRow, { borderColor: Colors.border, backgroundColor: Colors.surface }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sessionAmount, { color: Colors.textPrimary }]}>{fmtAmount(p.amount, p.currency)}</Text>
                  <Text style={[styles.sessionDate, { color: Colors.textSecondary }]}>{fmtDate(p.createdAt)}</Text>
                </View>
                <StatusBadge status={p.status ?? 'COMPLETED'} Colors={Colors} />
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Root Component ────────────────────────────────────────────────────────────

export default function MyBusinessApp({ onClose }: MiniAppProps) {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);

  const [pageStack, setPageStack] = useState<Page[]>(['loading']);
  const [merchant, setMerchant] = useState<MerchantData | null>(null);

  const navigate = useCallback((page: Page) => {
    setPageStack(prev => [...prev, page]);
  }, []);

  const goBack = useCallback(() => {
    setPageStack(prev => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  const handleMerchantUpdate = useCallback((m: MerchantData) => {
    setMerchant(m);
  }, []);

  useEffect(() => {
    getMerchant()
      .then(res => {
        const m = extractData(res);
        setMerchant(m);
        if (!m) { setPageStack(['intro']); return; }
        switch (m.status) {
          case 'ACTIVE': setPageStack(['dashboard']); break;
          case 'PENDING_KYB': setPageStack(['kyb_form']); break;
          case 'KYB_SUBMITTED':
          case 'KYB_UNDER_REVIEW':
          case 'MORE_INFO_REQUIRED': setPageStack(['under_review']); break;
          case 'SUSPENDED': setPageStack(['suspended']); break;
          case 'REJECTED': setPageStack(['rejected']); break;
          default: setPageStack(['under_review']);
        }
      })
      .catch(err => {
        if (err?.response?.status === 404) {
          setPageStack(['intro']);
        } else {
          setPageStack(['intro']);
        }
      });
  }, []);

  const currentPage = pageStack[pageStack.length - 1];

  const navProps: NavProps = {
    navigate, goBack, merchant, onMerchantUpdate: handleMerchantUpdate, Colors, styles,
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'loading':
        return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;
      case 'intro':
        return <IntroPage {...navProps} />;
      case 'register':
        return <RegisterPage {...navProps} />;
      case 'kyb_form':
        return <KybFormPage {...navProps} />;
      case 'kyb_docs':
        return <KybDocsPage {...navProps} />;
      case 'under_review':
        return <UnderReviewPage {...navProps} />;
      case 'suspended':
        return (
          <View style={[styles.center, { padding: Spacing.lg }]}>
            <Text style={{ fontSize: 48 }}>⛔</Text>
            <Text style={[styles.introTitle, { color: Colors.textPrimary, marginTop: Spacing.md }]}>Account Suspended</Text>
            <Text style={[styles.introSubtitle, { color: Colors.textSecondary }]}>
              Your merchant account has been suspended. Please contact support.
            </Text>
          </View>
        );
      case 'rejected':
        return (
          <View style={[styles.center, { padding: Spacing.lg }]}>
            <Text style={{ fontSize: 48 }}>❌</Text>
            <Text style={[styles.introTitle, { color: Colors.textPrimary, marginTop: Spacing.md }]}>Application Rejected</Text>
            <Text style={[styles.introSubtitle, { color: Colors.textSecondary }]}>
              {merchant?.rejectionReason ?? 'Your KYB application was not approved. Please contact support for details.'}
            </Text>
          </View>
        );
      case 'dashboard':
        return <DashboardPage {...navProps} />;
      case 'sessions':
        return <SessionsPage {...navProps} />;
      case 'create_session':
        return <CreateSessionPage {...navProps} />;
      case 'api_keys':
        return <ApiKeysPage {...navProps} />;
      case 'webhooks':
        return <WebhooksPage {...navProps} />;
      case 'payouts':
        return <PayoutsPage {...navProps} />;
      default:
        return null;
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: Colors.background }]}>
      {renderPage()}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function createStyles(Colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
    pageContent: { padding: Spacing.lg, paddingBottom: Spacing.xl * 2 },

    // Internal header
    internalHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: Spacing.lg,
    },
    backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    internalHeaderTitle: { ...Typography.body, fontWeight: '700', flex: 1, textAlign: 'center' },

    // Intro
    bigIcon: { width: 100, height: 100, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
    introTitle: { fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: Spacing.sm },
    introSubtitle: { ...Typography.body as any, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.lg },
    featureList: {
      width: '100%', borderRadius: Radius.lg, borderWidth: 1,
      padding: Spacing.md, gap: Spacing.md, marginBottom: Spacing.lg,
    },
    featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
    featureTitle: { ...Typography.body as any, fontWeight: '600', marginBottom: 2 },
    featureDesc: { ...Typography.caption as any },

    // Form
    fieldLabel: { ...Typography.caption as any, fontWeight: '600', marginBottom: 6 },
    fieldInput: {
      borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md,
      paddingVertical: 12, ...Typography.body as any,
    },
    hint: { ...Typography.caption as any, marginTop: -Spacing.sm, marginBottom: Spacing.md },
    sectionNote: { ...Typography.body as any, marginBottom: Spacing.lg },
    sectionDivider: {
      ...Typography.caption as any, fontWeight: '700', marginVertical: Spacing.md,
      paddingBottom: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth,
    },

    // Chips (picker)
    chip: { paddingHorizontal: Spacing.md, paddingVertical: 7, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
    chipText: { ...Typography.caption as any, fontWeight: '600' },

    // Buttons
    primaryBtn: {
      backgroundColor: Colors.primary, borderRadius: Radius.full,
      paddingVertical: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
    },
    primaryBtnText: { ...Typography.button as any, fontWeight: '700' },
    secondaryBtn: {
      borderWidth: 1, borderRadius: Radius.full,
      paddingVertical: 15, alignItems: 'center',
    },
    secondaryBtnText: { ...Typography.button as any, fontWeight: '600' },
    addBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: Spacing.sm, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: Radius.md,
      paddingVertical: Spacing.md, marginTop: Spacing.md,
    },
    addBtnText: { ...Typography.body as any, fontWeight: '600' },

    // Documents
    docRow: {
      flexDirection: 'row', alignItems: 'center', borderWidth: 1,
      borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm,
    },
    docLabel: { ...Typography.body as any, fontWeight: '600', marginBottom: 2 },
    docStatus: { ...Typography.caption as any },

    // Balance card
    balanceCard: {
      borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.md,
    },
    balanceLabel: { ...Typography.caption as any, fontWeight: '600', marginBottom: 4 },
    balanceAmount: { fontSize: 28, fontWeight: '700', marginBottom: Spacing.md },
    balanceRow: { flexDirection: 'row', justifyContent: 'space-between' },
    balanceSub: { ...Typography.caption as any, marginBottom: 2 },
    balanceSubVal: { ...Typography.body as any, fontWeight: '700' },

    // Dashboard grid
    sectionLabel: { ...Typography.body as any, fontWeight: '700', marginBottom: Spacing.md, marginTop: Spacing.sm },
    actionGrid: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
    actionCard: {
      flex: 1, borderWidth: 1, borderRadius: Radius.lg,
      padding: Spacing.md, alignItems: 'center', gap: Spacing.sm,
    },
    actionLabel: { ...Typography.caption as any, fontWeight: '600', textAlign: 'center' },
    infoCard: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md },
    infoCardTitle: { ...Typography.h3 as any, marginBottom: 2 },
    infoCardHandle: { ...Typography.body as any },

    // Sessions
    sessionRow: {
      flexDirection: 'row', alignItems: 'center', borderWidth: 1,
      borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm,
    },
    sessionAmount: { ...Typography.body as any, fontWeight: '700' },
    sessionDesc: { ...Typography.caption as any, marginTop: 2 },
    sessionDate: { ...Typography.caption as any, marginTop: 2 },

    // Payment link result
    linkBox: { width: '100%', borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, marginTop: Spacing.sm },
    linkText: { ...Typography.body as any, fontWeight: '600' },

    // API Keys
    keyRow: {
      flexDirection: 'row', alignItems: 'center', borderWidth: 1,
      borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm,
    },
    keyName: { ...Typography.body as any, fontWeight: '600' },
    keyPrefix: { ...Typography.caption as any, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginTop: 2 },
    keyDate: { ...Typography.caption as any, marginTop: 2 },
    formCard: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, marginTop: Spacing.md },
    revealBox: {
      margin: Spacing.md, borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md,
    },
    revealTitle: { ...Typography.caption as any, fontWeight: '700', marginBottom: Spacing.sm },
    revealKey: { ...Typography.body as any, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },

    // Info box
    infoBox: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, marginVertical: Spacing.md, width: '100%' },
  });
}
