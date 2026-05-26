import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Spacing } from '../../../../../theme';
import { NavProps } from '../types';
import { extractData } from '../helpers';
import { getMerchantWebhooks, createMerchantWebhook, deleteMerchantWebhook } from '../../../../../services/api';
import InternalHeader from '../components/InternalHeader';
import FieldInput from '../components/FieldInput';

export default function WebhooksPage({ goBack, Colors, styles }: NavProps) {
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState('checkout.completed');
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getMerchantWebhooks()
      .then((r: any) => setWebhooks(extractData(r) ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!url.startsWith('https://')) {
      Alert.alert('Invalid URL', 'Webhook URL must start with https://');
      return;
    }
    setCreating(true);
    try {
      await createMerchantWebhook(url.trim(), events.trim() || 'checkout.completed');
      setUrl('');
      setEvents('checkout.completed');
      setShowForm(false);
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error?.message ?? 'Failed to create webhook.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = (id: string, endpointUrl: string) => {
    Alert.alert('Delete Webhook', `Remove endpoint ${endpointUrl}?`, [
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteMerchantWebhook(id); load(); }
        catch { Alert.alert('Error', 'Failed to delete webhook.'); }
      }},
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View style={{ flex: 1 }}>
      <InternalHeader title="Webhooks" onBack={goBack} Colors={Colors} styles={styles} />
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: Spacing.md }}>
          {webhooks.map((w) => (
            <View key={w.id} style={[styles.keyRow, { borderColor: Colors.border, backgroundColor: Colors.surface }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.keyName, { color: Colors.textPrimary }]} numberOfLines={1}>{w.url}</Text>
                <Text style={[styles.keyDate, { color: Colors.textSecondary }]}>{w.events}</Text>
              </View>
              <TouchableOpacity onPress={() => handleDelete(w.id, w.url)} accessibilityRole="button">
                <Feather name="trash-2" size={18} color={Colors.error} />
              </TouchableOpacity>
            </View>
          ))}

          {showForm ? (
            <View style={[styles.formCard, { borderColor: Colors.border, backgroundColor: Colors.surface }]}>
              <FieldInput label="Endpoint URL (https://)" value={url} onChangeText={setUrl} placeholder="https://yoursite.com/webhook" keyboardType="url" Colors={Colors} styles={styles} />
              <FieldInput label="Events (comma-separated)" value={events} onChangeText={setEvents} placeholder="checkout.completed,*" Colors={Colors} styles={styles} />
              <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                <TouchableOpacity style={[styles.primaryBtn, { flex: 1 }]} onPress={handleCreate} disabled={creating}>
                  {creating ? <ActivityIndicator color={Colors.secondary} /> : <Text style={[styles.primaryBtnText, { color: Colors.secondary }]}>Add</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={[styles.secondaryBtn, { flex: 1, borderColor: Colors.border }]} onPress={() => setShowForm(false)}>
                  <Text style={[styles.secondaryBtnText, { color: Colors.textPrimary }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            webhooks.length < 5 && (
              <TouchableOpacity style={[styles.addBtn, { borderColor: Colors.primary }]} onPress={() => setShowForm(true)}>
                <Feather name="plus" size={18} color={Colors.primary} />
                <Text style={[styles.addBtnText, { color: Colors.primary }]}>Add Endpoint</Text>
              </TouchableOpacity>
            )
          )}
        </ScrollView>
      )}
    </View>
  );
}
