import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, TextInput, ActivityIndicator, Alert, Modal, Pressable,
} from 'react-native';
import { Feather } from '@react-native-vector-icons/feather';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';
import { BackButton } from '../../../components/ui/BackButton';
import { queryKeys } from '../../../lib/queryKeys';
import { getBudgets, createOrUpdateBudget, deleteBudget } from '../../../services/api';

type CategoryKey = 'BILLS' | 'TRANSPORT' | 'FOOD' | 'EDUCATION' | 'ENTERTAINMENT' | 'SHOPPING' | 'HEALTHCARE' | 'SAVINGS' | 'OTHERS';

const ALL_CATEGORIES: { key: CategoryKey; name: string; icon: string; color: string }[] = [
  { key: 'BILLS',         name: 'Bills & Utilities', icon: 'zap',            color: '#60A5FA' },
  { key: 'TRANSPORT',     name: 'Transport',         icon: 'navigation',     color: '#34D399' },
  { key: 'FOOD',          name: 'Food & Drinks',     icon: 'coffee',         color: '#F59E0B' },
  { key: 'EDUCATION',     name: 'Education',         icon: 'book-open',      color: '#A78BFA' },
  { key: 'ENTERTAINMENT', name: 'Entertainment',     icon: 'film',           color: '#F472B6' },
  { key: 'SHOPPING',      name: 'Shopping',          icon: 'shopping-bag',   color: '#FB923C' },
  { key: 'HEALTHCARE',    name: 'Healthcare',        icon: 'heart',          color: '#EF4444' },
  { key: 'SAVINGS',       name: 'Savings',           icon: 'trending-up',    color: '#10B981' },
  { key: 'OTHERS',        name: 'Others',            icon: 'more-horizontal',color: '#94A3B8' },
];

type BudgetItem = { id?: string; category: string; budgetAmount?: number; period?: string };

type ModalState = { visible: boolean; category: CategoryKey; currentAmount: string; currentPeriod: string; budgetId?: string };

export default function BudgetManagementScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation();
  const queryClient = useQueryClient();

  const [modal, setModal] = useState<ModalState>({
    visible: false, category: 'BILLS', currentAmount: '', currentPeriod: 'MONTHLY',
  });

  const { data: budgets, isLoading } = useQuery({
    queryKey: queryKeys.budgets(),
    queryFn: async () => {
      const res = await getBudgets();
      return (res.data?.data || res.data) as BudgetItem[];
    },
    staleTime: 60_000,
  });

  const budgetMap = React.useMemo(() => {
    const map: Record<string, BudgetItem> = {};
    (budgets ?? []).forEach(b => { map[b.category] = b; });
    return map;
  }, [budgets]);

  const saveMutation = useMutation({
    mutationFn: (data: { category: string; budgetAmount: number; period: string }) =>
      createOrUpdateBudget(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets() });
      queryClient.invalidateQueries({ queryKey: ['budget-status'] });
      setModal(m => ({ ...m, visible: false }));
    },
    onError: (err: any) => {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to save budget');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBudget(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets() });
      queryClient.invalidateQueries({ queryKey: ['budget-status'] });
    },
    onError: (err: any) => {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to delete budget');
    },
  });

  const openModal = (cat: typeof ALL_CATEGORIES[0]) => {
    const existing = budgetMap[cat.key];
    const next: ModalState = {
      visible: true,
      category: cat.key,
      currentAmount: existing?.budgetAmount ? String(existing.budgetAmount) : '',
      currentPeriod: existing?.period ?? 'MONTHLY',
    };
    if (existing?.id) next.budgetId = existing.id;
    setModal(next);
  };

  const handleSave = () => {
    const amount = parseFloat(modal.currentAmount);
    if (isNaN(amount) || amount < 1) {
      Alert.alert('Invalid amount', 'Please enter a valid budget amount (minimum GH₵1)');
      return;
    }
    saveMutation.mutate({ category: modal.category, budgetAmount: amount, period: modal.currentPeriod });
  };

  const handleDelete = (budgetId: string, catName: string) => {
    Alert.alert(`Remove budget`, `Remove the budget limit for ${catName}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => deleteMutation.mutate(budgetId) },
    ]);
  };

  const PERIODS = [
    { key: 'WEEKLY', label: 'Weekly' },
    { key: 'MONTHLY', label: 'Monthly' },
    { key: 'YEARLY', label: 'Yearly' },
  ];

  const selectedCatMeta = ALL_CATEGORIES.find(c => c.key === modal.category)!;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" />

      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Budget Limits</Text>
        <View style={{ width: 44 }} />
      </View>

      <Text style={styles.subtitle}>Set monthly spending limits per category to track your expenses.</Text>

      {isLoading ? (
        <View style={styles.loader}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {ALL_CATEGORIES.map((cat, i) => {
            const budget = budgetMap[cat.key];
            const hasBudget = !!budget?.budgetAmount;
            return (
              <TouchableOpacity
                key={cat.key}
                style={[styles.catRow, i === ALL_CATEGORIES.length - 1 && styles.catRowLast]}
                onPress={() => openModal(cat)}
                activeOpacity={0.7}
              >
                <View style={[styles.iconWrap, { backgroundColor: cat.color + '20' }]}>
                  <Feather name={cat.icon as any} size={20} color={cat.color} />
                </View>
                <View style={styles.catText}>
                  <Text style={styles.catName}>{cat.name}</Text>
                  {hasBudget ? (
                    <Text style={styles.budgetSet}>GH₵ {Number(budget!.budgetAmount).toFixed(2)} / {(budget!.period ?? 'MONTHLY').toLowerCase()}</Text>
                  ) : (
                    <Text style={styles.noBudgetLabel}>No limit set</Text>
                  )}
                </View>
                <View style={styles.rowRight}>
                  {hasBudget && (
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDelete(budget!.id!, cat.name)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Feather name="trash-2" size={15} color={Colors.error || '#EF4444'} />
                    </TouchableOpacity>
                  )}
                  <Feather name="chevron-right" size={16} color={Colors.textSecondary} />
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Edit Budget Modal */}
      <Modal
        visible={modal.visible}
        transparent
        animationType="slide"
        onRequestClose={() => setModal(m => ({ ...m, visible: false }))}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setModal(m => ({ ...m, visible: false }))}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <View style={[styles.modalIcon, { backgroundColor: selectedCatMeta.color + '22' }]}>
                <Feather name={selectedCatMeta.icon as any} size={22} color={selectedCatMeta.color} />
              </View>
              <Text style={styles.modalTitle}>{selectedCatMeta.name}</Text>
            </View>

            <Text style={styles.modalLabel}>Monthly budget (GH₵)</Text>
            <View style={styles.inputWrap}>
              <Text style={styles.currencyPrefix}>GH₵</Text>
              <TextInput
                style={styles.amountInput}
                value={modal.currentAmount}
                onChangeText={v => setModal(m => ({ ...m, currentAmount: v.replace(/[^0-9.]/g, '') }))}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={Colors.textSecondary}
                autoFocus
              />
            </View>

            <Text style={[styles.modalLabel, { marginTop: Spacing.md }]}>Period</Text>
            <View style={styles.periodRow}>
              {PERIODS.map(p => (
                <TouchableOpacity
                  key={p.key}
                  style={[styles.periodChip, modal.currentPeriod === p.key && styles.periodChipActive]}
                  onPress={() => setModal(m => ({ ...m, currentPeriod: p.key }))}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.periodChipText, modal.currentPeriod === p.key && styles.periodChipTextActive]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, saveMutation.isPending && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saveMutation.isPending}
              activeOpacity={0.8}
            >
              {saveMutation.isPending
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.saveBtnText}>Save Budget</Text>}
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
    container: { flex: 1, backgroundColor: Colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    },
    headerTitle: { ...Typography.body, fontWeight: '600', color: Colors.textPrimary },
    subtitle: {
      ...Typography.caption, color: Colors.textSecondary,
      paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, lineHeight: 18,
    },
    loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl * 2 },

    catRow: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: isDark ? Colors.surface : Colors.white,
      borderRadius: 0, paddingVertical: Spacing.md, paddingHorizontal: Spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
      borderTopWidth: 0,
    },
    catRowLast: { borderBottomWidth: 0, borderBottomLeftRadius: 12, borderBottomRightRadius: 12 },
    iconWrap: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.md },
    catText: { flex: 1 },
    catName: { ...Typography.body, fontWeight: '600', color: Colors.textPrimary },
    budgetSet: { fontSize: 12, color: Colors.primary, fontWeight: '500', marginTop: 2 },
    noBudgetLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
    rowRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    deleteBtn: { padding: 2 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalSheet: {
      backgroundColor: isDark ? Colors.surface : Colors.white,
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      paddingHorizontal: Spacing.lg, paddingBottom: 40, paddingTop: Spacing.md,
    },
    modalHandle: {
      width: 40, height: 4, borderRadius: 2,
      backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.lg,
    },
    modalHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.lg },
    modalIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    modalTitle: { ...Typography.h3, fontWeight: '700', color: Colors.textPrimary },
    modalLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.sm },
    inputWrap: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: isDark ? Colors.background : '#F9FAFB',
      borderWidth: 1, borderColor: Colors.border,
      borderRadius: 12, paddingHorizontal: Spacing.md, paddingVertical: 14,
    },
    currencyPrefix: { ...Typography.h3, fontWeight: '700', color: Colors.textPrimary, marginRight: 4 },
    amountInput: { flex: 1, ...Typography.h3, fontWeight: '700', color: Colors.textPrimary, padding: 0 },
    periodRow: { flexDirection: 'row', gap: Spacing.sm },
    periodChip: {
      flex: 1, paddingVertical: 10, borderRadius: 10,
      backgroundColor: isDark ? Colors.background : '#F3F4F6',
      alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
    },
    periodChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    periodChipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
    periodChipTextActive: { color: '#fff' },
    saveBtn: {
      backgroundColor: Colors.primary, borderRadius: 12,
      paddingVertical: 16, alignItems: 'center', marginTop: Spacing.xl,
    },
    saveBtnText: { ...Typography.button, color: '#fff', fontWeight: '700' },
  });
}
