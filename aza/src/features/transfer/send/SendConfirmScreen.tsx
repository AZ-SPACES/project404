import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@react-native-vector-icons/feather';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme, ThemeColors, Typography, Spacing } from '../../../theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { useTransferStore } from '../../../store/transferStore';
import { BackButton } from '../../../components/ui/BackButton';

type SendConfirmScreenProps = NativeStackScreenProps<RootStackParamList, 'SendConfirm'>;

export default function SendConfirmScreen({ navigation, route }: SendConfirmScreenProps) {
  const { name, username, avatar, amount, note, identifier } = route.params;
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);

  const displayAmount = amount.toFixed(2);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const { initiateTransfer } = useTransferStore();

  const handleEditNote = () => {
    navigation.goBack();
  };

  const handleConfirmSend = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setApiError(null);
    try {
      await initiateTransfer({ recipientIdentifier: identifier, amount, note });
      // pendingTransactionId is now stored in the transfer store
      navigation.navigate('SendPin', { name, username, avatar, amount, note });
    } catch (err: any) {
      setApiError(err.message || 'Could not initiate transfer. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
      </View>

      <Text style={styles.pageTitle}>Review transfer</Text>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Warning Card */}
        <View style={styles.card}>
          <View style={styles.warningHeaderRow}>
            <Text style={styles.warningTitle}>Do you know and trust the payee?</Text>
            <View style={styles.warningIconContainer}>
              <Text style={styles.warningIconText}>!</Text>
            </View>
          </View>
          <Text style={styles.warningText}>
            If you're unsure, don't pay them, as we may not be able to help you get your money back. Remember, scammers may impersonate others, and we will never ask you to make a payment.
          </Text>
        </View>

        {/* Recipient Details Card */}
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>To</Text>
            <Text style={styles.valueBold}>{name}</Text>
          </View>
          <View style={[styles.row, styles.marginTop]}>
            <Text style={styles.label}>Tag</Text>
            <Text style={styles.valueBold}>{username}</Text>
          </View>
        </View>

        {/* Note Card */}
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Note</Text>
            <TouchableOpacity style={styles.editButton} onPress={handleEditNote} activeOpacity={0.7}>
              <Feather name="edit-2" size={14} color={Colors.primary} style={styles.editIcon} />
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.noteText}>{note || 'No note added.'}</Text>
        </View>

        {/* Amount Details Card */}
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Recipient gets</Text>
            <Text style={styles.valueBold}>GH¢ {displayAmount}</Text>
          </View>
          <View style={[styles.row, styles.marginTop]}>
            <Text style={styles.label}>Fees</Text>
            <Text style={styles.valueBold}>No fees</Text>
          </View>
          <View style={[styles.row, styles.marginTop]}>
            <Text style={styles.label}>Your total</Text>
            <Text style={styles.valueBold}>GH¢ {displayAmount}</Text>
          </View>
        </View>

        {/* API Error */}
        {apiError && (
          <View style={styles.errorCard}>
            <Feather name="alert-circle" size={16} color={Colors.error || '#EF4444'} />
            <Text style={styles.errorText}>{apiError}</Text>
          </View>
        )}

        <View style={styles.spacer} />

        {/* Send Button */}
        <TouchableOpacity
          style={[styles.sendButton, isLoading && styles.sendButtonDisabled]}
          activeOpacity={0.7}
          onPress={handleConfirmSend}
          disabled={isLoading}
          accessibilityRole="button"
          accessibilityLabel="Confirm and send"
          accessibilityState={{ disabled: isLoading }}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <Text style={styles.sendButtonText}>Send</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? Colors.background : Colors.surface,
    },
    flex: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.xl,
      flexGrow: 1,
    },
    spacer: {
      flex: 1,
      minHeight: Spacing.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: isDark ? Colors.surface : Colors.white,
      borderWidth: 1,
      borderColor: Colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pageTitle: {
      ...Typography.h2,
      fontWeight: '700',
      color: Colors.textPrimary,
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.lg,
      marginTop: Spacing.xs,
    },
    card: {
      backgroundColor: isDark ? Colors.surface : Colors.white,
      borderRadius: 12,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    marginTop: {
      marginTop: Spacing.md,
    },
    label: {
      ...Typography.body,
      color: Colors.textSecondary,
      fontSize: 14,
    },
    valueBold: {
      ...Typography.body,
      fontWeight: '600',
      color: Colors.textPrimary,
      fontSize: 14,
    },
    warningHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    warningTitle: {
      ...Typography.body,
      fontWeight: '700',
      color: Colors.textPrimary,
      flex: 1,
      paddingRight: Spacing.sm,
    },
    warningIconContainer: {
      backgroundColor: '#F59E0B',
      borderRadius: 12,
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    warningIconText: {
      color: Colors.white,
      fontWeight: '700',
      fontSize: 14,
    },
    warningText: {
      ...Typography.caption,
      color: Colors.textSecondary,
      lineHeight: 20,
    },
    editButton: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    editIcon: {
      marginRight: 4,
    },
    editButtonText: {
      ...Typography.caption,
      fontWeight: '600',
      color: Colors.primary,
    },
    noteText: {
      ...Typography.body,
      color: Colors.textPrimary,
      marginTop: Spacing.sm,
    },
    errorCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: isDark ? Colors.surface : '#FEF2F2',
      borderRadius: 8,
      padding: Spacing.md,
      marginBottom: Spacing.md,
      borderWidth: 1,
      borderColor: Colors.error || '#FCA5A5',
    },
    errorText: {
      ...Typography.caption,
      color: Colors.error || '#EF4444',
      flex: 1,
    },
    sendButton: {
      backgroundColor: Colors.primary,
      borderRadius: 10,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: Spacing.md,
    },
    sendButtonDisabled: {
      opacity: 0.6,
    },
    sendButtonText: {
      ...Typography.button,
      color: Colors.white,
    },
  });
}
