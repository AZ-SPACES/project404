import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Image } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeColors, Typography, Spacing, Radius } from '../../theme';

// ----------------------------------------------------------------------------
// Block Contact Modal
// ----------------------------------------------------------------------------
interface BlockModalProps {
  visible: boolean;
  contactName: string;
  isDark: boolean;
  Colors: ThemeColors;
  onClose: () => void;
  onBlock: () => void;
}

export const BlockContactModal = ({ visible, contactName, isDark, Colors, onClose, onBlock }: BlockModalProps) => {
  const insets = useSafeAreaInsets();
  const styles = createStyles(Colors, isDark);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={[styles.dialog, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
          <View style={styles.dialogIconBox}>
            <Feather name="slash" size={24} color={Colors.error} />
          </View>
          <Text style={styles.dialogTitle}>Block {contactName}?</Text>
          <Text style={styles.dialogDesc}>
            Blocked contacts will no longer be able to call you or send you messages. 
            This contact will not be notified.
          </Text>
          <View style={styles.dialogActions}>
            <TouchableOpacity style={styles.btnCancel} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.btnCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnDanger} onPress={onBlock} activeOpacity={0.8}>
              <Text style={styles.btnDangerText}>Block</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ----------------------------------------------------------------------------
// Report Modal
// ----------------------------------------------------------------------------
interface ReportModalProps {
  visible: boolean;
  contactName: string;
  isDark: boolean;
  Colors: ThemeColors;
  onClose: () => void;
  onReport: (reason: string) => void;
}

const REPORT_REASONS = ['Spam', 'Inappropriate content', 'Harassment', 'Other'];

export const ReportModal = ({ visible, contactName, isDark, Colors, onClose, onReport }: ReportModalProps) => {
  const insets = useSafeAreaInsets();
  const styles = createStyles(Colors, isDark);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);

  const handleReport = () => {
    if (selectedReason) {
      onReport(selectedReason);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlayBottom}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Report {contactName}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.sheetDesc}>
            The last 5 messages from this contact will be forwarded to our team. This contact will not be notified.
          </Text>
          <ScrollView style={styles.optionsList}>
            {REPORT_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason}
                style={styles.optionRow}
                onPress={() => setSelectedReason(reason)}
                activeOpacity={0.7}
              >
                <Text style={styles.optionLabel}>{reason}</Text>
                <View style={[styles.radio, selectedReason === reason && styles.radioSelected]}>
                  {selectedReason === reason && <View style={styles.radioInner} />}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity 
            style={[styles.btnPrimary, !selectedReason && styles.btnDisabled]} 
            onPress={handleReport} 
            disabled={!selectedReason}
            activeOpacity={0.8}
          >
            <Text style={styles.btnPrimaryText}>Submit Report</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ----------------------------------------------------------------------------
// Disappearing Messages Modal
// ----------------------------------------------------------------------------
interface DisappearingModalProps {
  visible: boolean;
  currentValue: string;
  isDark: boolean;
  Colors: ThemeColors;
  onClose: () => void;
  onSelect: (val: string) => void;
}

const TIMERS = [
  { label: 'Off', value: 'Off' },
  { label: '24 hours', value: '24 hours' },
  { label: '7 days', value: '7 days' },
  { label: '90 days', value: '90 days' },
];

export const DisappearingMessagesModal = ({ visible, currentValue, isDark, Colors, onClose, onSelect }: DisappearingModalProps) => {
  const insets = useSafeAreaInsets();
  const styles = createStyles(Colors, isDark);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlayBottom}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Message Timer</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.sheetDesc}>
            Make messages in this chat disappear for everyone after a set time. Anyone can change this setting.
          </Text>
          <ScrollView style={styles.optionsList}>
            {TIMERS.map((timer) => (
              <TouchableOpacity
                key={timer.value}
                style={styles.optionRow}
                onPress={() => onSelect(timer.value)}
                activeOpacity={0.7}
              >
                <Text style={styles.optionLabel}>{timer.label}</Text>
                {currentValue === timer.value && <Feather name="check" size={20} color={Colors.primary} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// ----------------------------------------------------------------------------
// Chat Theme Modal
// ----------------------------------------------------------------------------
interface ChatThemeModalProps {
  visible: boolean;
  isDark: boolean;
  Colors: ThemeColors;
  onClose: () => void;
  onSelectTheme: (theme: string) => void;
}

const THEMES = [
  { id: 'default', color: '#111827', label: 'Default' },
  { id: 'blue', color: '#3B82F6', label: 'Ocean' },
  { id: 'green', color: '#10B981', label: 'Forest' },
  { id: 'purple', color: '#8B5CF6', label: 'Amethyst' },
  { id: 'orange', color: '#F97316', label: 'Sunset' },
  { id: 'pink', color: '#EC4899', label: 'Rose' },
];

export const ChatThemeModal = ({ visible, isDark, Colors, onClose, onSelectTheme }: ChatThemeModalProps) => {
  const insets = useSafeAreaInsets();
  const styles = createStyles(Colors, isDark);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlayBottom}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Chat Theme</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.themeList}>
            {THEMES.map((theme) => (
              <TouchableOpacity
                key={theme.id}
                style={styles.themeItem}
                onPress={() => { onSelectTheme(theme.id); onClose(); }}
                activeOpacity={0.8}
              >
                <View style={[styles.themeCircle, { backgroundColor: theme.color }]} />
                <Text style={styles.themeLabel}>{theme.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.themeItem}
              onPress={() => { onSelectTheme('custom'); onClose(); }}
              activeOpacity={0.8}
            >
              <View style={[styles.themeCircle, styles.customThemeCircle]}>
                <Feather name="image" size={24} color={Colors.textSecondary} />
              </View>
              <Text style={styles.themeLabel}>Custom</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// ----------------------------------------------------------------------------
// Shared Styles
// ----------------------------------------------------------------------------
const createStyles = (Colors: ThemeColors, isDark: boolean) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  dialog: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    width: '100%',
    alignItems: 'center',
  },
  dialogIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  dialogTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  dialogDesc: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  dialogActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  btnCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: Radius.md,
    backgroundColor: isDark ? Colors.surface : '#F3F4F6',
    alignItems: 'center',
  },
  btnCancelText: { ...Typography.button, color: Colors.textPrimary },
  btnDanger: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.error,
    alignItems: 'center',
  },
  btnDangerText: { ...Typography.button, color: Colors.white },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  sheetTitle: { ...Typography.h3, color: Colors.textPrimary },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: isDark ? Colors.surface : '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetDesc: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  optionsList: {
    maxHeight: 300,
    marginBottom: Spacing.lg,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  optionLabel: {
    ...Typography.body,
    color: Colors.textPrimary,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: Colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  btnPrimary: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: Radius.full,
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnPrimaryText: {
    ...Typography.button,
    color: Colors.white,
    fontWeight: '600',
  },
  themeList: {
    paddingVertical: Spacing.md,
    gap: Spacing.lg,
  },
  themeItem: {
    alignItems: 'center',
    marginRight: Spacing.lg,
  },
  themeCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: Spacing.sm,
  },
  customThemeCircle: {
    backgroundColor: isDark ? Colors.surface : '#F3F4F6',
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeLabel: {
    ...Typography.caption,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
});
