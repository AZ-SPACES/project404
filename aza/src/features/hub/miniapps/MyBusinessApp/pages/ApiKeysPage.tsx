import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, Text, TouchableOpacity, TextInput, ActivityIndicator, Alert, Clipboard, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Spacing } from '../../../../../theme';
import { NavProps } from '../types';
import { extractData, fmtDate } from '../helpers';
import { getMerchantApiKeys, createMerchantApiKey, revokeMerchantApiKey } from '../../../../../services/api';
import InternalHeader from '../components/InternalHeader';

export default function ApiKeysPage({ goBack, Colors, styles }: NavProps) {
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getMerchantApiKeys()
      .then((r: any) => setKeys(extractData(r) ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await createMerchantApiKey(newKeyName.trim() || undefined);
      const newKey = extractData(res);
      if (newKey?.rawKey) setRevealedKey(newKey.rawKey);
      setNewKeyName('');
      setShowForm(false);
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error?.message ?? 'Failed to create key.');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = (keyId: string, prefix: string) => {
    Alert.alert('Revoke Key', `Revoke key ${prefix}? This cannot be undone.`, [
      { text: 'Revoke', style: 'destructive', onPress: async () => {
        try {
          await revokeMerchantApiKey(keyId);
          load();
        } catch {
          Alert.alert('Error', 'Failed to revoke key.');
        }
      }},
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View style={{ flex: 1 }}>
      <InternalHeader title="API Keys" onBack={goBack} Colors={Colors} styles={styles} />
      {revealedKey && (
        <View style={[styles.revealBox, { backgroundColor: Colors.success + '18', borderColor: Colors.success }]}>
          <Text style={[styles.revealTitle, { color: Colors.success }]}>Copy your key — shown once only</Text>
          <Text style={[styles.revealKey, { color: Colors.textPrimary }]} selectable numberOfLines={2}>{revealedKey}</Text>
          <TouchableOpacity onPress={() => { Clipboard.setString(revealedKey); Alert.alert('Copied!'); }}>
            <Text style={{ color: Colors.success, fontWeight: '600', marginTop: 4 }}>Copy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ marginTop: 8 }} onPress={() => setRevealedKey(null)}>
            <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: Spacing.md }}>
          {keys.map((k) => (
            <View key={k.id} style={[styles.keyRow, { borderColor: Colors.border, backgroundColor: Colors.surface }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.keyName, { color: Colors.textPrimary }]}>{k.name ?? 'Unnamed Key'}</Text>
                <Text style={[styles.keyPrefix, { color: Colors.textSecondary }]}>{k.keyPrefix}</Text>
                <Text style={[styles.keyDate, { color: Colors.textSecondary }]}>Created {fmtDate(k.createdAt)}</Text>
              </View>
              <TouchableOpacity onPress={() => handleRevoke(k.id, k.keyPrefix)} accessibilityRole="button">
                <Feather name="trash-2" size={18} color={Colors.error} />
              </TouchableOpacity>
            </View>
          ))}

          {showForm ? (
            <View style={[styles.formCard, { borderColor: Colors.border, backgroundColor: Colors.surface }]}>
              <TextInput
                style={[styles.fieldInput, { color: Colors.textPrimary, borderColor: Colors.border, backgroundColor: Colors.background }]}
                placeholder="Key name (optional)"
                placeholderTextColor={Colors.textSecondary}
                value={newKeyName}
                onChangeText={setNewKeyName}
                autoFocus
              />
              <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm }}>
                <TouchableOpacity style={[styles.primaryBtn, { flex: 1 }]} onPress={handleCreate} disabled={creating}>
                  {creating ? <ActivityIndicator color={Colors.secondary} /> : <Text style={[styles.primaryBtnText, { color: Colors.secondary }]}>Create</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={[styles.secondaryBtn, { flex: 1, borderColor: Colors.border }]} onPress={() => setShowForm(false)}>
                  <Text style={[styles.secondaryBtnText, { color: Colors.textPrimary }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            keys.length < 10 && (
              <TouchableOpacity
                style={[styles.addBtn, { borderColor: Colors.primary }]}
                onPress={() => setShowForm(true)}
                accessibilityRole="button"
              >
                <Feather name="plus" size={18} color={Colors.primary} />
                <Text style={[styles.addBtnText, { color: Colors.primary }]}>Create API Key</Text>
              </TouchableOpacity>
            )
          )}
        </ScrollView>
      )}
    </View>
  );
}
