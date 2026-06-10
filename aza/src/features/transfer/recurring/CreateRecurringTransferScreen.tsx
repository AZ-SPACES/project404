import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  ActivityIndicator,
  Modal,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@react-native-vector-icons/feather';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { RootStackParamList } from '../../../navigation/types';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';
import { BackButton } from '../../../components/ui/BackButton';
import { queryKeys } from '../../../lib/queryKeys';
import { createRecurringTransfer } from '../../../services/api';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'CreateRecurringTransfer'>;
type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';

const FREQUENCIES: { key: Frequency; label: string; desc: string }[] = [
  { key: 'DAILY', label: 'Daily', desc: 'Repeats every day' },
  { key: 'WEEKLY', label: 'Weekly', desc: 'Repeats every week' },
  { key: 'MONTHLY', label: 'Monthly', desc: 'Repeats every month' },
];

function padTwo(n: number) {
  return String(n).padStart(2, '0');
}

function dateToString(d: Date): string {
  return `${d.getFullYear()}-${padTwo(d.getMonth() + 1)}-${padTwo(d.getDate())}`;
}

function stringToDate(s: string): Date | null {
  const parts = s.split('-');
  if (parts.length !== 3) return null;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return isNaN(d.getTime()) ? null : d;
}

export default function CreateRecurringTransferScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();
  const qc = useQueryClient();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('MONTHLY');
  const [dateStr, setDateStr] = useState(dateToString(new Date()));
  const [datePickerVisible, setDatePickerVisible] = useState(false);

  // Date picker state
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth() + 1);
  const [pickerDay, setPickerDay] = useState(new Date().getDate());

  // Validation errors
  const [errors, setErrors] = useState<{ recipient: string | undefined; amount: string | undefined; startDate: string | undefined }>({ recipient: undefined, amount: undefined, startDate: undefined });

  const mutation = useMutation({
    mutationFn: createRecurringTransfer,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.recurringTransfers() });
      navigation.goBack();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Could not create transfer. Please try again.';
      Alert.alert('Error', msg);
    },
  });

  const blankErrors = { recipient: undefined as string | undefined, amount: undefined as string | undefined, startDate: undefined as string | undefined };

  const validateStep1 = () => {
    const e = { ...blankErrors };
    if (!recipient.trim()) e.recipient = 'Recipient is required';
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) e.amount = 'Enter a valid amount';
    setErrors(e);
    return !e.recipient && !e.amount;
  };

  const validateStep3 = () => {
    const d = stringToDate(dateStr);
    if (!d) {
      setErrors({ ...blankErrors, startDate: 'Enter a valid date (YYYY-MM-DD)' });
      return false;
    }
    setErrors({ ...blankErrors });
    return true;
  };

  const handleNext = () => {
    if (step === 1) {
      if (validateStep1()) setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step === 1) navigation.goBack();
    else if (step === 2) setStep(1);
    else setStep(2);
  };

  const handleSubmit = () => {
    if (!validateStep3()) return;
    mutation.mutate({
      recipientIdentifier: recipient.trim(),
      amount: parseFloat(amount),
      ...(note.trim() ? { note: note.trim() } : {}),
      frequency,
      startDate: dateStr,
    });
  };

  const applyDatePicker = () => {
    const daysInMonth = new Date(pickerYear, pickerMonth, 0).getDate();
    const safeDay = Math.min(pickerDay, daysInMonth);
    setPickerDay(safeDay);
    setDateStr(`${pickerYear}-${padTwo(pickerMonth)}-${padTwo(safeDay)}`);
    setDatePickerVisible(false);
  };

  const openDatePicker = () => {
    const d = stringToDate(dateStr) ?? new Date();
    setPickerYear(d.getFullYear());
    setPickerMonth(d.getMonth() + 1);
    setPickerDay(d.getDate());
    setDatePickerVisible(true);
  };

  const daysInPickerMonth = new Date(pickerYear, pickerMonth, 0).getDate();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" />

      <View style={styles.header}>
        <BackButton onPress={handleBack} />
        <Text style={styles.headerTitle}>Schedule Transfer</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Step indicator */}
      <View style={styles.stepRow}>
        {([1, 2, 3] as const).map((s) => (
          <View
            key={s}
            style={[styles.stepDot, step === s && styles.stepDotActive, step > s && styles.stepDotDone]}
          />
        ))}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {step === 1 && (
            <>
              <Text style={styles.stepTitle}>Recipient & Amount</Text>

              <Text style={styles.label}>Recipient</Text>
              <TextInput
                underlineColorAndroid="transparent"
                style={[styles.input, errors.recipient ? styles.inputError : undefined]}
                placeholder="Email, phone or @handle"
                placeholderTextColor={Colors.textSecondary}
                value={recipient}
                onChangeText={(t) => { setRecipient(t); setErrors((e) => ({ ...e, recipient: undefined as string | undefined })); }}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              {errors.recipient && <Text style={styles.errorText}>{errors.recipient}</Text>}

              <Text style={styles.label}>Amount (GHS)</Text>
              <TextInput
                underlineColorAndroid="transparent"
                style={[styles.input, errors.amount ? styles.inputError : undefined]}
                placeholder="0.00"
                placeholderTextColor={Colors.textSecondary}
                value={amount}
                onChangeText={(t) => { setAmount(t); setErrors((e) => ({ ...e, amount: undefined as string | undefined })); }}
                keyboardType="decimal-pad"
              />
              {errors.amount && <Text style={styles.errorText}>{errors.amount}</Text>}

              <Text style={styles.label}>Note (optional)</Text>
              <TextInput
                underlineColorAndroid="transparent"
                style={styles.input}
                placeholder="What's this for?"
                placeholderTextColor={Colors.textSecondary}
                value={note}
                onChangeText={setNote}
              />
            </>
          )}

          {step === 2 && (
            <>
              <Text style={styles.stepTitle}>How often?</Text>
              {FREQUENCIES.map((f) => (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.freqTile, frequency === f.key && styles.freqTileActive]}
                  activeOpacity={0.8}
                  onPress={() => setFrequency(f.key)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.freqLabel, frequency === f.key && styles.freqLabelActive]}>{f.label}</Text>
                    <Text style={styles.freqDesc}>{f.desc}</Text>
                  </View>
                  {frequency === f.key && (
                    <Feather name="check-circle" size={20} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </>
          )}

          {step === 3 && (
            <>
              <Text style={styles.stepTitle}>Start Date</Text>

              <Text style={styles.label}>Start date</Text>
              <TouchableOpacity
                style={[styles.input, styles.dateInput, errors.startDate ? styles.inputError : undefined]}
                activeOpacity={0.8}
                onPress={openDatePicker}
              >
                <Text style={[styles.dateInputText, !dateStr && { color: Colors.textSecondary }]}>
                  {dateStr || 'YYYY-MM-DD'}
                </Text>
                <Feather name="calendar" size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
              {errors.startDate && <Text style={styles.errorText}>{errors.startDate}</Text>}

              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Summary</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryKey}>To</Text>
                  <Text style={styles.summaryValue}>{recipient}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryKey}>Amount</Text>
                  <Text style={styles.summaryValue}>GHS {parseFloat(amount || '0').toFixed(2)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryKey}>Frequency</Text>
                  <Text style={styles.summaryValue}>{frequency.charAt(0) + frequency.slice(1).toLowerCase()}</Text>
                </View>
                {note ? (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryKey}>Note</Text>
                    <Text style={styles.summaryValue}>{note}</Text>
                  </View>
                ) : null}
              </View>
            </>
          )}

          <View style={{ height: Spacing.xl }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom action */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: Colors.primary }]}
          activeOpacity={0.85}
          onPress={step === 3 ? handleSubmit : handleNext}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.actionButtonText}>
              {step === 3 ? 'Schedule Transfer' : 'Continue'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Date picker modal */}
      <Modal
        visible={datePickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDatePickerVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setDatePickerVisible(false)}>
          <Pressable style={styles.pickerSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.pickerTitle}>Select Date</Text>

            <View style={styles.pickerRow}>
              {/* Day */}
              <View style={styles.pickerCol}>
                <Text style={styles.pickerColLabel}>Day</Text>
                <TouchableOpacity onPress={() => setPickerDay((d) => Math.min(d + 1, daysInPickerMonth))} style={styles.pickerBtn}>
                  <Feather name="chevron-up" size={20} color={Colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.pickerValue}>{padTwo(pickerDay)}</Text>
                <TouchableOpacity onPress={() => setPickerDay((d) => Math.max(d - 1, 1))} style={styles.pickerBtn}>
                  <Feather name="chevron-down" size={20} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>
              {/* Month */}
              <View style={styles.pickerCol}>
                <Text style={styles.pickerColLabel}>Month</Text>
                <TouchableOpacity onPress={() => setPickerMonth((m) => Math.min(m + 1, 12))} style={styles.pickerBtn}>
                  <Feather name="chevron-up" size={20} color={Colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.pickerValue}>{padTwo(pickerMonth)}</Text>
                <TouchableOpacity onPress={() => setPickerMonth((m) => Math.max(m - 1, 1))} style={styles.pickerBtn}>
                  <Feather name="chevron-down" size={20} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>
              {/* Year */}
              <View style={styles.pickerCol}>
                <Text style={styles.pickerColLabel}>Year</Text>
                <TouchableOpacity onPress={() => setPickerYear((y) => y + 1)} style={styles.pickerBtn}>
                  <Feather name="chevron-up" size={20} color={Colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.pickerValue}>{pickerYear}</Text>
                <TouchableOpacity onPress={() => setPickerYear((y) => Math.max(y - 1, new Date().getFullYear()))} style={styles.pickerBtn}>
                  <Feather name="chevron-down" size={20} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={[styles.pickerApply, { backgroundColor: Colors.primary }]} onPress={applyDatePicker}>
              <Text style={styles.pickerApplyText}>Done</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
    },
    headerTitle: {
      ...Typography.body,
      fontWeight: '600',
      color: Colors.textPrimary,
    },
    stepRow: {
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'center',
      paddingVertical: Spacing.sm,
    },
    stepDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: Colors.border,
    },
    stepDotActive: {
      backgroundColor: Colors.primary,
      width: 24,
    },
    stepDotDone: {
      backgroundColor: Colors.primary,
      opacity: 0.4,
    },
    content: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.xl,
    },
    stepTitle: {
      ...Typography.h3,
      color: Colors.textPrimary,
      marginBottom: Spacing.xl,
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: Colors.textSecondary,
      marginBottom: Spacing.sm,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    input: {
      backgroundColor: isDark ? Colors.surface : Colors.white,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: Radius.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: 14,
      ...Typography.body,
      color: Colors.textPrimary,
      marginBottom: Spacing.md,
    },
    inputError: {
      borderColor: Colors.error,
    },
    errorText: {
      fontSize: 12,
      color: Colors.error,
      marginTop: -Spacing.sm,
      marginBottom: Spacing.sm,
    },
    dateInput: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    dateInputText: {
      ...Typography.body,
      color: Colors.textPrimary,
    },
    freqTile: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? Colors.surface : Colors.white,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: Radius.sm,
      padding: Spacing.md,
      marginBottom: Spacing.md,
    },
    freqTileActive: {
      borderColor: Colors.primary,
      backgroundColor: isDark ? 'rgba(183,238,122,0.08)' : 'rgba(183,238,122,0.15)',
    },
    freqLabel: {
      ...Typography.body,
      fontWeight: '600',
      color: Colors.textPrimary,
      marginBottom: 2,
    },
    freqLabelActive: {
      color: Colors.primary,
    },
    freqDesc: {
      fontSize: 13,
      color: Colors.textSecondary,
    },
    summaryCard: {
      backgroundColor: isDark ? Colors.surface : Colors.white,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: Colors.border,
      padding: Spacing.md,
      marginTop: Spacing.lg,
    },
    summaryLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: Colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: Spacing.sm,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 6,
    },
    summaryKey: {
      ...Typography.body,
      color: Colors.textSecondary,
    },
    summaryValue: {
      ...Typography.body,
      fontWeight: '600',
      color: Colors.textPrimary,
    },
    footer: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.xl,
      paddingTop: Spacing.md,
    },
    actionButton: {
      borderRadius: Radius.lg,
      paddingVertical: 16,
      alignItems: 'center',
    },
    actionButtonText: {
      ...Typography.body,
      fontWeight: '600',
      color: Colors.white,
      fontSize: 16,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
    },
    pickerSheet: {
      backgroundColor: isDark ? Colors.surface : Colors.white,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.xl,
      paddingBottom: 40,
    },
    pickerTitle: {
      ...Typography.h3,
      color: Colors.textPrimary,
      marginBottom: Spacing.xl,
      textAlign: 'center',
    },
    pickerRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: Spacing.xl,
      marginBottom: Spacing.xl,
    },
    pickerCol: {
      alignItems: 'center',
      width: 72,
    },
    pickerColLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: Colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: Spacing.sm,
    },
    pickerBtn: {
      padding: Spacing.sm,
    },
    pickerValue: {
      fontSize: 28,
      fontWeight: '700',
      color: Colors.textPrimary,
      minWidth: 48,
      textAlign: 'center',
    },
    pickerApply: {
      borderRadius: Radius.lg,
      paddingVertical: 16,
      alignItems: 'center',
    },
    pickerApplyText: {
      ...Typography.body,
      fontWeight: '600',
      color: Colors.white,
      fontSize: 16,
    },
  });
}
