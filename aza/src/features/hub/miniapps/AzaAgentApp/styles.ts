import { StyleSheet } from 'react-native';
import { ThemeColors, Spacing } from '../../../../theme';

export const createStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    scroll: {
      padding: Spacing.lg,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.lg,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: Colors.textPrimary,
      marginBottom: Spacing.sm,
    },
    subtitle: {
      fontSize: 14,
      color: Colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: Spacing.lg,
    },
    balanceCard: {
      backgroundColor: Colors.primary,
      borderRadius: 16,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
    },
    balanceLabel: {
      color: '#FFFFFFCC',
      fontSize: 13,
      marginBottom: 4,
    },
    balanceValue: {
      color: '#FFFFFF',
      fontSize: 30,
      fontWeight: '800',
    },
    card: {
      backgroundColor: Colors.surface,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.border,
      padding: Spacing.md,
      marginBottom: Spacing.md,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 6,
    },
    label: {
      fontSize: 14,
      color: Colors.textSecondary,
    },
    value: {
      fontSize: 15,
      fontWeight: '600',
      color: Colors.textPrimary,
    },
    inputLabel: {
      fontSize: 13,
      color: Colors.textSecondary,
      marginBottom: 6,
      marginTop: Spacing.md,
    },
    input: {
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: 10,
      paddingHorizontal: Spacing.md,
      paddingVertical: 12,
      fontSize: 16,
      color: Colors.textPrimary,
      backgroundColor: Colors.surface,
    },
    button: {
      backgroundColor: Colors.primary,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: Spacing.lg,
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    secondaryButton: {
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: Colors.primary,
      marginTop: Spacing.md,
    },
    secondaryButtonText: {
      color: Colors.primary,
      fontSize: 16,
      fontWeight: '700',
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: Colors.textPrimary,
      marginLeft: Spacing.sm,
    },
  });
