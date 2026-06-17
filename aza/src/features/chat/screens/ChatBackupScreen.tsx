/**
 * Chat Backup & Sync.
 *
 * Two E2EE-preserving ways to get message history onto this device, plus
 * management of the encrypted cloud backup:
 *   - "Sync from another device": device-to-device transfer; the other device
 *     must be online and approve.
 *   - Encrypted backup: sealed with a recovery code only the user holds.
 */
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert,
  ActivityIndicator, Modal, TextInput, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@react-native-vector-icons/feather';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';
import { BackButton } from '../../../components/ui/BackButton';
import Button from '../../../components/ui/Button';
import { useChatStore } from '../../../store/chatStore';
import { getChatBackupMeta, deleteChatBackup } from '../../../services/api';
import {
  requestAndApplyHistory, createChatBackup, restoreChatBackup, SyncProgress,
} from '../../../services/historySync';
import {
  generateRecoveryKey, encodeRecoveryKey, parseRecoveryKey,
} from '../../../crypto/backupCrypto';
import { getBackupKey, setBackupKey, clearBackupKey } from '../../../store/backupKeyStore';
import { formatBytes } from '../../../components/chat/chatTypes';
import { extractErrorMessage } from '../../../utils/errorUtils';

type BackupMeta = { exists: boolean; backupId?: string; chunkCount?: number; sizeBytes?: number; updatedAt?: string };

function progressLabel(p: SyncProgress | null): string {
  if (!p) return '';
  switch (p.phase) {
    case 'exporting': return 'Preparing messages…';
    case 'uploading': return `Encrypting and uploading… ${p.done}/${p.total}`;
    case 'waiting': return 'Waiting for your other device…';
    case 'downloading': return `Downloading… ${p.done}/${p.total}`;
    case 'importing': return 'Importing messages…';
  }
}

export default function ChatBackupScreen() {
  const { colors: Colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(Colors, isDark), [Colors, isDark]);
  const navigation = useNavigation();
  const selfUserId = useChatStore((s) => s.selfUserId);

  const [meta, setMeta] = useState<BackupMeta | null>(null);
  const [hasLocalKey, setHasLocalKey] = useState(false);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [busy, setBusy] = useState<'transfer' | 'backup' | 'restore' | null>(null);

  // Recovery code display (shown exactly once when a key is created)
  const [newCode, setNewCode] = useState<string | null>(null);
  // Recovery code entry (restore path)
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreCode, setRestoreCode] = useState('');

  const refreshMeta = useCallback(async () => {
    try {
      const { data } = await getChatBackupMeta();
      setMeta(data?.data ?? { exists: false });
    } catch {
      setMeta(null);
    }
    if (selfUserId) setHasLocalKey(!!(await getBackupKey(selfUserId)));
  }, [selfUserId]);

  useEffect(() => { refreshMeta(); }, [refreshMeta]);

  // ── Device-to-device sync ───────────────────────────────────────────────────

  const handleSyncFromDevice = useCallback(async () => {
    setBusy('transfer');
    setProgress({ phase: 'waiting', done: 0, total: 1 });
    try {
      const imported = await requestAndApplyHistory(setProgress);
      Alert.alert(
        'Sync complete',
        imported > 0
          ? `${imported} message${imported === 1 ? '' : 's'} synced from your other device.`
          : 'Your chats are already up to date.',
      );
    } catch (err) {
      Alert.alert('Sync failed', extractErrorMessage(err, 'Could not sync from your other device.'));
    } finally {
      setBusy(null);
      setProgress(null);
    }
  }, []);

  // ── Backup ──────────────────────────────────────────────────────────────────

  const runBackup = useCallback(async (key: Uint8Array) => {
    setBusy('backup');
    setProgress({ phase: 'exporting', done: 0, total: 1 });
    try {
      await createChatBackup(key, setProgress);
      await refreshMeta();
      Alert.alert('Backup complete', 'Your encrypted chat backup is up to date.');
    } catch (err) {
      Alert.alert('Backup failed', extractErrorMessage(err, 'Could not upload the backup.'));
    } finally {
      setBusy(null);
      setProgress(null);
    }
  }, [refreshMeta]);

  const handleBackupNow = useCallback(async () => {
    if (!selfUserId) return;
    const existing = await getBackupKey(selfUserId);
    if (existing) {
      runBackup(existing);
      return;
    }
    // First backup: mint the recovery key and make the user save the code
    // before anything uploads.
    const { key, display } = generateRecoveryKey();
    await setBackupKey(selfUserId, key);
    setHasLocalKey(true);
    setNewCode(display);
  }, [selfUserId, runBackup]);

  const handleCodeSaved = useCallback(async () => {
    if (!selfUserId) return;
    setNewCode(null);
    const key = await getBackupKey(selfUserId);
    if (key) runBackup(key);
  }, [selfUserId, runBackup]);

  const handleShowCode = useCallback(async () => {
    if (!selfUserId) return;
    const key = await getBackupKey(selfUserId);
    if (!key) {
      Alert.alert(
        'No recovery code on this device',
        'This device does not hold the backup key. You can start a fresh backup, which creates a new code.',
      );
      return;
    }
    setNewCode(encodeRecoveryKey(key));
  }, [selfUserId]);

  const handleRestore = useCallback(async () => {
    const key = parseRecoveryKey(restoreCode);
    if (!key) {
      Alert.alert('Invalid code', 'That does not look like a recovery code. Check it and try again.');
      return;
    }
    setShowRestoreModal(false);
    setRestoreCode('');
    setBusy('restore');
    setProgress({ phase: 'downloading', done: 0, total: 1 });
    try {
      const imported = await restoreChatBackup(key, setProgress);
      if (selfUserId) {
        // The typed code proved correct — keep it so future backups just work.
        await setBackupKey(selfUserId, key);
        setHasLocalKey(true);
      }
      Alert.alert(
        'Restore complete',
        imported > 0
          ? `${imported} message${imported === 1 ? '' : 's'} restored.`
          : 'Your chats already contain everything in the backup.',
      );
    } catch (err) {
      Alert.alert('Restore failed', extractErrorMessage(err, 'Could not restore the backup.'));
    } finally {
      setBusy(null);
      setProgress(null);
    }
  }, [restoreCode, selfUserId]);

  const handleDeleteBackup = useCallback(() => {
    Alert.alert(
      'Delete backup?',
      'This permanently removes the encrypted backup from AZA servers. Your messages on this device are not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteChatBackup();
              if (selfUserId) await clearBackupKey(selfUserId);
              setHasLocalKey(false);
              await refreshMeta();
            } catch (err) {
              Alert.alert('Error', extractErrorMessage(err, 'Could not delete the backup.'));
            }
          },
        },
      ],
    );
  }, [selfUserId, refreshMeta]);

  const lastBackupLabel = meta?.exists && meta.updatedAt
    ? new Date(meta.updatedAt).toLocaleString()
    : null;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Chat Backup & Sync</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Busy banner */}
        {busy && (
          <View style={styles.progressCard}>
            <ActivityIndicator color={Colors.primary} />
            <Text style={styles.progressText}>{progressLabel(progress)}</Text>
          </View>
        )}

        {/* Device-to-device sync */}
        <Text style={styles.sectionTitle}>From your other device</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.iconWrap}>
              <Feather name="smartphone" size={20} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Sync message history</Text>
              <Text style={styles.rowSubtitle}>
                Open AZA on your other device and approve the request. History is
                encrypted so only this device can read it.
              </Text>
            </View>
          </View>
          <Button
            title="Request sync"
            onPress={handleSyncFromDevice}
            disabled={!!busy}
            backgroundColor={Colors.primary}
            borderRadius={Radius.full}
            paddingVertical={12}
            fontSize={14}
            style={{ marginTop: Spacing.sm }}
            activeOpacity={0.85}
          />
        </View>

        {/* Encrypted backup */}
        <Text style={styles.sectionTitle}>Encrypted backup</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.iconWrap}>
              <Feather name="upload-cloud" size={20} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>
                {meta?.exists ? 'Backup is on' : 'No backup yet'}
              </Text>
              <Text style={styles.rowSubtitle}>
                {meta?.exists
                  ? `Last backup ${lastBackupLabel}${meta.sizeBytes ? ` · ${formatBytes(meta.sizeBytes)}` : ''}`
                  : 'Back up your chats with a recovery code only you hold. AZA cannot read your backup.'}
              </Text>
            </View>
          </View>

          <Button
            title={meta?.exists ? 'Back up now' : 'Turn on backup'}
            onPress={handleBackupNow}
            disabled={!!busy}
            backgroundColor={Colors.primary}
            borderRadius={Radius.full}
            paddingVertical={12}
            fontSize={14}
            style={{ marginTop: Spacing.sm }}
            activeOpacity={0.85}
          />

          {meta?.exists && (
            <Button
              title="Restore from backup"
              onPress={() => setShowRestoreModal(true)}
              disabled={!!busy}
              backgroundColor="transparent"
              fontSize={14}
              fontWeight="600"
              borderRadius={Radius.full}
              paddingVertical={12}
              style={{ borderWidth: 1, borderColor: Colors.primary, marginTop: Spacing.sm }}
              textStyle={{ color: Colors.primary }}
              activeOpacity={0.85}
            />
          )}

          {hasLocalKey && (
            <TouchableOpacity style={styles.linkBtn} onPress={handleShowCode} disabled={!!busy}>
              <Text style={styles.linkBtnText}>Show recovery code</Text>
            </TouchableOpacity>
          )}
          {meta?.exists && (
            <TouchableOpacity style={styles.linkBtn} onPress={handleDeleteBackup} disabled={!!busy}>
              <Text style={[styles.linkBtnText, { color: '#EF4444' }]}>Delete backup</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.footnote}>
          Messages are end-to-end encrypted. Backups and device syncs are sealed on
          this device before upload — without your recovery code or an approved
          device, no one (including AZA) can read them.
        </Text>
      </ScrollView>

      {/* Recovery code modal */}
      <Modal visible={!!newCode} transparent animationType="fade" onRequestClose={handleCodeSaved}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Feather name="key" size={28} color={Colors.primary} />
            <Text style={styles.modalTitle}>Your recovery code</Text>
            <Text style={styles.modalSubtitle}>
              Write this down somewhere safe. It is the only way to restore your
              backup — AZA cannot recover it for you.
            </Text>
            <Text style={styles.codeText} selectable>{newCode}</Text>
            <Button
              title="Share / save"
              onPress={() => { if (newCode) Share.share({ message: newCode }).catch(() => {}); }}
              backgroundColor="transparent"
              textColor={Colors.primary}
              fontSize={14}
              fontWeight="600"
              borderRadius={Radius.full}
              paddingVertical={12}
              style={{ borderWidth: 1, borderColor: Colors.primary, marginTop: Spacing.sm }}
            />
            <Button
              title="I've saved my code"
              onPress={handleCodeSaved}
              backgroundColor={Colors.primary}
              borderRadius={Radius.full}
              paddingVertical={12}
              fontSize={14}
              style={{ marginTop: Spacing.sm }}
              activeOpacity={0.85}
            />
          </View>
        </View>
      </Modal>

      {/* Restore code entry modal */}
      <Modal
        visible={showRestoreModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRestoreModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Feather name="download-cloud" size={28} color={Colors.primary} />
            <Text style={styles.modalTitle}>Enter recovery code</Text>
            <Text style={styles.modalSubtitle}>
              Type the recovery code you saved when you turned on backup.
            </Text>
            <TextInput
              style={styles.codeInput}
              value={restoreCode}
              onChangeText={setRestoreCode}
              placeholder="XXXX-XXXX-XXXX-…"
              placeholderTextColor={Colors.textSecondary}
              autoCapitalize="characters"
              autoCorrect={false}
              multiline
            />
            <Button
              title="Restore"
              onPress={handleRestore}
              backgroundColor={Colors.primary}
              borderRadius={Radius.full}
              paddingVertical={12}
              fontSize={14}
              style={{ marginTop: Spacing.sm }}
              activeOpacity={0.85}
            />
            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() => { setShowRestoreModal(false); setRestoreCode(''); }}
            >
              <Text style={styles.linkBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (Colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: Colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    headerTitle: { ...Typography.h3, color: Colors.textPrimary },
    content: { padding: Spacing.lg, paddingBottom: 48 },
    sectionTitle: {
      ...Typography.body,
      fontWeight: '700',
      color: Colors.textSecondary,
      fontSize: 13,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: Spacing.sm,
      marginTop: Spacing.lg,
    },
    card: {
      backgroundColor: isDark ? Colors.surface : Colors.white,
      borderRadius: Radius.lg,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
    },
    row: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
    iconWrap: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      alignItems: 'center', justifyContent: 'center',
    },
    rowTitle: { ...Typography.body, fontWeight: '600', color: Colors.textPrimary },
    rowSubtitle: { ...Typography.body, fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
    linkBtn: { alignItems: 'center', paddingVertical: 10 },
    linkBtnText: { ...Typography.body, fontSize: 14, color: Colors.textSecondary, fontWeight: '500' },
    progressCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      backgroundColor: isDark ? Colors.surface : Colors.white,
      borderRadius: Radius.lg,
      padding: Spacing.md,
      marginTop: Spacing.md,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
    },
    progressText: { ...Typography.body, color: Colors.textPrimary, flex: 1 },
    footnote: {
      ...Typography.body,
      fontSize: 12,
      color: Colors.textSecondary,
      marginTop: Spacing.xl,
      textAlign: 'center',
      lineHeight: 18,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.lg,
    },
    modalCard: {
      width: '100%',
      backgroundColor: isDark ? Colors.surface : Colors.white,
      borderRadius: Radius.lg,
      padding: Spacing.lg,
      alignItems: 'center',
      gap: Spacing.sm,
    },
    modalTitle: { ...Typography.h3, color: Colors.textPrimary, marginTop: Spacing.xs },
    modalSubtitle: {
      ...Typography.body, fontSize: 13, color: Colors.textSecondary,
      textAlign: 'center', lineHeight: 19,
    },
    codeText: {
      ...Typography.body,
      fontWeight: '700',
      fontSize: 16,
      color: Colors.textPrimary,
      textAlign: 'center',
      letterSpacing: 1,
      lineHeight: 26,
      marginVertical: Spacing.sm,
    },
    codeInput: {
      ...Typography.body,
      width: '100%',
      minHeight: 80,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
      borderRadius: Radius.md,
      padding: Spacing.md,
      color: Colors.textPrimary,
      textAlignVertical: 'top',
      marginVertical: Spacing.sm,
    },
  });
