import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { Feather } from '@react-native-vector-icons/feather';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppTheme, Typography, Spacing, ThemeColors } from '../../../theme';
import type { RootStackParamList } from '../../../navigation/types';
import { BackButton } from '../../../components/ui/BackButton';
import Button from '../../../components/ui/Button';
import {
  getBillers,
  lookupBillAccount,
  payBill,
  Biller,
  BillPayment,
} from '../../../services/api';
import { extractErrorMessage } from '../../../utils/errorUtils';

type Props = NativeStackScreenProps<RootStackParamList, 'PayBill'>;

function newIdempotencyKey() {
  return `bill-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function PayBillScreen({ navigation, route }: Props) {
  const { billerSlug } = route.params;
  const { colors: Colors } = useAppTheme();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const [biller, setBiller] = useState<Biller | null>(null);
  const [account, setAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [passcode, setPasscode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // What the biller said the account belongs to. Null means we haven't asked or can't.
  const [accountName, setAccountName] = useState<string | null>(null);
  const [lookupState, setLookupState] = useState<'idle' | 'checking' | 'found' | 'not-found'>('idle');

  const idempotencyKey = useRef(newIdempotencyKey());

  useEffect(() => {
    getBillers()
      .then((res) => {
        const all: Biller[] = res.data?.data ?? res.data ?? [];
        setBiller(all.find((b) => b.slug === billerSlug) ?? null);
      })
      .catch((e) => setError(extractErrorMessage(e, 'Could not load this biller.')));
  }, [billerSlug]);

  // Resolve the name as they type. This is the only thing between a mistyped meter
  // number and paying a stranger's bill, so it runs before the amount is even entered.
  const runLookup = useCallback(async (value: string) => {
    if (!biller?.supportsNameLookup || value.trim().length < 6) {
      setLookupState('idle');
      setAccountName(null);
      return;
    }
    setLookupState('checking');
    try {
      const res = await lookupBillAccount(biller.slug, value.trim());
      const data = res.data?.data ?? res.data;
      if (data?.supported && data?.found && data?.name) {
        setAccountName(data.name);
        setLookupState('found');
        Haptics.selectionAsync().catch(() => {});
      } else if (data?.supported) {
        setAccountName(null);
        setLookupState('not-found');
      } else {
        setAccountName(null);
        setLookupState('idle');
      }
    } catch {
      // A lookup we couldn't do is not an error the payer needs to see — it just means
      // they pay without a name shown, which some billers never support anyway.
      setAccountName(null);
      setLookupState('idle');
    }
  }, [biller]);

  useEffect(() => {
    const value = account;
    const t = setTimeout(() => runLookup(value), 500);
    return () => clearTimeout(t);
  }, [account, runLookup]);

  const numericAmount = parseFloat(amount) || 0;
  const belowMin = !!biller && numericAmount > 0 && numericAmount < biller.minAmount;
  const aboveMax = !!biller && !!biller.maxAmount && numericAmount > biller.maxAmount;

  const canPay =
    !!biller &&
    account.trim().length > 0 &&
    numericAmount > 0 &&
    !belowMin &&
    !aboveMax &&
    lookupState !== 'not-found' &&
    passcode.length === 4 &&
    !busy;

  const submit = async () => {
    if (!canPay || !biller) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setBusy(true);
    setError(null);
    try {
      const res = await payBill({
        billerSlug: biller.slug,
        accountNumber: account.trim(),
        ...(accountName ? { accountName } : {}),
        amount: numericAmount,
        passcode,
        idempotencyKey: idempotencyKey.current,
      });
      const payment: BillPayment = res.data?.data ?? res.data;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      navigation.replace('BillReceipt', { id: payment.id });
    } catch (e) {
      setError(extractErrorMessage(e, 'Could not pay this bill.'));
      setPasscode('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      setBusy(false);
    }
  };

  if (!biller) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={Colors.primary} />}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={Colors.isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" />
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>{biller.name}</Text>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Account */}
          <Text style={styles.label}>{biller.accountLabel}</Text>
          <TextInput
            style={styles.textInput}
            value={account}
            onChangeText={setAccount}
            placeholder={biller.accountLabel}
            placeholderTextColor={Colors.textSecondary}
            keyboardType={biller.accountLabel.toLowerCase().includes('number') ? 'number-pad' : 'default'}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
          />

          {/* Who the account belongs to — the check that stops a typo paying a stranger */}
          {lookupState === 'checking' && (
            <View style={styles.lookupRow}>
              <ActivityIndicator size="small" color={Colors.textSecondary} />
              <Text style={styles.muted}>Checking…</Text>
            </View>
          )}
          {lookupState === 'found' && !!accountName && (
            <View style={styles.lookupRow}>
              <Feather name="check-circle" size={14} color={Colors.success} />
              <Text style={styles.accountName}>{accountName}</Text>
            </View>
          )}
          {lookupState === 'not-found' && (
            <View style={styles.lookupRow}>
              <Feather name="alert-circle" size={14} color={Colors.error} />
              <Text style={styles.error}>
                No account with that {biller.accountLabel.toLowerCase()}.
              </Text>
            </View>
          )}

          {/* Amount */}
          <Text style={styles.label}>Amount</Text>
          <View style={styles.amountRow}>
            <Text style={styles.currency}>GH₵</Text>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))}
              placeholder="0.00"
              placeholderTextColor={Colors.textSecondary}
              keyboardType="decimal-pad"
            />
          </View>
          {belowMin && (
            <Text style={styles.error}>
              {biller.name} takes at least GH₵ {biller.minAmount.toFixed(2)}.
            </Text>
          )}
          {aboveMax && !!biller.maxAmount && (
            <Text style={styles.error}>
              {biller.name} takes at most GH₵ {biller.maxAmount.toFixed(2)}.
            </Text>
          )}

          {/* Passcode */}
          <Text style={styles.label}>Your passcode</Text>
          <TextInput
            style={styles.passcodeInput}
            value={passcode}
            onChangeText={(t) => setPasscode(t.replace(/[^0-9]/g, '').slice(0, 4))}
            placeholder="••••"
            placeholderTextColor={Colors.textSecondary}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
          />

          {!!error && <Text style={styles.error}>{error}</Text>}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title={busy ? 'Paying…' : `Pay GH₵ ${numericAmount.toFixed(2)}`}
            onPress={submit}
            disabled={!canPay}
            loading={busy}
            backgroundColor={canPay ? Colors.primary : Colors.border}
            textColor={canPay ? Colors.secondary : Colors.textSecondary}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    flex: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    headerTitle: { ...Typography.h2, color: Colors.textPrimary },
    content: { padding: Spacing.md, paddingBottom: Spacing.xl },
    label: {
      ...Typography.caption,
      color: Colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      fontWeight: '700',
      marginBottom: Spacing.xs,
      marginTop: Spacing.md,
    },
    textInput: {
      backgroundColor: Colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: Colors.border,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm + 4,
      ...Typography.bodyLg,
      color: Colors.textPrimary,
    },
    lookupRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.xs },
    accountName: { ...Typography.body, fontWeight: '700', color: Colors.textPrimary },
    muted: { ...Typography.caption, color: Colors.textSecondary },
    amountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: Colors.border,
      paddingHorizontal: Spacing.md,
    },
    currency: { ...Typography.h3, color: Colors.textSecondary, marginRight: Spacing.sm },
    amountInput: { flex: 1, ...Typography.h1, color: Colors.textPrimary, paddingVertical: Spacing.sm },
    passcodeInput: {
      backgroundColor: Colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: Colors.border,
      paddingVertical: Spacing.sm + 4,
      ...Typography.h3,
      letterSpacing: 10,
      textAlign: 'center',
      color: Colors.textPrimary,
    },
    error: { ...Typography.caption, color: Colors.error, marginTop: Spacing.xs },
    footer: { padding: Spacing.md },
  });
