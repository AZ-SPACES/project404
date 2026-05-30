import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@react-native-vector-icons/feather';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RootStackParamList } from '../../../navigation/types';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';
import { BackButton } from '../../../components/ui/BackButton';
import { queryKeys } from '../../../lib/queryKeys';
import {
  getRecurringTransfers,
  pauseRecurringTransfer,
  resumeRecurringTransfer,
  cancelRecurringTransfer,
} from '../../../services/api';
import { formatCurrency } from '../../../utils/transactionUtils';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'RecurringTransfers'>;

type RecurringTransfer = {
  id: string;
  recipientIdentifier: string;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  amount: number;
  nextRunDate: string;
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED';
  note?: string;
};

function FrequencyBadge({ frequency, Colors }: { frequency: string; Colors: ThemeColors }) {
  const color = frequency === 'DAILY' ? '#6366F1' : frequency === 'WEEKLY' ? '#0EA5E9' : '#8B5CF6';
  const bg = frequency === 'DAILY' ? 'rgba(99,102,241,0.12)' : frequency === 'WEEKLY' ? 'rgba(14,165,233,0.12)' : 'rgba(139,92,246,0.12)';
  return (
    <View style={{ backgroundColor: bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {frequency}
      </Text>
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = status === 'ACTIVE' ? '#16a34a' : status === 'PAUSED' ? '#D97706' : '#9CA3AF';
  const bg = status === 'ACTIVE' ? 'rgba(22,163,74,0.12)' : status === 'PAUSED' ? 'rgba(217,119,6,0.12)' : 'rgba(156,163,175,0.12)';
  const label = status === 'ACTIVE' ? 'Active' : status === 'PAUSED' ? 'Paused' : 'Cancelled';
  return (
    <View style={{ backgroundColor: bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Text style={{ fontSize: 11, fontWeight: '600', color }}>{label}</Text>
    </View>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

export default function RecurringTransfersScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();
  const qc = useQueryClient();

  const [menuTransfer, setMenuTransfer] = useState<RecurringTransfer | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.recurringTransfers(),
    queryFn: async () => {
      const res = await getRecurringTransfers();
      return (res.data?.data || res.data || []) as RecurringTransfer[];
    },
    staleTime: 60_000,
  });

  const transfers: RecurringTransfer[] = data ?? [];

  const pauseMutation = useMutation({
    mutationFn: (id: string) => pauseRecurringTransfer(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.recurringTransfers() }),
  });

  const resumeMutation = useMutation({
    mutationFn: (id: string) => resumeRecurringTransfer(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.recurringTransfers() }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelRecurringTransfer(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.recurringTransfers() }),
  });

  const handleTogglePause = (transfer: RecurringTransfer) => {
    setMenuTransfer(null);
    if (transfer.status === 'ACTIVE') {
      pauseMutation.mutate(transfer.id);
    } else if (transfer.status === 'PAUSED') {
      resumeMutation.mutate(transfer.id);
    }
  };

  const handleCancel = (transfer: RecurringTransfer) => {
    setMenuTransfer(null);
    Alert.alert(
      'Cancel Scheduled Transfer',
      `Are you sure you want to cancel the ${transfer.frequency.toLowerCase()} transfer to ${transfer.recipientIdentifier}?`,
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Cancel transfer',
          style: 'destructive',
          onPress: () => cancelMutation.mutate(transfer.id),
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" />

      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Scheduled Transfers</Text>
        <View style={{ width: 44 }} />
      </View>

      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : transfers.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconCircle}>
            <Feather name="clock" size={32} color={Colors.textSecondary} />
          </View>
          <Text style={styles.emptyTitle}>No scheduled transfers</Text>
          <Text style={styles.emptySubtitle}>Automate recurring payments to save time</Text>
          <TouchableOpacity
            style={styles.emptyButton}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('CreateRecurringTransfer')}
          >
            <Text style={styles.emptyButtonText}>Set one up</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {transfers.map((transfer) => (
            <View key={transfer.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recipientText} numberOfLines={1}>{transfer.recipientIdentifier}</Text>
                  <View style={styles.badgeRow}>
                    <FrequencyBadge frequency={transfer.frequency} Colors={Colors} />
                    <StatusBadge status={transfer.status} />
                  </View>
                </View>
                <View style={styles.cardRight}>
                  <Text style={styles.amountText}>{formatCurrency(transfer.amount, 'GHS')}</Text>
                  <TouchableOpacity
                    onPress={() => setMenuTransfer(transfer)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.menuBtn}
                  >
                    <Feather name="more-vertical" size={18} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>
              {transfer.nextRunDate && transfer.status !== 'CANCELLED' && (
                <Text style={styles.nextRunText}>Next: {formatDate(transfer.nextRunDate)}</Text>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Floating new button */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: Colors.primary }]}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('CreateRecurringTransfer')}
      >
        <Feather name="plus" size={24} color={Colors.white} />
      </TouchableOpacity>

      {/* Action menu modal */}
      <Modal
        visible={!!menuTransfer}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuTransfer(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setMenuTransfer(null)}>
          <View style={styles.menuSheet}>
            {menuTransfer && (
              <>
                <Text style={styles.menuTitle} numberOfLines={1}>{menuTransfer.recipientIdentifier}</Text>
                <View style={styles.menuDivider} />
                {menuTransfer.status !== 'CANCELLED' && (
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => handleTogglePause(menuTransfer)}
                  >
                    <Feather
                      name={menuTransfer.status === 'ACTIVE' ? 'pause-circle' : 'play-circle'}
                      size={20}
                      color={Colors.textPrimary}
                    />
                    <Text style={styles.menuItemText}>
                      {menuTransfer.status === 'ACTIVE' ? 'Pause' : 'Resume'}
                    </Text>
                  </TouchableOpacity>
                )}
                {menuTransfer.status !== 'CANCELLED' && (
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => handleCancel(menuTransfer)}
                  >
                    <Feather name="x-circle" size={20} color={Colors.error} />
                    <Text style={[styles.menuItemText, { color: Colors.error }]}>Cancel</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
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
    loader: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: 100,
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.xl,
    },
    emptyIconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: isDark ? Colors.surface : '#F3F4F6',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.lg,
    },
    emptyTitle: {
      ...Typography.h3,
      color: Colors.textPrimary,
      marginBottom: Spacing.sm,
      textAlign: 'center',
    },
    emptySubtitle: {
      ...Typography.body,
      color: Colors.textSecondary,
      textAlign: 'center',
      marginBottom: Spacing.xl,
    },
    emptyButton: {
      backgroundColor: Colors.primary,
      borderRadius: Radius.lg,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.xl,
    },
    emptyButtonText: {
      ...Typography.body,
      fontWeight: '600',
      color: Colors.white,
    },
    card: {
      backgroundColor: isDark ? Colors.surface : Colors.white,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: Colors.border,
      padding: Spacing.md,
      marginTop: Spacing.md,
    },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
    },
    badgeRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginTop: Spacing.xs,
    },
    cardRight: {
      alignItems: 'flex-end',
      gap: Spacing.xs,
    },
    recipientText: {
      ...Typography.body,
      fontWeight: '600',
      color: Colors.textPrimary,
    },
    amountText: {
      ...Typography.body,
      fontWeight: '700',
      color: Colors.textPrimary,
    },
    menuBtn: {
      padding: 2,
    },
    nextRunText: {
      fontSize: 12,
      color: Colors.textSecondary,
      marginTop: Spacing.sm,
    },
    fab: {
      position: 'absolute',
      bottom: 32,
      right: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.18,
      shadowRadius: 8,
      elevation: 6,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
    },
    menuSheet: {
      backgroundColor: isDark ? Colors.surface : Colors.white,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.lg,
      paddingBottom: 40,
    },
    menuTitle: {
      ...Typography.body,
      fontWeight: '600',
      color: Colors.textPrimary,
      marginBottom: Spacing.md,
    },
    menuDivider: {
      height: 1,
      backgroundColor: Colors.border,
      marginBottom: Spacing.md,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingVertical: Spacing.md,
    },
    menuItemText: {
      ...Typography.body,
      fontWeight: '500',
      color: Colors.textPrimary,
    },
  });
}
