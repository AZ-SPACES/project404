import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform,
  ScrollView, StatusBar, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@react-native-vector-icons/feather';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { useQuery } from '@tanstack/react-query';
import { useAppTheme, Typography, Spacing, ThemeColors } from '../../../theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { useTransferStore } from '../../../store/transferStore';
import { useToast } from '../../../providers/ToastProvider';
import { getTransaction, getTransactionInsight } from '../../../services/api';
import { queryKeys } from '../../../lib/queryKeys';
import { CATEGORY_META, CategoryKey } from '../../../utils/categories';
import { formatCurrency } from '../../../utils/transactionUtils';

type SendSuccessScreenProps = NativeStackScreenProps<RootStackParamList, 'SendSuccess'>;

export default function SendSuccessScreen({ navigation, route }: SendSuccessScreenProps) {
  const { name, username, amount, note, identifier, transactionId, category: routeCategory } = route.params;
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const isDark = Colors.isDark;
  const { showToast } = useToast();
  const { reset: resetTransferStore } = useTransferStore();

  const receiptRef = useRef<View>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    resetTransferStore();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [resetTransferStore]);

  // Fetch the confirmed transaction from backend for accurate data
  const { data: tx, isLoading: txLoading } = useQuery({
    queryKey: ['transaction', transactionId],
    queryFn: async () => {
      if (!transactionId) return null;
      const res = await getTransaction(transactionId);
      return res.data?.data || res.data;
    },
    enabled: !!transactionId,
    staleTime: 5 * 60_000,
  });

  // Fetch AI insight once the transaction has confirmed
  const { data: insightData } = useQuery({
    queryKey: queryKeys.transactionInsight(transactionId ?? ''),
    queryFn: async () => {
      if (!transactionId) return null;
      const res = await getTransactionInsight(transactionId);
      return res.data?.data?.insight ?? res.data?.insight ?? null;
    },
    enabled: !!transactionId && !txLoading && (tx?.status === 'COMPLETED'),
    staleTime: Infinity,
    retry: false,
  });

  // Merge backend data with route params (backend is authoritative when available)
  const txAmount: number  = tx?.amount  ? Number(tx.amount)   : amount;
  const txNote: string    = tx?.note    ?? note ?? '';
  const txStatus: string  = tx?.status  ?? 'COMPLETED';
  // Fraud interception: confirmation can park the transfer for compliance review
  const isHeld = txStatus === 'HELD_FOR_REVIEW';
  const txCategory: string | undefined = tx?.category ?? routeCategory;
  const txRecipientName: string = tx?.recipientName ?? name;
  const txCurrency: string = tx?.currency ?? 'GHS';

  const catMeta = txCategory ? CATEGORY_META[txCategory as CategoryKey] : null;

  // Timestamp: prefer completedAt from backend
  const completedAt = tx?.completedAt ? new Date(tx.completedAt) : new Date();
  const dateFormatted = Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(completedAt);
  const timeFormatted = Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(completedAt);
  const formattedDateTime = `${dateFormatted} • ${timeFormatted}`;

  // Human-readable short reference (last 8 chars of UUID)
  const txRef = transactionId
    ? transactionId.replace(/-/g, '').slice(-8).toUpperCase()
    : '—';

  const handleCopyTransactionId = async () => {
    if (!transactionId) return;
    await Clipboard.setStringAsync(transactionId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast('Transaction ID copied', 'success');
  };

  const captureReceipt = async (): Promise<string | null> => {
    if (!receiptRef.current) return null;
    try {
      return await captureRef(receiptRef, { format: 'png', quality: 1, result: 'tmpfile' });
    } catch {
      return null;
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        showToast('Gallery permission required to save the receipt', 'error');
        return;
      }
      const uri = await captureReceipt();
      if (!uri) throw new Error('Capture failed');
      await MediaLibrary.saveToLibraryAsync(uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('Receipt saved to your gallery', 'success');
    } catch {
      showToast('Could not save receipt. Please try again.', 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const uri = await captureReceipt();
      if (!uri) throw new Error('Capture failed');
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        showToast('Sharing is not available on this device', 'error');
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: `AZA Receipt — ${formatCurrency(txAmount, txCurrency)} to ${txRecipientName}`,
      });
    } catch {
      showToast('Could not share receipt. Please try again.', 'error');
    } finally {
      setIsSharing(false);
    }
  };

  const handleSendAgain = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('SendAmount', {
      identifier,
      ...(name       ? { name }                     : {}),
      ...(username   ? { username }                 : {}),
      ...(route.params.avatar ? { avatar: route.params.avatar } : {}),
    });
  };

  const handleDone = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.popToTop();
  };

  const InfoRow = ({
    label, value, rightComponent, isLast = false,
  }: {
    label: string; value?: string; rightComponent?: React.ReactNode; isLast?: boolean;
  }) => (
    <View style={[styles.infoRow, isLast && styles.infoRowLast]}>
      <Text style={styles.infoLabel}>{label}</Text>
      {rightComponent ?? <Text style={styles.infoValue}>{value}</Text>}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Capturable receipt area — everything inside this View is captured for download/share */}
        <View ref={receiptRef} collapsable={false} style={styles.captureArea}>

          {/* Success / under-review header */}
          <View style={styles.headerArea}>
            <View style={[styles.iconOuter, isHeld && styles.iconOuterHeld]}>
              <View style={[styles.iconInner, isHeld && styles.iconInnerHeld]}>
                <Feather name={isHeld ? 'shield' : 'check'} size={28} color="#FFFFFF" />
              </View>
            </View>
            <Text style={styles.title}>{isHeld ? 'Transfer Under Review' : 'Payment Sent'}</Text>
            <Text style={styles.subtitle}>
              <Text style={styles.subtitleBold}>{formatCurrency(txAmount, txCurrency)}</Text>
              {isHeld
                ? ` to ${txRecipientName} is being reviewed for your security. No money has left your wallet — we'll notify you once it's cleared.`
                : ` successfully sent to ${txRecipientName}`}
            </Text>
            <Text style={styles.dateText}>{formattedDateTime}</Text>
          </View>

          {/* Receipt card */}
          <View style={styles.receiptCard}>
            {txLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.loadingText}>Fetching receipt details…</Text>
              </View>
            ) : (
              <>
                {/* Purpose / Category — only shown when a category was set */}
                {catMeta && (
                  <InfoRow
                    label="Purpose"
                    rightComponent={
                      <View style={styles.purposeRow}>
                        <View style={[styles.purposeIcon, { backgroundColor: catMeta.color + '1A' }]}>
                          <Feather name={catMeta.icon as any} size={14} color={catMeta.color} />
                        </View>
                        <Text style={[styles.infoValue, { color: catMeta.color, flex: 0 }]}>
                          {catMeta.name}
                        </Text>
                      </View>
                    }
                  />
                )}

                <InfoRow
                  label="Recipient"
                  rightComponent={
                    <View style={{ alignItems: 'flex-end', flex: 1 }}>
                      <Text style={styles.infoValue}>{txRecipientName}</Text>
                      {username ? <Text style={styles.infoSubtext}>{username}</Text> : null}
                      {identifier && identifier !== username ? (
                        <Text style={styles.infoSubtext}>{identifier}</Text>
                      ) : null}
                    </View>
                  }
                />

                <InfoRow label="From" value="AZA Wallet" />

                <InfoRow
                  label="Amount"
                  rightComponent={
                    <Text style={styles.infoValue}>{formatCurrency(txAmount, txCurrency)}</Text>
                  }
                />

                <InfoRow
                  label="Fees"
                  rightComponent={
                    <Text style={[styles.infoValue, { color: Colors.primary }]}>Free</Text>
                  }
                />

                <InfoRow
                  label="Status"
                  rightComponent={
                    <View style={styles.statusBadge}>
                      <View style={[
                        styles.statusDot,
                        { backgroundColor: txStatus === 'COMPLETED' ? Colors.primary : '#F59E0B' },
                      ]} />
                      <Text style={styles.infoValue}>
                        {txStatus === 'COMPLETED' ? 'Completed' : txStatus}
                      </Text>
                    </View>
                  }
                />

                {txNote ? <InfoRow label="Narration" value={txNote} /> : null}

                <InfoRow
                  label="Reference"
                  isLast={!transactionId}
                  rightComponent={
                    <Text style={[styles.infoValue, styles.monoText]}>AZA-{txRef}</Text>
                  }
                />

                {transactionId ? (
                  <InfoRow
                    label="Transaction ID"
                    isLast
                    rightComponent={
                      <TouchableOpacity
                        style={styles.copyRow}
                        onPress={handleCopyTransactionId}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.infoValue, styles.monoText]} numberOfLines={1}>
                          {transactionId.slice(0, 8)}…{transactionId.slice(-4)}
                        </Text>
                        <View style={styles.copyBtn}>
                          <Feather name="copy" size={13} color={Colors.textSecondary} />
                        </View>
                      </TouchableOpacity>
                    }
                  />
                ) : null}
              </>
            )}
          </View>

          {/* Watermark visible when shared/downloaded */}
          <Text style={styles.watermark}>Generated by AZA · aza.systems</Text>
        </View>

        {/* AI Insight Card */}
        {insightData ? (
          <View style={styles.insightCard}>
            <View style={styles.insightIconWrap}>
              <Feather name="zap" size={14} color={Colors.primary} />
            </View>
            <Text style={styles.insightText}>{insightData}</Text>
          </View>
        ) : null}

        {/* Send Again quick action */}
        <TouchableOpacity
          style={styles.sendAgainBtn}
          onPress={handleSendAgain}
          activeOpacity={0.75}
        >
          <Feather name="refresh-cw" size={15} color={Colors.primary} style={{ marginRight: 6 }} />
          <Text style={styles.sendAgainText}>Send Again to {name}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Footer actions */}
      <View style={styles.footer}>
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnOutline]}
            onPress={handleDownload}
            disabled={isDownloading || isSharing}
            activeOpacity={0.75}
          >
            {isDownloading
              ? <ActivityIndicator size="small" color={Colors.textPrimary} />
              : <>
                  <Feather name="download" size={17} color={Colors.textPrimary} />
                  <Text style={[styles.actionBtnText, { color: Colors.textPrimary }]}>Download</Text>
                </>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnSolid]}
            onPress={handleShare}
            disabled={isDownloading || isSharing}
            activeOpacity={0.75}
          >
            {isSharing
              ? <ActivityIndicator size="small" color="#fff" />
              : <>
                  <Feather name="share-2" size={17} color="#fff" />
                  <Text style={[styles.actionBtnText, { color: '#fff' }]}>Share Receipt</Text>
                </>
            }
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.doneBtn} onPress={handleDone} activeOpacity={0.7}>
          <Text style={styles.doneBtnText}>Return to Dashboard</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    scrollContent: { paddingBottom: Spacing.xl },

    captureArea: {
      paddingHorizontal: Spacing.lg,
      paddingTop: 36,
      paddingBottom: Spacing.lg,
      backgroundColor: Colors.background,
    },

    // Header
    headerArea: { alignItems: 'center', marginBottom: 28 },
    iconOuter: {
      width: 84, height: 84, borderRadius: 42,
      backgroundColor: isDark ? 'rgba(16,185,129,0.15)' : '#E6F8F3',
      alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg,
    },
    iconInner: {
      width: 58, height: 58, borderRadius: 29,
      backgroundColor: Colors.primary,
      alignItems: 'center', justifyContent: 'center',
    },
    iconOuterHeld: {
      backgroundColor: isDark ? 'rgba(249,115,22,0.15)' : '#FDEEDF',
    },
    iconInnerHeld: {
      backgroundColor: '#EA7C28',
    },
    title: { ...Typography.h2, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.xs },
    subtitle: {
      ...Typography.body, color: Colors.textSecondary,
      textAlign: 'center', paddingHorizontal: Spacing.md, marginTop: 4,
    },
    subtitleBold: { fontWeight: '700', color: Colors.textPrimary },
    dateText: { ...Typography.caption, color: Colors.textSecondary, marginTop: Spacing.xs },

    // Receipt card
    receiptCard: {
      backgroundColor: isDark ? Colors.surface : '#F8FAFC',
      borderWidth: 1, borderColor: Colors.border,
      borderRadius: 16, paddingHorizontal: Spacing.lg,
    },
    loadingRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingVertical: Spacing.xl, justifyContent: 'center',
    },
    loadingText: { ...Typography.body, color: Colors.textSecondary },

    infoRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
      paddingVertical: 13,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
    },
    infoRowLast: { borderBottomWidth: 0 },
    infoLabel: { ...Typography.body, color: Colors.textSecondary, flex: 1 },
    infoValue: { ...Typography.body, color: Colors.textPrimary, fontWeight: '500', textAlign: 'right', flex: 1 },
    infoSubtext: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'right', marginTop: 2 },

    purposeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    purposeIcon: { width: 24, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },

    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    statusDot: { width: 8, height: 8, borderRadius: 4 },

    copyRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'flex-end' },
    copyBtn: {
      width: 26, height: 26, borderRadius: 6,
      backgroundColor: isDark ? Colors.border : '#F3F4F6',
      alignItems: 'center', justifyContent: 'center',
    },
    monoText: {
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
      fontSize: 13,
    },

    watermark: {
      ...Typography.caption, color: Colors.textSecondary,
      textAlign: 'center', marginTop: Spacing.md, opacity: 0.45,
    },

    // AI Insight
    insightCard: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      marginHorizontal: Spacing.lg, marginTop: Spacing.sm,
      paddingHorizontal: Spacing.md, paddingVertical: 12,
      backgroundColor: Colors.primary + '10',
      borderRadius: 12, borderWidth: 1, borderColor: Colors.primary + '25',
    },
    insightIconWrap: {
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: Colors.primary + '20',
      alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    },
    insightText: {
      ...Typography.body, color: Colors.textPrimary,
      flex: 1, lineHeight: 20, fontSize: 13,
    },

    // Send again
    sendAgainBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      marginHorizontal: Spacing.lg, marginTop: Spacing.sm,
      paddingVertical: 13,
      backgroundColor: Colors.primary + '12',
      borderRadius: 12, borderWidth: 1, borderColor: Colors.primary + '30',
    },
    sendAgainText: { ...Typography.body, fontWeight: '600', color: Colors.primary },

    // Footer
    footer: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
      paddingBottom: Platform.OS === 'ios' ? 0 : Spacing.md,
    },
    actionRow: { flexDirection: 'row', gap: 12, marginBottom: Spacing.sm },
    actionBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center',
      justifyContent: 'center', borderRadius: 12, paddingVertical: 14, gap: 8,
    },
    actionBtnOutline: {
      borderWidth: 1, borderColor: Colors.border,
      backgroundColor: isDark ? Colors.surface : Colors.white,
    },
    actionBtnSolid: {
      backgroundColor: isDark ? Colors.surface : '#111827',
    },
    actionBtnText: { ...Typography.button, fontWeight: '600' },
    doneBtn: { alignItems: 'center', paddingVertical: Spacing.md },
    doneBtnText: { ...Typography.button, fontWeight: '600', color: Colors.textSecondary },
  });
}
