import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, StatusBar, ScrollView,
  TouchableOpacity, ActivityIndicator, Image,
  TextInput, TextInputKeyPressEvent, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@react-native-vector-icons/feather';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as SecureStore from 'expo-secure-store';
import { useAppTheme, ThemeColors, Spacing, Radius } from '../../../theme';
import Button from '../../../components/ui/Button';
import { BackButton } from '../../../components/ui/BackButton';
import { RootStackParamList } from '../../../navigation/types';
import {
  getAvailableRecoveryContacts,
  requestContactRecovery,
  redeemContactRecoveryCode,
  TOKEN_KEY,
  REFRESH_TOKEN_KEY,
} from '../../../services/api';
import { useAuth } from '../../../providers/AuthProvider';
import { useToast } from '../../../providers/ToastProvider';
import { extractErrorMessage, getErrorStatus } from '../../../utils/errorUtils';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'ContactRecoveryLogin'>;
type RouteType = RouteProp<RootStackParamList, 'ContactRecoveryLogin'>;

type Contact = {
  id: string;
  contactName: string;
  contactHandle?: string;
  contactAvatarUrl?: string;
};

export default function ContactRecoveryLoginScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteType>();
  const { preAuthToken } = route.params;
  const { login } = useAuth();
  const { showToast } = useToast();

  const [step, setStep] = useState<'pick' | 'waiting' | 'enter-code'>('pick');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const inputRefs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    getAvailableRecoveryContacts(preAuthToken)
      .then(res => setContacts(res.data?.data ?? []))
      .catch((err) => {
        const status = getErrorStatus(err);
        if (status === 401 || status === 403) {
          showToast('Your session has expired. Please try logging in again.', 'error');
          navigation.goBack();
        } else {
          setContacts([]);
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const handleSelectContact = async (contact: Contact) => {
    setSelectedContact(contact);
    setIsSending(true);
    try {
      const res = await requestContactRecovery(preAuthToken, contact.id);
      const rid: string = res.data?.data ?? res.data;
      setRequestId(rid);
      setStep('waiting');
    } catch (err: unknown) {
      const status = getErrorStatus(err);
      if (status === 401 || status === 403) {
        showToast('Your session has expired. Please try logging in again.', 'error');
        navigation.goBack();
      } else {
        showToast(extractErrorMessage(err, 'Failed to send request'), 'error');
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleOtpChange = (text: string, index: number) => {
    const clean = text.replace(/[^0-9]/g, '');
    if (clean.length > 1) {
      const chars = clean.split('').slice(0, 6);
      const newOtp = [...otp];
      chars.forEach((c, i) => { if (index + i < 6) newOtp[index + i] = c; });
      setOtp(newOtp);
      inputRefs.current[Math.min(index + chars.length, 5)]?.focus();
      return;
    }
    if (!clean && text !== '') return;
    const newOtp = [...otp];
    newOtp[index] = clean;
    setOtp(newOtp);
    if (clean && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyPress = (e: TextInputKeyPressEvent, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
    }
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length < 6 || !requestId) return;
    setIsVerifying(true);
    try {
      const res = await redeemContactRecoveryCode(preAuthToken, requestId, code);
      const payload = res.data?.data ?? res.data;
      await SecureStore.setItemAsync(TOKEN_KEY, payload.accessToken);
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, payload.refreshToken);
      login({
        token: payload.accessToken,
        hasPasscode: payload.user?.passcodeSet ?? false,
        isKYCVerified: payload.user?.kycStatus === 'VERIFIED',
        forcePasswordReset: payload.user?.forcePasswordReset ?? false,
        requireSelfieVerification: payload.user?.requireSelfieVerification ?? false,
        isBiometricsEnabled: false,
      });
    } catch (err: unknown) {
      const status = getErrorStatus(err);
      if (status === 401 || status === 403) {
        showToast('Your session has expired. Please try logging in again.', 'error');
        navigation.goBack();
      } else {
        showToast(extractErrorMessage(err, 'Invalid or expired code'), 'error');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <BackButton onPress={() => {
            if (step !== 'pick') setStep('pick');
            else navigation.goBack();
          }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {step === 'pick' && (
            <>
              <View style={styles.iconWrap}>
                <Feather name="users" size={36} color={Colors.primary} />
              </View>
              <Text style={styles.title}>Contact a recovery person</Text>
              <Text style={styles.subtitle}>
                Choose someone to ask for a recovery code. They'll get a notification and can generate a code for you.
              </Text>

              {isLoading ? (
                <ActivityIndicator color={Colors.primary} style={{ marginVertical: 32 }} />
              ) : contacts.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Feather name="user-x" size={28} color={Colors.textSecondary} />
                  <Text style={styles.emptyText}>No recovery contacts set up</Text>
                  <Text style={styles.emptySubtext}>You haven't added any recovery contacts to your account.</Text>
                </View>
              ) : (
                contacts.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    style={styles.contactRow}
                    onPress={() => handleSelectContact(c)}
                    disabled={isSending}
                  >
                    {c.contactAvatarUrl
                      ? <Image source={{ uri: c.contactAvatarUrl }} style={styles.avatar} />
                      : <View style={[styles.avatar, styles.avatarPlaceholder]}>
                          <Feather name="user" size={20} color={Colors.textSecondary} />
                        </View>
                    }
                    <View style={{ flex: 1 }}>
                      <Text style={styles.contactName}>{c.contactName}</Text>
                      {c.contactHandle && (
                        <Text style={styles.contactHandle}>@{c.contactHandle}</Text>
                      )}
                    </View>
                    {isSending && selectedContact?.id === c.id
                      ? <ActivityIndicator size="small" color={Colors.primary} />
                      : <Feather name="chevron-right" size={18} color={Colors.textSecondary} />
                    }
                  </TouchableOpacity>
                ))
              )}
            </>
          )}

          {step === 'waiting' && selectedContact && (
            <>
              <View style={styles.iconWrap}>
                <Feather name="clock" size={36} color={Colors.primary} />
              </View>
              <Text style={styles.title}>Waiting for {selectedContact.contactName}</Text>
              <Text style={styles.subtitle}>
                A notification has been sent. Call or message {selectedContact.contactName} and ask them to open Aza and generate your recovery code.
              </Text>
              <View style={styles.infoCard}>
                <Feather name="info" size={16} color={Colors.textSecondary} />
                <Text style={styles.infoText}>
                  Once they generate it, tap below to enter the 8-digit code they give you.
                </Text>
              </View>
              <View style={styles.footer}>
                <Button
                  title="I have the code"
                  onPress={() => setStep('enter-code')}
                  backgroundColor={Colors.primary}
                  textColor={Colors.secondary}
                  borderRadius={Radius.full}
                  paddingVertical={16}
                />
                <Button
                  title="Try a different contact"
                  onPress={() => { setStep('pick'); setSelectedContact(null); setRequestId(null); }}
                  backgroundColor="transparent"
                  textColor={Colors.textSecondary}
                  borderRadius={Radius.full}
                  paddingVertical={14}
                />
              </View>
            </>
          )}

          {step === 'enter-code' && (
            <>
              <View style={styles.iconWrap}>
                <Feather name="key" size={36} color={Colors.primary} />
              </View>
              <Text style={styles.title}>Enter recovery code</Text>
              <Text style={styles.subtitle}>
                Enter the 6-digit code currently shown on {selectedContact?.contactName}'s Aza app.
              </Text>

              <View style={styles.otpWrapper}>
                {otp.map((digit, i) => (
                  <View key={i} style={styles.otpSlot}>
                    <TextInput
                      ref={r => { inputRefs.current[i] = r; }}
                      style={styles.otpInput}
                      value={digit}
                      onChangeText={t => handleOtpChange(t, i)}
                      onKeyPress={e => handleKeyPress(e, i)}
                      keyboardType="number-pad"
                      maxLength={i === 0 ? 6 : 1}
                      autoFocus={i === 0}
                      cursorColor={Colors.primary}
                    />
                    {!digit && <View style={styles.dash} pointerEvents="none" />}
                  </View>
                ))}
              </View>

              <View style={styles.footer}>
                <Button
                  title="Verify"
                  onPress={handleVerify}
                  loading={isVerifying}
                  disabled={otp.join('').length < 6 || !requestId || isVerifying}
                  backgroundColor={Colors.primary}
                  textColor={Colors.secondary}
                  borderRadius={Radius.full}
                  paddingVertical={16}
                />
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: Colors.background },
    header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.sm },
    scroll: { flexGrow: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: 40 },
    iconWrap: {
      width: 72, height: 72, borderRadius: 36,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(22,51,0,0.06)',
      justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.lg,
    },
    title: { fontSize: 26, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.sm },
    subtitle: { fontSize: 15, color: Colors.textSecondary, lineHeight: 22, marginBottom: Spacing.xl },
    emptyBox: {
      alignItems: 'center', gap: 8, paddingVertical: 32,
      backgroundColor: isDark ? Colors.surface : '#F9FAFB',
      borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
    },
    emptyText: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
    emptySubtext: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: 24 },
    contactRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border,
    },
    avatar: { width: 44, height: 44, borderRadius: 22 },
    avatarPlaceholder: {
      backgroundColor: isDark ? Colors.surface : '#E5E7EB',
      justifyContent: 'center', alignItems: 'center',
    },
    contactName: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
    contactHandle: { fontSize: 13, color: Colors.textSecondary },
    infoCard: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 10,
      backgroundColor: isDark ? Colors.surface : '#F9FAFB',
      padding: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
      marginBottom: Spacing.xl,
    },
    infoText: { flex: 1, fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
    otpWrapper: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly',
      backgroundColor: isDark ? Colors.surface : '#FFFFFF',
      borderWidth: 1, borderColor: Colors.border,
      borderRadius: 8, height: 56, paddingHorizontal: 4,
      marginBottom: Spacing.xl,
    },
    otpSlot: { width: 36, height: '100%', alignItems: 'center', justifyContent: 'center', position: 'relative' },
    otpInput: { fontSize: 22, color: Colors.textPrimary, fontWeight: '600', textAlign: 'center', width: '100%', height: '100%' },
    dash: { position: 'absolute', bottom: 12, width: 14, height: 2, backgroundColor: Colors.textSecondary, borderRadius: 1 },
    separator: { position: 'absolute', right: -2, width: 1, height: 20, backgroundColor: Colors.border },
    footer: { gap: Spacing.sm },
  });
}
