import React, { useState, useCallback } from 'react';
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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@react-native-vector-icons/feather';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation } from '@tanstack/react-query';
import { RootStackParamList } from '../../../navigation/types';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';
import { BackButton } from '../../../components/ui/BackButton';
import { bulkTransfer } from '../../../services/api';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'BulkTransfer'>;

type RecipientRow = {
  id: string;
  recipientIdentifier: string;
  amount: string;
  note: string;
};

type TransferResult = {
  recipientIdentifier: string;
  amount: number;
  status: 'SUCCESS' | 'FAILED';
  reason?: string;
};

function createRow(): RecipientRow {
  return { id: Math.random().toString(36).slice(2), recipientIdentifier: '', amount: '', note: '' };
}

export default function BulkTransferScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();

  const [rows, setRows] = useState<RecipientRow[]>([createRow(), createRow()]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [results, setResults] = useState<TransferResult[] | null>(null);
  const [resultsVisible, setResultsVisible] = useState(false);

  const mutation = useMutation({
    mutationFn: bulkTransfer,
    onSuccess: (res) => {
      const data: any[] = res.data?.data?.results || res.data?.results || [];
      // Merge with our rows for display
      const mapped: TransferResult[] = rows.map((row, i) => {
        const r = data[i];
        return {
          recipientIdentifier: row.recipientIdentifier,
          amount: parseFloat(row.amount),
          status: r?.status === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
          reason: r?.reason,
        };
      });
      setResults(mapped);
      setResultsVisible(true);
    },
    onError: (err: any) => {
      // Show a generic results view with all failed
      const mapped: TransferResult[] = rows.map((row) => ({
        recipientIdentifier: row.recipientIdentifier,
        amount: parseFloat(row.amount),
        status: 'FAILED',
        reason: err?.response?.data?.message || 'Request failed',
      }));
      setResults(mapped);
      setResultsVisible(true);
    },
  });

  const updateRow = useCallback((id: string, field: keyof RecipientRow, value: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[`${id}_${field}`];
      return next;
    });
  }, []);

  const addRow = () => {
    if (rows.length >= 10) return;
    setRows((prev) => [...prev, createRow()]);
  };

  const removeRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const total = rows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    rows.forEach((row) => {
      if (!row.recipientIdentifier.trim()) e[`${row.id}_recipientIdentifier`] = 'Required';
      const amt = parseFloat(row.amount);
      if (!row.amount || isNaN(amt) || amt <= 0) e[`${row.id}_amount`] = 'Invalid';
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSendAll = () => {
    if (!validate()) return;
    mutation.mutate({
      transfers: rows.map((r) => ({
        recipientIdentifier: r.recipientIdentifier.trim(),
        amount: parseFloat(r.amount),
        ...(r.note.trim() ? { note: r.note.trim() } : {}),
      })),
    });
  };

  const handleCloseResults = () => {
    setResultsVisible(false);
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" />

      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Pay Multiple</Text>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {rows.map((row, index) => (
            <View key={row.id} style={styles.rowCard}>
              <View style={styles.rowCardHeader}>
                <Text style={styles.rowIndex}>#{index + 1}</Text>
                {rows.length > 2 && (
                  <TouchableOpacity onPress={() => removeRow(row.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Feather name="x" size={18} color={Colors.error} />
                  </TouchableOpacity>
                )}
              </View>
              <TextInput
                style={[styles.input, errors[`${row.id}_recipientIdentifier`] ? styles.inputError : undefined]}
                placeholder="Email, phone or @handle"
                placeholderTextColor={Colors.textSecondary}
                value={row.recipientIdentifier}
                onChangeText={(t) => updateRow(row.id, 'recipientIdentifier', t)}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              {errors[`${row.id}_recipientIdentifier`] && (
                <Text style={styles.errorText}>{errors[`${row.id}_recipientIdentifier`]}</Text>
              )}
              <TextInput
                style={[styles.input, errors[`${row.id}_amount`] ? styles.inputError : undefined]}
                placeholder="Amount (GHS)"
                placeholderTextColor={Colors.textSecondary}
                value={row.amount}
                onChangeText={(t) => updateRow(row.id, 'amount', t)}
                keyboardType="decimal-pad"
              />
              {errors[`${row.id}_amount`] && (
                <Text style={styles.errorText}>{errors[`${row.id}_amount`]}</Text>
              )}
              <TextInput
                style={styles.input}
                placeholder="Note (optional)"
                placeholderTextColor={Colors.textSecondary}
                value={row.note}
                onChangeText={(t) => updateRow(row.id, 'note', t)}
              />
            </View>
          ))}

          {rows.length < 10 && (
            <TouchableOpacity style={styles.addBtn} activeOpacity={0.7} onPress={addRow}>
              <Feather name="plus" size={18} color={Colors.primary} />
              <Text style={styles.addBtnText}>Add recipient</Text>
            </TouchableOpacity>
          )}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>
              GHS {total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: Colors.primary }]}
          activeOpacity={0.85}
          onPress={handleSendAll}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.sendBtnText}>Send All</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Results modal */}
      <Modal
        visible={resultsVisible}
        transparent
        animationType="slide"
        onRequestClose={handleCloseResults}
      >
        <View style={styles.resultsContainer}>
          <View style={styles.resultsSheet}>
            <Text style={styles.resultsTitle}>Transfer Results</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {(results ?? []).map((r, i) => (
                <View key={i} style={styles.resultItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultRecipient} numberOfLines={1}>{r.recipientIdentifier}</Text>
                    <Text style={styles.resultAmount}>
                      GHS {r.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                    {r.status === 'FAILED' && r.reason && (
                      <Text style={styles.resultReason}>{r.reason}</Text>
                    )}
                  </View>
                  <View style={[styles.resultBadge, { backgroundColor: r.status === 'SUCCESS' ? 'rgba(22,163,74,0.12)' : 'rgba(239,68,68,0.12)' }]}>
                    <Text style={[styles.resultBadgeText, { color: r.status === 'SUCCESS' ? '#16a34a' : '#EF4444' }]}>
                      {r.status === 'SUCCESS' ? 'Sent' : 'Failed'}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.resultsCloseBtn, { backgroundColor: Colors.primary }]}
              onPress={handleCloseResults}
              activeOpacity={0.85}
            >
              <Text style={styles.resultsCloseBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
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
    content: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: 100,
    },
    rowCard: {
      backgroundColor: isDark ? Colors.surface : Colors.white,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: Colors.border,
      padding: Spacing.md,
      marginBottom: Spacing.md,
    },
    rowCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    rowIndex: {
      fontSize: 13,
      fontWeight: '700',
      color: Colors.textSecondary,
    },
    input: {
      backgroundColor: isDark ? Colors.background : '#F9FAFB',
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: Radius.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: 12,
      ...Typography.body,
      color: Colors.textPrimary,
      marginBottom: Spacing.sm,
    },
    inputError: {
      borderColor: Colors.error,
    },
    errorText: {
      fontSize: 11,
      color: Colors.error,
      marginTop: -Spacing.xs,
      marginBottom: Spacing.sm,
    },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.md,
      justifyContent: 'center',
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: Colors.primary,
      borderRadius: Radius.sm,
      marginBottom: Spacing.lg,
    },
    addBtnText: {
      ...Typography.body,
      fontWeight: '600',
      color: Colors.primary,
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: Colors.border,
    },
    totalLabel: {
      ...Typography.body,
      fontWeight: '600',
      color: Colors.textSecondary,
    },
    totalValue: {
      fontSize: 20,
      fontWeight: '700',
      color: Colors.textPrimary,
    },
    footer: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.xl,
      paddingTop: Spacing.md,
    },
    sendBtn: {
      borderRadius: Radius.lg,
      paddingVertical: 16,
      alignItems: 'center',
    },
    sendBtnText: {
      ...Typography.body,
      fontWeight: '600',
      color: Colors.white,
      fontSize: 16,
    },
    resultsContainer: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    resultsSheet: {
      backgroundColor: isDark ? Colors.surface : Colors.white,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.xl,
      paddingBottom: 40,
    },
    resultsTitle: {
      ...Typography.h3,
      color: Colors.textPrimary,
      marginBottom: Spacing.lg,
      textAlign: 'center',
    },
    resultItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: Spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.border,
      gap: Spacing.md,
    },
    resultRecipient: {
      ...Typography.body,
      fontWeight: '600',
      color: Colors.textPrimary,
    },
    resultAmount: {
      fontSize: 13,
      color: Colors.textSecondary,
      marginTop: 2,
    },
    resultReason: {
      fontSize: 12,
      color: Colors.error,
      marginTop: 2,
    },
    resultBadge: {
      borderRadius: 6,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    resultBadgeText: {
      fontSize: 12,
      fontWeight: '700',
    },
    resultsCloseBtn: {
      marginTop: Spacing.xl,
      borderRadius: Radius.lg,
      paddingVertical: 16,
      alignItems: 'center',
    },
    resultsCloseBtnText: {
      ...Typography.body,
      fontWeight: '600',
      color: Colors.white,
      fontSize: 16,
    },
  });
}
