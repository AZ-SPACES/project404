import React, { useState } from 'react';
import { View, ScrollView, Text, TouchableOpacity, ActivityIndicator, Alert, Clipboard, Platform } from 'react-native';
import { Feather } from '@react-native-vector-icons/feather';
import { Spacing, Radius } from '../../../../../theme';
import { NavProps } from '../types';
import { extractData, fmtDate } from '../helpers';
import {
  getMerchantWebhooks,
  createMerchantWebhook,
  updateMerchantWebhook,
  deleteMerchantWebhook,
  getMerchantWebhookDeliveries
} from '../../../../../services/api';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../../../lib/queryKeys';
import { queryClient } from '../../../../../lib/queryClient';
import InternalHeader from '../components/InternalHeader';
import FieldInput from '../components/FieldInput';
import Button from '../../../../../components/ui/Button';
import { extractErrorMessage } from '../../../../../utils/errorUtils';

const ALL_EVENTS = [
  'checkout.completed',
  'checkout.expired',
  '*',
];

export default function WebhooksPage({ goBack, Colors, styles }: NavProps) {
  const { data: webhooks = [], isLoading: loading } = useQuery({
    queryKey: queryKeys.merchantWebhooks(),
    queryFn: async () => { const r = await getMerchantWebhooks(); return extractData(r) ?? []; },
    staleTime: 60_000,
  });
  const invalidateWebhooks = () => queryClient.invalidateQueries({ queryKey: queryKeys.merchantWebhooks() });

  // Creation form states
  const [showForm, setShowForm] = useState(false);
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['checkout.completed']);
  const [creating, setCreating] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Editing states
  const [editingWebhookId, setEditingWebhookId] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState('');
  const [editEvents, setEditEvents] = useState<string[]>([]);
  const [updating, setUpdating] = useState(false);

  // Delivery log expansion states
  const [expandedWebhookId, setExpandedWebhookId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);


  const handleCreate = async () => {
    if (!url.startsWith('https://')) {
      Alert.alert('Invalid URL', 'Webhook URL must start with https://');
      return;
    }
    if (selectedEvents.length === 0) {
      Alert.alert('Error', 'Select at least one event');
      return;
    }
    setCreating(true);
    try {
      const res = await createMerchantWebhook(url.trim(), selectedEvents.join(','));
      const data = extractData(res);
      if (data?.signingSecret) {
        setRevealedSecret(data.signingSecret);
        setCopiedSecret(false);
      }
      setUrl('');
      setSelectedEvents(['checkout.completed']);
      setShowForm(false);
      invalidateWebhooks();
    } catch (e: unknown) {
      Alert.alert('Error', extractErrorMessage(e, 'Failed to create webhook.'));
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (w: any) => {
    try {
      await updateMerchantWebhook(w.id, { isActive: !w.isActive });
      invalidateWebhooks();
    } catch (e: unknown) {
      Alert.alert('Error', extractErrorMessage(e, 'Failed to update status.'));
    }
  };

  const handleSaveEdit = async (id: string) => {
    if (!editUrl.startsWith('https://')) {
      Alert.alert('Invalid URL', 'Webhook URL must start with https://');
      return;
    }
    if (editEvents.length === 0) {
      Alert.alert('Error', 'Select at least one event');
      return;
    }
    setUpdating(true);
    try {
      await updateMerchantWebhook(id, {
        url: editUrl.trim(),
        events: editEvents.join(','),
      });
      setEditingWebhookId(null);
      invalidateWebhooks();
    } catch (e: unknown) {
      Alert.alert('Error', extractErrorMessage(e, 'Failed to update webhook.'));
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = (id: string, endpointUrl: string) => {
    Alert.alert('Delete Webhook', `Remove endpoint ${endpointUrl}?`, [
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteMerchantWebhook(id); invalidateWebhooks(); }
        catch { Alert.alert('Error', 'Failed to delete webhook.'); }
      }},
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleToggleExpand = (id: string) => {
    if (expandedWebhookId === id) {
      setExpandedWebhookId(null);
      setDeliveries([]);
    } else {
      setExpandedWebhookId(id);
      refreshDeliveries(id);
    }
  };

  const refreshDeliveries = (id: string) => {
    setDeliveriesLoading(true);
    getMerchantWebhookDeliveries(id)
      .then((r: any) => setDeliveries(extractData(r) ?? []))
      .catch(() => {})
      .finally(() => setDeliveriesLoading(false));
  };

  const toggleEventCreate = (ev: string) => {
    setSelectedEvents(prev => prev.includes(ev) ? prev.filter(x => x !== ev) : [...prev, ev]);
  };

  const toggleEventEdit = (ev: string) => {
    setEditEvents(prev => prev.includes(ev) ? prev.filter(x => x !== ev) : [...prev, ev]);
  };

  return (
    <View style={{ flex: 1 }}>
      <InternalHeader title="Webhooks" onBack={goBack} Colors={Colors} styles={styles} />
      
      {revealedSecret && (
        <View style={[styles.revealBox, {
          backgroundColor: Colors.success + '10',
          borderColor: Colors.success,
          borderWidth: 1,
          borderLeftWidth: 4,
          margin: Spacing.md,
          padding: Spacing.md,
          borderRadius: 6,
        }]}>
          <Text style={[styles.revealTitle, { color: Colors.success, fontWeight: '700' }]}>Copy your signing secret — shown once only</Text>
          <Text style={[styles.revealKey, { color: Colors.textPrimary, fontSize: 13 }]} selectable>{revealedSecret}</Text>
          <View style={{ flexDirection: 'row', gap: Spacing.md, marginTop: 8 }}>
            <TouchableOpacity 
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              onPress={() => {
                Clipboard.setString(revealedSecret);
                setCopiedSecret(true);
                setTimeout(() => setCopiedSecret(false), 2000);
              }}
            >
              <Feather name={copiedSecret ? "check" : "copy"} size={14} color={Colors.success} />
              <Text style={{ color: Colors.success, fontWeight: '600', fontSize: 13 }}>{copiedSecret ? 'Copied!' : 'Copy'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setRevealedSecret(null); setCopiedSecret(false); }}>
              <Text style={{ color: Colors.textSecondary, fontSize: 13 }}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: Spacing.md }}>
          
          {/* Active endpoints count indicator */}
          <View style={[styles.infoCard, { borderColor: Colors.border, backgroundColor: Colors.surface, padding: 12, marginBottom: Spacing.md }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.textPrimary }}>Endpoints Configured</Text>
              <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, backgroundColor: Colors.border + '60' }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.textPrimary }}>{webhooks.length} / 5</Text>
              </View>
            </View>
            <Text style={{ fontSize: 12, color: Colors.textSecondary, lineHeight: 16 }}>
              Verify signatures using the X-Aza-Signature header on your server.
            </Text>
          </View>

          {webhooks.map((w: any) => {
            const isEditing = editingWebhookId === w.id;

            if (isEditing) {
              return (
                <View key={w.id} style={[styles.formCard, { borderColor: Colors.border, backgroundColor: Colors.surface, marginVertical: Spacing.sm }]}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.sm }}>Edit Webhook Endpoint</Text>
                  
                  <FieldInput 
                    label="Endpoint URL (https://)" 
                    value={editUrl} 
                    onChangeText={setEditUrl} 
                    placeholder="https://yoursite.com/webhook" 
                    keyboardType="url" 
                    Colors={Colors} 
                    styles={styles} 
                  />

                  <View style={{ marginBottom: Spacing.md }}>
                    <Text style={[styles.fieldLabel, { color: Colors.textSecondary }]}>Events to listen for</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.xs }}>
                      {ALL_EVENTS.map((ev) => {
                        const isSelected = editEvents.includes(ev);
                        return (
                          <TouchableOpacity
                            key={ev}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 6,
                              paddingVertical: 8,
                              paddingHorizontal: 12,
                              borderWidth: 1,
                              borderRadius: 6,
                              borderColor: isSelected ? Colors.primary : Colors.border,
                              backgroundColor: isSelected ? Colors.primary + '10' : Colors.surface,
                            }}
                            onPress={() => toggleEventEdit(ev)}
                          >
                            <Feather name={isSelected ? "check-square" : "square"} size={14} color={isSelected ? Colors.primary : Colors.textSecondary} />
                            <Text style={{ fontSize: 12, fontWeight: '500', color: isSelected ? Colors.primary : Colors.textPrimary, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>{ev}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs }}>
                    <Button
                      title="Save"
                      onPress={() => handleSaveEdit(w.id)}
                      loading={updating}
                      backgroundColor={Colors.primary}
                      textColor={Colors.secondary}
                      borderRadius={8}
                      paddingVertical={15}
                      width="auto"
                      style={{ flex: 1 }}
                    />
                    <Button
                      title="Cancel"
                      onPress={() => setEditingWebhookId(null)}
                      backgroundColor="transparent"
                      textColor={Colors.textPrimary}
                      fontWeight="600"
                      borderRadius={8}
                      paddingVertical={15}
                      width="auto"
                      style={{ flex: 1, borderWidth: 1, borderColor: Colors.border }}
                    />
                  </View>
                </View>
              );
            }

            return (
              <View key={w.id} style={[styles.keyRow, { 
                borderColor: Colors.border, 
                backgroundColor: Colors.surface,
                flexDirection: 'column',
                alignItems: 'stretch',
                padding: Spacing.md,
                opacity: w.isActive ? 1 : 0.65
              }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, marginRight: Spacing.sm }}>
                    <Text style={[styles.keyName, { color: Colors.textPrimary }]} numberOfLines={1}>{w.url}</Text>
                    
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: 6, flexWrap: 'wrap' }}>
                      <View style={{
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 4,
                        borderWidth: 1,
                        borderColor: w.isActive ? Colors.success : Colors.border,
                        backgroundColor: w.isActive ? Colors.success + '10' : Colors.background,
                      }}>
                        <Text style={{ fontSize: 9, fontWeight: '700', color: w.isActive ? Colors.success : Colors.textSecondary }}>
                          {w.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </Text>
                      </View>

                      {w.events && w.events.split(',').map((e: string) => (
                        <View key={e} style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: Colors.border + '60' }}>
                          <Text style={{ fontSize: 9, color: Colors.textSecondary, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>{e.trim()}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    <TouchableOpacity 
                      style={{ paddingVertical: 4, paddingHorizontal: 8, borderWidth: 1, borderColor: Colors.border, borderRadius: 6, backgroundColor: Colors.surface }}
                      onPress={() => {
                        setEditingWebhookId(w.id);
                        setEditUrl(w.url);
                        setEditEvents(w.events ? w.events.split(',') : ['checkout.completed']);
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '600', color: Colors.textPrimary }}>Edit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => handleToggleActive(w)} style={{ padding: 4 }}>
                      <Feather name={w.isActive ? "toggle-right" : "toggle-left"} size={22} color={w.isActive ? Colors.success : Colors.textSecondary} />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => handleDelete(w.id, w.url)} accessibilityRole="button" style={{ padding: 6 }}>
                      <Feather name="trash-2" size={16} color={Colors.error} />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => handleToggleExpand(w.id)} style={{ padding: 4 }}>
                      <Feather name={expandedWebhookId === w.id ? "chevron-up" : "chevron-down"} size={18} color={Colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>

                {expandedWebhookId === w.id && (
                  <View style={{ marginTop: Spacing.sm, borderTopWidth: 0.5, borderTopColor: Colors.border + '40', paddingTop: Spacing.sm }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase' }}>Recent Deliveries</Text>
                      <TouchableOpacity onPress={() => refreshDeliveries(w.id)} disabled={deliveriesLoading} style={{ padding: 4 }}>
                        <Feather name="refresh-cw" size={12} color={Colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                    
                    {deliveriesLoading ? (
                      <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: Spacing.sm }} />
                    ) : deliveries.length === 0 ? (
                      <Text style={{ fontSize: 12, color: Colors.textSecondary, fontStyle: 'italic', marginVertical: 4 }}>No deliveries recorded yet</Text>
                    ) : (
                      deliveries.map((d) => {
                        const isSuccess = d.status === 'SUCCESS';
                        const isPending = d.status === 'PENDING';
                        return (
                          <View key={d.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: Colors.border + '20' }}>
                            <Feather
                              name={isSuccess ? "check-circle" : (isPending ? "clock" : "alert-circle")}
                              size={13}
                              color={isSuccess ? Colors.success : (isPending ? Colors.warning : Colors.error)}
                              style={{ marginRight: 6 }}
                            />
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 12, color: Colors.textPrimary, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }} numberOfLines={1}>
                                {d.eventType}
                              </Text>
                              <Text style={{ fontSize: 10, color: Colors.textSecondary, marginTop: 2 }}>
                                {fmtDate(d.createdAt)} · Attempt #{d.attemptNumber}
                              </Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                              <Text style={{ fontSize: 11, color: isSuccess ? Colors.success : Colors.error, fontWeight: '600' }}>
                                {d.httpStatus ? `HTTP ${d.httpStatus}` : 'Error'}
                              </Text>
                            </View>
                          </View>
                        );
                      })
                    )}
                  </View>
                )}
              </View>
            );
          })}

          {showForm ? (
            <View style={[styles.formCard, { borderColor: Colors.border, backgroundColor: Colors.surface }]}>
              <FieldInput 
                label="Endpoint URL (https://)" 
                value={url} 
                onChangeText={setUrl} 
                placeholder="https://yoursite.com/webhook" 
                keyboardType="url" 
                Colors={Colors} 
                styles={styles} 
              />

              <View style={{ marginBottom: Spacing.md }}>
                <Text style={[styles.fieldLabel, { color: Colors.textSecondary }]}>Events to listen for</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.xs }}>
                  {ALL_EVENTS.map((ev) => {
                    const isSelected = selectedEvents.includes(ev);
                    return (
                      <TouchableOpacity
                        key={ev}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          paddingVertical: 8,
                          paddingHorizontal: 12,
                          borderWidth: 1,
                          borderRadius: 6,
                          borderColor: isSelected ? Colors.primary : Colors.border,
                          backgroundColor: isSelected ? Colors.primary + '10' : Colors.surface,
                        }}
                        onPress={() => toggleEventCreate(ev)}
                      >
                        <Feather name={isSelected ? "check-square" : "square"} size={14} color={isSelected ? Colors.primary : Colors.textSecondary} />
                        <Text style={{ fontSize: 12, fontWeight: '500', color: isSelected ? Colors.primary : Colors.textPrimary, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>{ev}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                <Button
                  title="Add"
                  onPress={handleCreate}
                  loading={creating}
                  backgroundColor={Colors.primary}
                  textColor={Colors.secondary}
                  borderRadius={Radius.full}
                  paddingVertical={15}
                  width="auto"
                  style={{ flex: 1 }}
                />
                <Button
                  title="Cancel"
                  onPress={() => setShowForm(false)}
                  backgroundColor="transparent"
                  textColor={Colors.textPrimary}
                  fontWeight="600"
                  borderRadius={Radius.full}
                  paddingVertical={15}
                  width="auto"
                  style={{ flex: 1, borderWidth: 1, borderColor: Colors.border }}
                />
              </View>
            </View>
          ) : (
            webhooks.length < 5 && (
              <Button
                title="Add Endpoint"
                onPress={() => setShowForm(true)}
                leftIcon={<Feather name="plus" size={18} color={Colors.primary} />}
                backgroundColor="transparent"
                textColor={Colors.primary}
                fontSize={14}
                fontWeight="600"
                borderRadius={Radius.md}
                paddingVertical={Spacing.md}
                style={{ borderWidth: 1.5, borderStyle: 'dashed', borderColor: Colors.primary, marginTop: Spacing.md }}
              />
            )
          )}
        </ScrollView>
      )}
    </View>
  );
}
