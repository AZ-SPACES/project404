import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@react-native-vector-icons/feather';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery } from '@tanstack/react-query';
import { RootStackParamList } from '../../../navigation/types';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';
import { BackButton } from '../../../components/ui/BackButton';
import Button from '../../../components/ui/Button';
import { queryKeys } from '../../../lib/queryKeys';
import { getUserLimits, requestLimitIncrease } from '../../../services/api';
import { formatCurrency } from '../../../utils/transactionUtils';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'LimitIncreaseRequest'>;

export default function LimitIncreaseRequestScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();

  const { data: limitsData } = useQuery({
    queryKey: queryKeys.userLimits(),
    queryFn: async () => { const res = await getUserLimits(); return res.data?.data || res.data; },
    staleTime: 5 * 60_000,
  });

  const currentDaily: number = limitsData?.dailyLimitGhs ?? 0;
  const currentSingle: number = limitsData?.singleTransactionLimitGhs ?? 0;

  const [reqDaily, setReqDaily] = useState('');
  const [reqSingle, setReqSingle] = useState('');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const mutation = useMutation({
    mutationFn: () => requestLimitIncrease({
      requestedDailyLimitGhs: reqDaily ? Number(reqDaily) : currentDaily,
      requestedSingleTransactionLimitGhs: reqSingle ? Number(reqSingle) : currentSingle,
      reason,
    }),
    onSuccess: () => setSubmitted(true),
  });

  const canSubmit = (reqDaily || reqSingle) && reason.trim().length >= 10 && !mutation.isPending;

  if (submitted) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" />
        <View style={styles.header}>
          <BackButton onPress={() => navigation.goBack()} />
          <Text style={styles.headerTitle}>Request Submitted</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Feather name="check" size={32} color={Colors.primary} />
          </View>
          <Text style={styles.successTitle}>Request received</Text>
          <Text style={styles.successSub}>
            We've received your limit increase request and will review it within 2 business days.
            You'll be notified by email and in the app once a decision is made.
          </Text>
          <Button
            title="Done"
            onPress={() => navigation.goBack()}
            backgroundColor={Colors.primary}
            textColor={Colors.secondary}
            borderRadius={Radius.sm}
            paddingVertical={14}
            paddingHorizontal={Spacing.xl * 2}
            width="auto"
            activeOpacity={0.8}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <BackButton onPress={() => navigation.goBack()} />
          <Text style={styles.headerTitle}>Request Limit Increase</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            Fill in the amounts you'd like and tell us why. We'll review your request within 2 business days.
          </Text>

          {/* Current limits summary */}
          <View style={styles.currentCard}>
            <Text style={styles.currentCardLabel}>Your current limits</Text>
            <View style={styles.currentRow}>
              <Text style={styles.currentItem}>Max per transaction</Text>
              <Text style={styles.currentValue}>{formatCurrency(currentSingle, 'GHS')}</Text>
            </View>
            <View style={[styles.currentRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.currentItem}>Max per day</Text>
              <Text style={styles.currentValue}>{formatCurrency(currentDaily, 'GHS')}</Text>
            </View>
          </View>

          {/* Requested limits */}
          <Text style={styles.fieldLabel}>Requested daily limit (GHS)</Text>
          <View style={styles.inputRow}>
            <Text style={styles.currency}>GHS</Text>
            <TextInput
              underlineColorAndroid="transparent"
              style={styles.input}
              value={reqDaily}
              onChangeText={setReqDaily}
              keyboardType="decimal-pad"
              placeholder={String(currentDaily)}
              placeholderTextColor={Colors.textSecondary}
              returnKeyType="next"
            />
          </View>

          <Text style={styles.fieldLabel}>Requested single-transaction limit (GHS)</Text>
          <View style={styles.inputRow}>
            <Text style={styles.currency}>GHS</Text>
            <TextInput
              underlineColorAndroid="transparent"
              style={styles.input}
              value={reqSingle}
              onChangeText={setReqSingle}
              keyboardType="decimal-pad"
              placeholder={String(currentSingle)}
              placeholderTextColor={Colors.textSecondary}
              returnKeyType="next"
            />
          </View>

          <Text style={styles.fieldLabel}>Reason for request</Text>
          <TextInput
            underlineColorAndroid="transparent"
            style={styles.reasonInput}
            value={reason}
            onChangeText={setReason}
            placeholder="Explain why you need higher limits (min. 10 characters)"
            placeholderTextColor={Colors.textSecondary}
            multiline
            numberOfLines={4}
            maxLength={500}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{reason.length}/500</Text>

          {mutation.error && (
            <Text style={styles.errorText}>{(mutation.error as Error).message}</Text>
          )}

          <Button
            title="Submit request"
            onPress={() => mutation.mutate()}
            disabled={!canSubmit}
            loading={mutation.isPending}
            backgroundColor={Colors.primary}
            textColor={Colors.secondary}
            borderRadius={Radius.sm}
            style={{ marginTop: Spacing.xl }}
            activeOpacity={0.8}
          />
        </ScrollView>
      </KeyboardAvoidingView>
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
    content: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.xl,
    },
    intro: {
      fontSize: 15,
      color: Colors.textSecondary,
      lineHeight: 22,
      marginTop: Spacing.md,
      marginBottom: Spacing.lg,
    },

    // Current limits card
    currentCard: {
      backgroundColor: isDark ? Colors.surface : Colors.white,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: Colors.border,
      overflow: 'hidden',
      marginBottom: Spacing.xl,
    },
    currentCardLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: Colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.sm,
    },
    currentRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.border,
    },
    currentItem: {
      ...Typography.body,
      color: Colors.textSecondary,
    },
    currentValue: {
      ...Typography.body,
      fontWeight: '600',
      color: Colors.textPrimary,
    },

    // Input
    fieldLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: Colors.textSecondary,
      marginBottom: Spacing.xs,
      marginTop: Spacing.md,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? Colors.surface : Colors.white,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: Colors.border,
      paddingHorizontal: Spacing.md,
      paddingVertical: 14,
      gap: Spacing.sm,
    },
    currency: {
      fontSize: 15,
      fontWeight: '600',
      color: Colors.textSecondary,
    },
    input: {
      flex: 1,
      fontSize: 15,
      color: Colors.textPrimary,
      padding: 0,
    },
    reasonInput: {
      backgroundColor: isDark ? Colors.surface : Colors.white,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: Colors.border,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      fontSize: 15,
      color: Colors.textPrimary,
      minHeight: 100,
    },
    charCount: {
      fontSize: 12,
      color: Colors.textSecondary,
      textAlign: 'right',
      marginTop: 4,
    },
    errorText: {
      fontSize: 14,
      color: '#EF4444',
      marginTop: Spacing.sm,
    },

    // Submit

    // Success
    successContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.xl,
    },
    successIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: isDark ? 'rgba(183,238,122,0.15)' : '#EAF5E9',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.lg,
    },
    successTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: Colors.textPrimary,
      marginBottom: Spacing.md,
    },
    successSub: {
      fontSize: 15,
      color: Colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: Spacing.xl,
    },
  });
}
