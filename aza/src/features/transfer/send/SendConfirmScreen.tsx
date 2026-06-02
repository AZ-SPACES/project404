import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
} from 'react-native';
import { Feather } from '@react-native-vector-icons/feather';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { useAppTheme, ThemeColors, Typography, Spacing } from '../../../theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { useTransferStore } from '../../../store/transferStore';
import { useToast } from '../../../providers/ToastProvider';
import { BackButton } from '../../../components/ui/BackButton';
import Button from '../../../components/ui/Button';
import { CATEGORY_META, CategoryKey } from '../../../utils/categories';
import { checkTransferAnomaly } from '../../../services/api';
import { queryKeys } from '../../../lib/queryKeys';
import { extractErrorMessage } from '../../../utils/errorUtils';

type SendConfirmScreenProps = NativeStackScreenProps<RootStackParamList, 'SendConfirm'>;

export default function SendConfirmScreen({ navigation, route }: SendConfirmScreenProps) {
  const { name, username, avatar, amount, note, identifier, category } = route.params;
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const isDark = Colors.isDark;
  const { showToast } = useToast();

  const displayAmount = amount.toFixed(2);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [editedNote, setEditedNote] = useState(note || '');

  const { initiateTransfer } = useTransferStore();

  const { data: anomalyData } = useQuery({
    queryKey: queryKeys.anomalyCheck(identifier, amount),
    queryFn: async () => {
      const res = await checkTransferAnomaly(identifier, amount);
      return res.data?.data || res.data;
    },
    staleTime: 60_000,
    retry: false,
  });

  const anomalyRisk: string = anomalyData?.riskLevel ?? 'LOW';
  const anomalyReason: string | null = anomalyData?.reason ?? null;
  const showAnomalyWarning = anomalyRisk === 'MEDIUM' || anomalyRisk === 'HIGH';

  const handleConfirmSend = async () => {
    if (isLoading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    try {
      await initiateTransfer({ recipientIdentifier: identifier, amount, note: editedNote, ...(category ? { category } : {}) });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.navigate('SendPin', { name, username, avatar, amount, note: editedNote, identifier, ...(category ? { category } : {}) });
    } catch (err: unknown) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast(extractErrorMessage(err, 'Could not initiate transfer. Please try again.'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Review Transfer</Text>
        <View style={styles.backButtonPlaceholder} />
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Recipient Overview */}
        <View style={styles.overviewContainer}>
          <Image source={{ uri: avatar }} style={styles.avatarLarge} />
          <Text style={styles.recipientName}>{name}</Text>
          <Text style={styles.recipientUsername}>{username}</Text>
          <Text style={styles.amountHuge}>GH¢ {displayAmount}</Text>
        </View>

        {/* Receipt / Details Card */}
        <View style={styles.receiptCard}>
          {category && CATEGORY_META[category as CategoryKey] && (
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Purpose</Text>
              <View style={styles.purposeValue}>
                <View style={[styles.purposeIconBadge, { backgroundColor: CATEGORY_META[category as CategoryKey]!.color + '1A' }]}>
                  <Feather name={CATEGORY_META[category as CategoryKey]!.icon as any} size={14} color={CATEGORY_META[category as CategoryKey]!.color} />
                </View>
                <Text style={[styles.receiptValue, { color: CATEGORY_META[category as CategoryKey]!.color, fontWeight: '500' }]}>{CATEGORY_META[category as CategoryKey]!.name}</Text>
              </View>
            </View>
          )}

          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Note</Text>
            <View style={styles.noteValueContainer}>
              {isEditingNote ? (
                <TextInput
                  style={[styles.receiptValue, styles.noteInput]}
                  value={editedNote}
                  onChangeText={setEditedNote}
                  autoFocus
                  onBlur={() => setIsEditingNote(false)}
                  onSubmitEditing={() => setIsEditingNote(false)}
                  returnKeyType="done"
                  maxLength={100}
                />
              ) : (
                <>
                  <Text style={styles.receiptValue} numberOfLines={1}>{editedNote || 'None'}</Text>
                  <TouchableOpacity onPress={() => setIsEditingNote(true)} style={styles.editBtn}>
                    <Feather name="edit-2" size={14} color={Colors.primary} />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>

          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Fees</Text>
            <Text style={styles.receiptValue}>No fees</Text>
          </View>

          <View style={[styles.receiptRow, styles.receiptRowLast]}>
            <Text style={styles.receiptTotalLabel}>Total to Pay</Text>
            <Text style={styles.receiptTotalValue}>GH¢ {displayAmount}</Text>
          </View>
        </View>

        {/* Anomaly Warning Banner */}
        {showAnomalyWarning && (
          <View style={[styles.anomalyBanner, anomalyRisk === 'HIGH' && styles.anomalyBannerHigh]}>
            <Feather
              name="alert-triangle"
              size={16}
              color={anomalyRisk === 'HIGH' ? '#EF4444' : '#F59E0B'}
              style={{ marginTop: 2, flexShrink: 0 }}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.anomalyBannerTitle, anomalyRisk === 'HIGH' && { color: '#EF4444' }]}>
                {anomalyRisk === 'HIGH' ? 'Unusual transfer detected' : 'Transfer looks unusual'}
              </Text>
              {anomalyReason ? (
                <Text style={styles.anomalyBannerBody}>{anomalyReason}</Text>
              ) : null}
            </View>
          </View>
        )}

        {/* Standard Warning Banner */}
        <View style={styles.warningBanner}>
          <Feather name="shield" size={16} color={Colors.textSecondary} style={{ marginTop: 2 }} />
          <Text style={styles.warningBannerText}>
            Ensure you trust this recipient. We cannot refund authorized payments sent to wrong accounts or scammers.
          </Text>
        </View>

      </ScrollView>

      {/* Footer Button */}
      <View style={styles.footer}>
        <Button
          title={`Send GH¢ ${displayAmount}`}
          onPress={handleConfirmSend}
          loading={isLoading}
          disabled={isLoading}
          backgroundColor={Colors.primary}
          textColor={Colors.white}
        />
      </View>
    </SafeAreaView>
  );
}

const AVATAR_SIZE = 64;

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    flex: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.xl,
      flexGrow: 1,
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
    backButtonPlaceholder: {
      width: 44,
    },
    overviewContainer: {
      alignItems: 'center',
      marginTop: Spacing.lg,
      marginBottom: Spacing.xl,
    },
    avatarLarge: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: AVATAR_SIZE / 2,
      backgroundColor: Colors.border,
      marginBottom: Spacing.sm,
    },
    recipientName: {
      ...Typography.h3,
      fontWeight: '600',
      color: Colors.textPrimary,
    },
    recipientUsername: {
      ...Typography.body,
      color: Colors.textSecondary,
      marginTop: 2,
    },
    amountHuge: {
      fontSize: 40,
      fontWeight: '700',
      color: Colors.textPrimary,
      marginTop: Spacing.md,
    },
    receiptCard: {
      backgroundColor: isDark ? Colors.surface : Colors.white,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Colors.border,
      overflow: 'hidden',
      marginBottom: Spacing.lg,
    },
    receiptRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: Colors.border,
    },
    receiptRowLast: {
      borderBottomWidth: 0,
      backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC',
    },
    receiptLabel: {
      ...Typography.body,
      color: Colors.textSecondary,
    },
    receiptValue: {
      ...Typography.body,
      color: Colors.textPrimary,
      fontWeight: '500',
      maxWidth: 180,
    },
    receiptTotalLabel: {
      ...Typography.body,
      color: Colors.textPrimary,
      fontWeight: '600',
    },
    receiptTotalValue: {
      ...Typography.h3,
      color: Colors.textPrimary,
      fontWeight: '700',
    },
    purposeValue: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    purposeIconBadge: {
      width: 24,
      height: 24,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 6,
    },
    noteValueContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    noteInput: {
      borderBottomWidth: 1,
      borderBottomColor: Colors.primary,
      minWidth: 120,
      padding: 0,
      textAlign: 'right',
    },
    editBtn: {
      marginLeft: 8,
      padding: 4,
    },
    anomalyBanner: {
      flexDirection: 'row',
      backgroundColor: '#FEF3C7',
      padding: Spacing.md,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#F59E0B',
      gap: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    anomalyBannerHigh: {
      backgroundColor: '#FEE2E2',
      borderColor: '#EF4444',
    },
    anomalyBannerTitle: {
      ...Typography.caption,
      fontWeight: '700',
      color: '#B45309',
    },
    anomalyBannerBody: {
      ...Typography.caption,
      color: '#78350F',
      lineHeight: 16,
    },
    warningBanner: {
      flexDirection: 'row',
      backgroundColor: isDark ? Colors.surface : '#F8FAFC',
      padding: Spacing.md,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: Colors.border,
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    warningBannerText: {
      flex: 1,
      ...Typography.caption,
      color: Colors.textSecondary,
      lineHeight: 18,
    },
    footer: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.lg,
      borderTopWidth: 1,
      borderTopColor: Colors.border,
      backgroundColor: Colors.background,
    },
  });
}
