import { StyleSheet, Platform } from 'react-native';
import { ThemeColors, Typography, Spacing, Radius } from '../../../../theme';

const MONO = Platform.OS === 'ios' ? 'Courier' : 'monospace';

export function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;

  // Design tokens
  const card = {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  } as const;

  const sectionLabelStyle = {
    fontSize: 10,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  };

  return StyleSheet.create({
    root: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
    pageContent: {
      padding: Spacing.lg,
      paddingBottom: Spacing.xl * 3,
    },

    // ─── Header ────────────────────────────────────────────────────────────────
    internalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.border,
      backgroundColor: Colors.background,
      gap: Spacing.sm,
    },
    backBtn: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    },
    internalHeaderTitle: {
      fontSize: 16,
      fontWeight: '700',
      flex: 1,
      color: Colors.textPrimary,
    },
    internalHeaderSubtitle: {
      fontSize: 12,
      color: Colors.textSecondary,
      marginTop: 1,
    },

    // ─── Section labels ─────────────────────────────────────────────────────────
    sectionLabel: {
      ...sectionLabelStyle,
    },

    // ─── Cards ─────────────────────────────────────────────────────────────────
    card: {
      ...card,
      padding: Spacing.md,
    },
    cardLg: {
      ...card,
      padding: Spacing.lg,
    },
    cardRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 11,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.border,
    },
    cardRowLabel: {
      fontSize: 13,
      color: Colors.textSecondary,
    },
    cardRowValue: {
      fontSize: 13,
      fontWeight: '600',
      color: Colors.textPrimary,
    },

    // ─── Stat / balance cards ───────────────────────────────────────────────────
    balanceCard: {
      ...card,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
    },
    balanceLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: Colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 6,
    },
    balanceAmount: {
      fontSize: 28,
      fontWeight: '800',
      color: Colors.textPrimary,
      fontFamily: MONO,
      marginBottom: Spacing.md,
    },
    balanceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    balanceSub: {
      fontSize: 11,
      color: Colors.textSecondary,
      marginBottom: 2,
    },
    balanceSubVal: {
      fontSize: 13,
      fontWeight: '700',
      color: Colors.textPrimary,
    },
    statGrid: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    statCard: {
      flex: 1,
      ...card,
      padding: 12,
    },
    statLabel: {
      ...sectionLabelStyle,
      marginTop: 0,
      marginBottom: 4,
    },
    statValue: {
      fontSize: 15,
      fontWeight: '800',
      color: Colors.textPrimary,
      fontFamily: MONO,
    },
    statSub: {
      fontSize: 10,
      color: Colors.textSecondary,
      marginTop: 2,
    },

    // ─── Row items (sessions, payouts, keys…) ──────────────────────────────────
    sessionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 13,
      paddingHorizontal: Spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.border,
    },
    sessionDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: Spacing.sm,
    },
    sessionAmount: {
      fontSize: 14,
      fontWeight: '700',
      color: Colors.textPrimary,
      fontFamily: MONO,
    },
    sessionDesc: {
      fontSize: 12,
      color: Colors.textSecondary,
      marginTop: 2,
    },
    sessionDate: {
      fontSize: 11,
      color: Colors.textSecondary,
      marginTop: 2,
    },
    rowContainer: {
      ...card,
      overflow: 'hidden',
      marginBottom: Spacing.md,
    },

    // ─── Form fields ────────────────────────────────────────────────────────────
    fieldGroup: {
      marginBottom: Spacing.md,
    },
    fieldLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: Colors.textSecondary,
      marginBottom: 7,
      letterSpacing: 0.2,
    },
    fieldInput: {
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 13,
      fontSize: 15,
      color: Colors.textPrimary,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
      borderColor: Colors.border,
    },
    hint: {
      fontSize: 11,
      color: Colors.textSecondary,
      marginTop: 5,
    },
    sectionNote: {
      fontSize: 13,
      color: Colors.textSecondary,
      lineHeight: 20,
      marginBottom: Spacing.lg,
    },
    sectionDivider: {
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      color: Colors.textSecondary,
      marginVertical: Spacing.md,
      paddingBottom: Spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.border,
    },

    // ─── Buttons ─────────────────────────────────────────────────────────────────
    primaryBtn: {
      backgroundColor: Colors.primary,
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: Spacing.xs,
    },
    primaryBtnText: {
      fontSize: 15,
      fontWeight: '700',
      color: Colors.secondary,
    },
    secondaryBtn: {
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: 'center',
    },
    secondaryBtnText: {
      fontSize: 15,
      fontWeight: '600',
      color: Colors.textPrimary,
    },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: Colors.border,
      borderRadius: 12,
      paddingVertical: Spacing.md,
      marginTop: Spacing.md,
    },
    addBtnText: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.textSecondary,
    },
    dangerBtn: {
      borderWidth: 1,
      borderColor: '#EF4444',
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: 'center',
    },
    dangerBtnText: {
      fontSize: 15,
      fontWeight: '600',
      color: '#EF4444',
    },

    // ─── Chips & tags ──────────────────────────────────────────────────────────
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.surface,
    },
    chipText: {
      fontSize: 12,
      fontWeight: '600',
      color: Colors.textPrimary,
    },
    chipActive: {
      backgroundColor: Colors.primary,
      borderColor: Colors.primary,
    },
    chipActiveText: {
      color: Colors.secondary,
    },

    // ─── Info/reveal boxes ──────────────────────────────────────────────────────
    infoBox: {
      ...card,
      padding: Spacing.md,
      marginVertical: Spacing.sm,
      width: '100%',
    },

    // ─── API Keys ──────────────────────────────────────────────────────────────
    keyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 13,
      paddingHorizontal: Spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.border,
    },
    keyName: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.textPrimary,
    },
    keyPrefix: {
      fontSize: 12,
      fontFamily: MONO,
      color: Colors.textSecondary,
      marginTop: 2,
    },
    keyDate: {
      fontSize: 11,
      color: Colors.textSecondary,
      marginTop: 2,
    },
    formCard: {
      ...card,
      padding: Spacing.md,
      marginTop: Spacing.md,
    },
    revealBox: {
      margin: Spacing.md,
      ...card,
      padding: Spacing.md,
    },
    revealTitle: {
      fontSize: 11,
      fontWeight: '700',
      color: Colors.textSecondary,
      marginBottom: Spacing.sm,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    revealKey: {
      fontSize: 13,
      fontFamily: MONO,
      color: Colors.textPrimary,
    },

    // ─── Payment link ──────────────────────────────────────────────────────────
    linkBox: {
      width: '100%',
      ...card,
      padding: Spacing.md,
      marginTop: Spacing.sm,
    },
    linkText: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.textPrimary,
    },

    // ─── Dashboard grid ────────────────────────────────────────────────────────
    actionGrid: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    actionCard: {
      flex: 1,
      ...card,
      padding: Spacing.md,
      alignItems: 'center',
      gap: Spacing.sm,
    },
    actionLabel: {
      fontSize: 11,
      fontWeight: '600',
      textAlign: 'center',
      color: Colors.textSecondary,
    },
    infoCard: {
      ...card,
      padding: Spacing.md,
    },
    infoCardTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: Colors.textPrimary,
      marginBottom: 2,
    },
    infoCardHandle: {
      fontSize: 13,
      color: Colors.textSecondary,
    },

    // ─── Intro / onboarding ────────────────────────────────────────────────────
    bigIcon: {
      width: 100,
      height: 100,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.lg,
    },
    introTitle: {
      fontSize: 22,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: Spacing.sm,
      color: Colors.textPrimary,
    },
    introSubtitle: {
      fontSize: 14,
      lineHeight: 22,
      textAlign: 'center',
      marginBottom: Spacing.lg,
      color: Colors.textSecondary,
    },
    featureList: {
      width: '100%',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.surface,
      padding: Spacing.md,
      gap: Spacing.md,
      marginBottom: Spacing.lg,
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
    },
    featureTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.textPrimary,
      marginBottom: 2,
    },
    featureDesc: {
      fontSize: 12,
      color: Colors.textSecondary,
      lineHeight: 18,
    },

    // ─── Dashboard bottom sheet ────────────────────────────────────────────────
    modalOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.6)',
    },
    bottomSheet: {
      backgroundColor: isDark ? '#1A1A1A' : Colors.white,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderTopWidth: 1,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: Colors.border,
      padding: Spacing.xl,
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
    },
    bottomSheetHandle: {
      width: 36,
      height: 4,
      backgroundColor: Colors.border,
      borderRadius: Radius.full,
      alignSelf: 'center',
      marginBottom: Spacing.lg,
    },
    bottomSheetTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: Colors.textPrimary,
      marginBottom: Spacing.lg,
      textAlign: 'center',
    },
    bottomSheetItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
    },
    bottomSheetIcon: {
      width: 38,
      height: 38,
      borderRadius: 10,
      backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.md,
    },
    bottomSheetItemText: {
      fontSize: 15,
      fontWeight: '500',
      color: Colors.textPrimary,
      flex: 1,
    },
    bottomSheetSectionLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: Colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 4,
      marginTop: Spacing.md,
    },
  });
}
