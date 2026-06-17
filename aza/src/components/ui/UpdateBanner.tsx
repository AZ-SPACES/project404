import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, AppState, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import * as Updates from 'expo-updates';
import { useAppTheme, Typography, Spacing, Radius } from '../../theme';

/**
 * Lightweight "update available → reload" prompt for OTA (EAS Update) releases.
 * Checks on launch and whenever the app returns to the foreground; once a new
 * JS bundle has been downloaded it shows a bottom banner with a Reload action.
 * No-op in dev / Expo Go (where expo-updates is disabled).
 */
export function UpdateBanner() {
  const { colors: Colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { isUpdatePending } = Updates.useUpdates();
  const [dismissed, setDismissed] = useState(false);
  const [reloading, setReloading] = useState(false);

  const check = useCallback(async () => {
    if (!Updates.isEnabled || __DEV__) return;
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        await Updates.fetchUpdateAsync(); // flips isUpdatePending → true on success
      }
    } catch {
      // Offline or update service unreachable — try again next foreground.
    }
  }, []);

  useEffect(() => {
    check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => sub.remove();
  }, [check]);

  if (!isUpdatePending || dismissed) return null;

  const reload = async () => {
    setReloading(true);
    try {
      await Updates.reloadAsync();
    } catch {
      setReloading(false);
    }
  };

  return (
    <View style={[styles.wrap, { bottom: insets.bottom + Spacing.md }]} pointerEvents="box-none">
      <View style={[styles.banner, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
        <MaterialIcons name="system-update" size={22} color={Colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={[Typography.bodyLg, { color: Colors.textPrimary, fontWeight: '700' }]}>Update ready</Text>
          <Text style={[Typography.body, { color: Colors.textSecondary }]}>Restart to get the latest version.</Text>
        </View>
        <TouchableOpacity onPress={() => setDismissed(true)} hitSlop={8} style={styles.later}>
          <Text style={{ color: Colors.textSecondary, fontWeight: '600' }}>Later</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={reload}
          disabled={reloading}
          style={[styles.reloadBtn, { backgroundColor: Colors.primary }]}>
          {reloading ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <Text style={{ color: Colors.white, fontWeight: '700' }}>Reload</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: Spacing.md, right: Spacing.md },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  later: { paddingHorizontal: 8, paddingVertical: 6 },
  reloadBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radius.sm, minWidth: 84, alignItems: 'center' },
});
