import { StyleSheet, Platform } from 'react-native';
import { ThemeColors, Typography, Spacing, Radius } from '../../../../theme';

export function createStyles(Colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
    pageContent: { padding: Spacing.lg, paddingBottom: Spacing.xl * 2 },

    // Internal header
    internalHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: Spacing.lg,
    },
    backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    internalHeaderTitle: { ...Typography.body, fontWeight: '700', flex: 1, textAlign: 'center' },

    // Intro
    bigIcon: { width: 100, height: 100, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
    introTitle: { fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: Spacing.sm },
    introSubtitle: { ...Typography.body as any, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.lg },
    featureList: {
      width: '100%', borderRadius: Radius.lg, borderWidth: 1,
      padding: Spacing.md, gap: Spacing.md, marginBottom: Spacing.lg,
    },
    featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
    featureTitle: { ...Typography.body as any, fontWeight: '600', marginBottom: 2 },
    featureDesc: { ...Typography.caption as any },

    // Form
    fieldLabel: { ...Typography.caption as any, fontWeight: '600', marginBottom: 6 },
    fieldInput: {
      borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md,
      paddingVertical: 12, ...Typography.body as any,
    },
    hint: { ...Typography.caption as any, marginTop: -Spacing.sm, marginBottom: Spacing.md },
    sectionNote: { ...Typography.body as any, marginBottom: Spacing.lg },
    sectionDivider: {
      ...Typography.caption as any, fontWeight: '700', marginVertical: Spacing.md,
      paddingBottom: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth,
    },

    // Chips (picker)
    chip: { paddingHorizontal: Spacing.md, paddingVertical: 7, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
    chipText: { ...Typography.caption as any, fontWeight: '600' },

    // Buttons
    primaryBtn: {
      backgroundColor: Colors.primary, borderRadius: Radius.full,
      paddingVertical: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
    },
    primaryBtnText: { ...Typography.button as any, fontWeight: '700' },
    secondaryBtn: {
      borderWidth: 1, borderRadius: Radius.full,
      paddingVertical: 15, alignItems: 'center',
    },
    secondaryBtnText: { ...Typography.button as any, fontWeight: '600' },
    addBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: Spacing.sm, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: Radius.md,
      paddingVertical: Spacing.md, marginTop: Spacing.md,
    },
    addBtnText: { ...Typography.body as any, fontWeight: '600' },

    // Documents
    docRow: {
      flexDirection: 'row', alignItems: 'center', borderWidth: 1,
      borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm,
    },
    docLabel: { ...Typography.body as any, fontWeight: '600', marginBottom: 2 },
    docStatus: { ...Typography.caption as any },

    // Balance card
    balanceCard: {
      borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.md,
    },
    balanceLabel: { ...Typography.caption as any, fontWeight: '600', marginBottom: 4 },
    balanceAmount: { fontSize: 28, fontWeight: '700', marginBottom: Spacing.md },
    balanceRow: { flexDirection: 'row', justifyContent: 'space-between' },
    balanceSub: { ...Typography.caption as any, marginBottom: 2 },
    balanceSubVal: { ...Typography.body as any, fontWeight: '700' },

    // Dashboard grid
    sectionLabel: { ...Typography.body as any, fontWeight: '700', marginBottom: Spacing.md, marginTop: Spacing.sm },
    actionGrid: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
    actionCard: {
      flex: 1, borderWidth: 1, borderRadius: Radius.lg,
      padding: Spacing.md, alignItems: 'center', gap: Spacing.sm,
    },
    actionLabel: { ...Typography.caption as any, fontWeight: '600', textAlign: 'center' },
    infoCard: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md },
    infoCardTitle: { ...Typography.h3 as any, marginBottom: 2 },
    infoCardHandle: { ...Typography.body as any },

    // Sessions
    sessionRow: {
      flexDirection: 'row', alignItems: 'center', borderWidth: 1,
      borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm,
    },
    sessionAmount: { ...Typography.body as any, fontWeight: '700' },
    sessionDesc: { ...Typography.caption as any, marginTop: 2 },
    sessionDate: { ...Typography.caption as any, marginTop: 2 },

    // Payment link result
    linkBox: { width: '100%', borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, marginTop: Spacing.sm },
    linkText: { ...Typography.body as any, fontWeight: '600' },

    // API Keys
    keyRow: {
      flexDirection: 'row', alignItems: 'center', borderWidth: 1,
      borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm,
    },
    keyName: { ...Typography.body as any, fontWeight: '600' },
    keyPrefix: { ...Typography.caption as any, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginTop: 2 },
    keyDate: { ...Typography.caption as any, marginTop: 2 },
    formCard: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, marginTop: Spacing.md },
    revealBox: {
      margin: Spacing.md, borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md,
    },
    revealTitle: { ...Typography.caption as any, fontWeight: '700', marginBottom: Spacing.sm },
    revealKey: { ...Typography.body as any, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },

    // Info box
    infoBox: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, marginVertical: Spacing.md, width: '100%' },
  });
}
