import React, { useState, useCallback } from 'react';
import { View, ScrollView, Text, TouchableOpacity, TextInput, ActivityIndicator, Alert, Clipboard, Platform } from 'react-native';
import { Feather } from '@react-native-vector-icons/feather';
import { Spacing } from '../../../../../theme';
import { NavProps } from '../types';
import { extractData, fmtDate } from '../helpers';
import {
  getMerchantApiKeys,
  createMerchantApiKey,
  revokeMerchantApiKey,
  updateMerchantApiKey,
  rollMerchantApiKey,
  getMerchantApiLogs
} from '../../../../../services/api';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../../../lib/queryKeys';
import { queryClient } from '../../../../../lib/queryClient';
import InternalHeader from '../components/InternalHeader';

export default function ApiKeysPage({ goBack, Colors, styles }: NavProps) {
  // Main view states
  const { data: keys = [], isLoading: loading } = useQuery({
    queryKey: queryKeys.merchantApiKeys(),
    queryFn: async () => { const r = await getMerchantApiKeys(); return extractData(r) ?? []; },
    staleTime: 60_000,
  });
  const invalidateKeys = () => queryClient.invalidateQueries({ queryKey: queryKeys.merchantApiKeys() });
  const [activeSubTab, setActiveSubTab] = useState<'KEYS' | 'LOGS'>('KEYS');
  const [activeTab, setActiveTab] = useState<'LIVE' | 'TEST'>('LIVE');

  // New key form states
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyEnv, setNewKeyEnv] = useState<'LIVE' | 'TEST'>('LIVE');
  const [newKeyType, setNewKeyType] = useState<'SECRET' | 'RESTRICTED'>('SECRET');
  const [newKeyScopes, setNewKeyScopes] = useState<Record<string, boolean>>({
    'sessions:read': false,
    'sessions:write': false,
  });
  const [newKeyIpWhitelist, setNewKeyIpWhitelist] = useState('');
  const [newKeyExpirationDays, setNewKeyExpirationDays] = useState<number | null>(null);

  // Secure reveal state
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  // Inline editing states
  const [editingKeyId, setEditingKeyId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [editKeyName, setEditKeyName] = useState('');
  const [editKeyIpWhitelist, setEditKeyIpWhitelist] = useState('');
  const [editKeyScopes, setEditKeyScopes] = useState<Record<string, boolean>>({
    'sessions:read': false,
    'sessions:write': false,
  });

  // Rollover states
  const [rollingKeyId, setRollingKeyId] = useState<string | null>(null);
  const [rolling, setRolling] = useState(false);
  const [rollGraceHours, setRollGraceHours] = useState(24);

  // Request logs states
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsPage, setLogsPage] = useState(0);
  const [hasMoreLogs, setHasMoreLogs] = useState(false);


  const loadLogs = (page = 0) => {
    setLogsLoading(true);
    getMerchantApiLogs(page, 20)
      .then((r: any) => {
        const data = extractData(r);
        const content = data?.content ?? data ?? [];
        if (page === 0) {
          setLogs(content);
        } else {
          setLogs((prev) => [...prev, ...content]);
        }
        setLogsPage(page);
        setHasMoreLogs(content.length === 20);
      })
      .catch(() => {})
      .finally(() => setLogsLoading(false));
  };

  const handleShowForm = () => {
    setNewKeyEnv(activeTab);
    setNewKeyType('SECRET');
    setNewKeyScopes({ 'sessions:read': false, 'sessions:write': false });
    setNewKeyIpWhitelist('');
    setNewKeyExpirationDays(null);
    setShowForm(true);
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const payload: any = {
        environment: newKeyEnv,
        type: newKeyType,
      };
      if (newKeyName.trim()) {
        payload.label = newKeyName.trim();
      }
      if (newKeyType === 'RESTRICTED') {
        const selectedScopes = Object.keys(newKeyScopes).filter((s) => newKeyScopes[s]);
        if (selectedScopes.length > 0) {
          payload.scopes = selectedScopes.join(',');
        }
      }
      if (newKeyIpWhitelist.trim()) {
        payload.ipWhitelist = newKeyIpWhitelist.trim();
      }
      if (newKeyExpirationDays !== null) {
        payload.expirationDays = newKeyExpirationDays;
      }

      const res = await createMerchantApiKey(payload);
      const newKey = extractData(res);
      if (newKey?.fullKey) setRevealedKey(newKey.fullKey);
      setNewKeyName('');
      setNewKeyIpWhitelist('');
      setNewKeyExpirationDays(null);
      setNewKeyScopes({ 'sessions:read': false, 'sessions:write': false });
      setShowForm(false);
      invalidateKeys();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error?.message ?? 'Failed to create key.');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateKey = async (keyId: string) => {
    setUpdating(true);
    try {
      const selected = Object.keys(editKeyScopes).filter((s) => editKeyScopes[s]);
      const payload: any = {
        ipWhitelist: editKeyIpWhitelist.trim(),
        scopes: selected.join(','),
      };
      if (editKeyName.trim()) {
        payload.label = editKeyName.trim();
      }
      await updateMerchantApiKey(keyId, payload);
      setEditingKeyId(null);
      invalidateKeys();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error?.message ?? 'Failed to update key.');
    } finally {
      setUpdating(false);
    }
  };

  const handleRollKey = async (keyId: string) => {
    setRolling(true);
    try {
      const res = await rollMerchantApiKey(keyId, rollGraceHours);
      const data = extractData(res);
      if (data?.fullKey) {
        setRevealedKey(data.fullKey);
      }
      setRollingKeyId(null);
      invalidateKeys();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error?.message ?? 'Failed to roll key.');
    } finally {
      setRolling(false);
    }
  };

  const handleRevoke = (keyId: string, prefix: string) => {
    Alert.alert('Revoke Key', `Revoke key ${prefix}? This cannot be undone.`, [
      { text: 'Revoke', style: 'destructive', onPress: async () => {
        try {
          await revokeMerchantApiKey(keyId);
          invalidateKeys();
        } catch {
          Alert.alert('Error', 'Failed to revoke key.');
        }
      }},
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleDelete = (keyId: string, prefix: string) => {
    Alert.alert('Delete Key', `Permanently delete revoked key ${prefix}? This action cannot be undone.`, [
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await revokeMerchantApiKey(keyId);
          invalidateKeys();
        } catch {
          Alert.alert('Error', 'Failed to delete key.');
        }
      }},
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const filteredKeys = keys.filter((k) => k.environment === activeTab);
  const activeKeysCount = keys.filter((k) => k.isActive !== false).length;

  return (
    <View style={{ flex: 1 }}>
      <InternalHeader title="Developer Portal" onBack={goBack} Colors={Colors} styles={styles} />

      {/* Top Level Sub-tabs */}
      <View style={{
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        backgroundColor: Colors.surface,
      }}>
        <TouchableOpacity
          style={{
            flex: 1,
            paddingVertical: 14,
            alignItems: 'center',
            borderBottomWidth: activeSubTab === 'KEYS' ? 3 : 0,
            borderBottomColor: Colors.primary,
          }}
          onPress={() => setActiveSubTab('KEYS')}
        >
          <Text style={{
            fontSize: 14,
            fontWeight: activeSubTab === 'KEYS' ? '700' : '500',
            color: activeSubTab === 'KEYS' ? Colors.textPrimary : Colors.textSecondary,
          }}>API Keys</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{
            flex: 1,
            paddingVertical: 14,
            alignItems: 'center',
            borderBottomWidth: activeSubTab === 'LOGS' ? 3 : 0,
            borderBottomColor: Colors.primary,
          }}
          onPress={() => {
            setActiveSubTab('LOGS');
            loadLogs(0);
          }}
        >
          <Text style={{
            fontSize: 14,
            fontWeight: activeSubTab === 'LOGS' ? '700' : '500',
            color: activeSubTab === 'LOGS' ? Colors.textPrimary : Colors.textSecondary,
          }}>Request Logs</Text>
        </TouchableOpacity>
      </View>

      {activeSubTab === 'KEYS' ? (
        <View style={{ flex: 1 }}>
          {/* Environment Tabs */}
          <View style={{
            flexDirection: 'row',
            borderBottomWidth: 1,
            borderBottomColor: Colors.border,
            marginHorizontal: Spacing.md,
            marginTop: Spacing.sm,
            marginBottom: Spacing.xs,
          }}>
            <TouchableOpacity
              style={{
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderBottomWidth: activeTab === 'LIVE' ? 2 : 0,
                borderBottomColor: Colors.primary,
              }}
              onPress={() => setActiveTab('LIVE')}
            >
              <Text style={{
                fontSize: 14,
                fontWeight: activeTab === 'LIVE' ? '600' : '400',
                color: activeTab === 'LIVE' ? Colors.textPrimary : Colors.textSecondary,
              }}>Live Keys</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderBottomWidth: activeTab === 'TEST' ? 2 : 0,
                borderBottomColor: Colors.primary,
              }}
              onPress={() => setActiveTab('TEST')}
            >
              <Text style={{
                fontSize: 14,
                fontWeight: activeTab === 'TEST' ? '600' : '400',
                color: activeTab === 'TEST' ? Colors.textPrimary : Colors.textSecondary,
              }}>Test Keys</Text>
            </TouchableOpacity>
          </View>

          {revealedKey && (
            <View style={[styles.revealBox, { backgroundColor: Colors.success + '18', borderColor: Colors.success, margin: Spacing.md }]}>
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
              {filteredKeys.length === 0 ? (
                <View style={{ padding: Spacing.lg, alignItems: 'center', justifyContent: 'center', marginVertical: Spacing.xl }}>
                  <Text style={{ color: Colors.textSecondary, fontSize: 14, textAlign: 'center' }}>
                    No {activeTab.toLowerCase()} API keys found.
                  </Text>
                </View>
              ) : (
                filteredKeys.map((k) => {
                  const isKeyActive = k.isActive !== false;

                  // Render inline edit form
                  if (editingKeyId === k.id) {
                    return (
                      <View key={k.id} style={[styles.formCard, { borderColor: Colors.border, backgroundColor: Colors.surface, marginVertical: Spacing.sm }]}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.sm }}>Edit API Key</Text>
                        
                        <View style={{ marginBottom: Spacing.md }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 }}>Key Name</Text>
                          <TextInput
                            style={[styles.fieldInput, { color: Colors.textPrimary, borderColor: Colors.border, backgroundColor: Colors.background }]}
                            value={editKeyName}
                            onChangeText={setEditKeyName}
                          />
                        </View>

                        <View style={{ marginBottom: Spacing.md }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 }}>IP Whitelist (comma-separated)</Text>
                          <TextInput
                            style={[styles.fieldInput, { color: Colors.textPrimary, borderColor: Colors.border, backgroundColor: Colors.background }]}
                            placeholder="e.g. 192.168.1.1, 10.0.0.0/24"
                            placeholderTextColor={Colors.textSecondary}
                            value={editKeyIpWhitelist}
                            onChangeText={setEditKeyIpWhitelist}
                          />
                        </View>

                        {k.keyType === 'RESTRICTED' && (
                          <View style={{ marginBottom: Spacing.md }}>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 }}>Permissions</Text>
                            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                              <TouchableOpacity
                                style={{
                                  flex: 1,
                                  paddingVertical: 8,
                                  alignItems: 'center',
                                  borderWidth: 1,
                                  borderRadius: 8,
                                  borderColor: editKeyScopes['sessions:read'] ? Colors.primary : Colors.border,
                                  backgroundColor: editKeyScopes['sessions:read'] ? Colors.primary + '10' : Colors.surface,
                                }}
                                onPress={() => setEditKeyScopes(prev => ({ ...prev, 'sessions:read': !prev['sessions:read'] }))}
                              >
                                <Text style={{ fontSize: 13, color: editKeyScopes['sessions:read'] ? Colors.primary : Colors.textPrimary }}>Read Sessions</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={{
                                  flex: 1,
                                  paddingVertical: 8,
                                  alignItems: 'center',
                                  borderWidth: 1,
                                  borderRadius: 8,
                                  borderColor: editKeyScopes['sessions:write'] ? Colors.primary : Colors.border,
                                  backgroundColor: editKeyScopes['sessions:write'] ? Colors.primary + '10' : Colors.surface,
                                }}
                                onPress={() => setEditKeyScopes(prev => ({ ...prev, 'sessions:write': !prev['sessions:write'] }))}
                              >
                                <Text style={{ fontSize: 13, color: editKeyScopes['sessions:write'] ? Colors.primary : Colors.textPrimary }}>Write Sessions</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}

                        <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs }}>
                          <TouchableOpacity style={[styles.primaryBtn, { flex: 1, borderRadius: 8 }]} onPress={() => handleUpdateKey(k.id)} disabled={updating}>
                            {updating ? <ActivityIndicator color={Colors.secondary} /> : <Text style={[styles.primaryBtnText, { color: Colors.secondary }]}>Save</Text>}
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.secondaryBtn, { flex: 1, borderColor: Colors.border, borderRadius: 8 }]} onPress={() => setEditingKeyId(null)}>
                            <Text style={[styles.secondaryBtnText, { color: Colors.textPrimary }]}>Cancel</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  }

                  // Render inline roll form
                  if (rollingKeyId === k.id) {
                    return (
                      <View key={k.id} style={[styles.formCard, { borderColor: Colors.border, backgroundColor: Colors.surface, marginVertical: Spacing.sm }]}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.sm }}>Rotate / Roll API Key</Text>
                        <Text style={{ fontSize: 12, color: Colors.textSecondary, marginBottom: Spacing.md, lineHeight: 18 }}>
                          This deactivates the current key prefix and generates a new one. The old key remains usable for a customizable grace period.
                        </Text>
                        
                        <View style={{ marginBottom: Spacing.md }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 }}>Rollover Grace Period (Hours)</Text>
                          <TextInput
                            style={[styles.fieldInput, { color: Colors.textPrimary, borderColor: Colors.border, backgroundColor: Colors.background }]}
                            value={String(rollGraceHours)}
                            onChangeText={(txt) => setRollGraceHours(Number(txt.replace(/[^0-9]/g, '')) || 24)}
                            keyboardType="number-pad"
                          />
                        </View>

                        <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs }}>
                          <TouchableOpacity style={[styles.primaryBtn, { flex: 1, borderRadius: 8 }]} onPress={() => handleRollKey(k.id)} disabled={rolling}>
                            {rolling ? <ActivityIndicator color={Colors.secondary} /> : <Text style={[styles.primaryBtnText, { color: Colors.secondary }]}>Confirm Rollover</Text>}
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.secondaryBtn, { flex: 1, borderColor: Colors.border, borderRadius: 8 }]} onPress={() => setRollingKeyId(null)}>
                            <Text style={[styles.secondaryBtnText, { color: Colors.textPrimary }]}>Cancel</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  }

                  // Render normal key row
                  return (
                    <View key={k.id} style={[styles.keyRow, {
                      borderColor: Colors.border,
                      backgroundColor: Colors.surface,
                      opacity: isKeyActive ? 1 : 0.65,
                      flexDirection: 'column',
                      alignItems: 'stretch',
                      padding: Spacing.md,
                    }]}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1, marginRight: Spacing.sm }}>
                          <Text style={[styles.keyName, { color: Colors.textPrimary, textDecorationLine: isKeyActive ? 'none' : 'line-through' }]}>
                            {k.label ?? 'Unnamed Key'}
                          </Text>
                          <Text style={[styles.keyPrefix, { color: Colors.textSecondary, fontSize: 12 }]}>{k.keyPrefix}</Text>
                        </View>
                        {isKeyActive ? (
                          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                            <TouchableOpacity
                              style={{ paddingVertical: 4, paddingHorizontal: 8, borderWidth: 1, borderColor: Colors.border, borderRadius: 6, backgroundColor: Colors.surface }}
                              onPress={() => {
                                setEditingKeyId(k.id);
                                setEditKeyName(k.label ?? '');
                                setEditKeyIpWhitelist(k.ipWhitelist ?? '');
                                const scopeMap: Record<string, boolean> = { 'sessions:read': false, 'sessions:write': false };
                                if (k.scopes) {
                                  k.scopes.split(',').forEach((s: string) => { scopeMap[s.trim()] = true; });
                                }
                                setEditKeyScopes(scopeMap);
                              }}
                            >
                              <Text style={{ fontSize: 11, fontWeight: '600', color: Colors.textPrimary }}>Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={{ paddingVertical: 4, paddingHorizontal: 8, borderWidth: 1, borderColor: Colors.border, borderRadius: 6, backgroundColor: Colors.surface }}
                              onPress={() => {
                                setRollingKeyId(k.id);
                                setRollGraceHours(24);
                              }}
                            >
                              <Text style={{ fontSize: 11, fontWeight: '600', color: Colors.textPrimary }}>Roll</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleRevoke(k.id, k.keyPrefix)} accessibilityRole="button" style={{ padding: 6 }}>
                              <Feather name="slash" size={16} color={Colors.error} />
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                            <View style={{
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                              borderRadius: 6,
                              borderWidth: 1,
                              borderColor: Colors.border,
                              backgroundColor: Colors.background,
                            }}>
                              <Text style={{ color: Colors.textSecondary, fontSize: 10, fontWeight: '600' }}>REVOKED</Text>
                            </View>
                            <TouchableOpacity onPress={() => handleDelete(k.id, k.keyPrefix)} accessibilityRole="button" style={{ padding: 4 }}>
                              <Feather name="trash-2" size={16} color={Colors.textSecondary} />
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>

                      {/* Key details metadata grid */}
                      <View style={{ marginTop: 8, borderTopWidth: 0.5, borderTopColor: Colors.border + '40', paddingTop: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: Colors.border + '60' }}>
                            <Text style={{ fontSize: 9, fontWeight: '700', color: Colors.textPrimary, textTransform: 'uppercase' }}>
                              {k.keyType === 'RESTRICTED' ? 'Restricted' : 'Full Secret'}
                            </Text>
                          </View>

                          {k.expiresAt && (
                            <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: Colors.warning + '18' }}>
                              <Text style={{ fontSize: 9, fontWeight: '600', color: Colors.warning }}>
                                Expires: {fmtDate(k.expiresAt)}
                              </Text>
                            </View>
                          )}
                        </View>

                        {k.keyType === 'RESTRICTED' && k.scopes && (
                          <Text style={{ fontSize: 11, color: Colors.textSecondary, marginTop: 4 }}>
                            Permissions: {k.scopes.split(',').join(', ')}
                          </Text>
                        )}

                        {k.ipWhitelist && (
                          <Text style={{ fontSize: 11, color: Colors.textSecondary, marginTop: 3 }}>
                            Allowed IPs: {k.ipWhitelist}
                          </Text>
                        )}

                        <Text style={{ fontSize: 10, color: Colors.textSecondary, marginTop: 4 }}>
                          {isKeyActive 
                            ? (k.lastUsedAt ? `Last active ${new Date(k.lastUsedAt).toLocaleString()} ${k.lastUsedIp ? `from ${k.lastUsedIp}` : ''}` : 'Never used')
                            : `Created ${fmtDate(k.createdAt)} · Revoked ${fmtDate(k.revokedAt || k.createdAt)}`
                          }
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}

              {showForm ? (
                <View style={[styles.formCard, { borderColor: Colors.border, backgroundColor: Colors.surface }]}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.sm }}>
                    Create API Key
                  </Text>

                  {/* Environment Selector */}
                  <View style={{ marginBottom: Spacing.md }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 }}>
                      Environment
                    </Text>
                    <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                      <TouchableOpacity
                        style={{
                          flex: 1,
                          paddingVertical: 10,
                          alignItems: 'center',
                          borderWidth: 1,
                          borderRadius: 8,
                          borderColor: newKeyEnv === 'LIVE' ? Colors.primary : Colors.border,
                          backgroundColor: newKeyEnv === 'LIVE' ? Colors.primary + '12' : Colors.surface,
                        }}
                        onPress={() => setNewKeyEnv('LIVE')}
                      >
                        <Text style={{
                          fontSize: 14,
                          fontWeight: newKeyEnv === 'LIVE' ? '600' : '400',
                          color: newKeyEnv === 'LIVE' ? Colors.primary : Colors.textPrimary,
                        }}>Live Key</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{
                          flex: 1,
                          paddingVertical: 10,
                          alignItems: 'center',
                          borderWidth: 1,
                          borderRadius: 8,
                          borderColor: newKeyEnv === 'TEST' ? Colors.primary : Colors.border,
                          backgroundColor: newKeyEnv === 'TEST' ? Colors.primary + '12' : Colors.surface,
                        }}
                        onPress={() => setNewKeyEnv('TEST')}
                      >
                        <Text style={{
                          fontSize: 14,
                          fontWeight: newKeyEnv === 'TEST' ? '600' : '400',
                          color: newKeyEnv === 'TEST' ? Colors.primary : Colors.textPrimary,
                        }}>Test Key</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Key Type Selector */}
                  <View style={{ marginBottom: Spacing.md }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 }}>
                      Key Type
                    </Text>
                    <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                      <TouchableOpacity
                        style={{
                          flex: 1,
                          paddingVertical: 10,
                          alignItems: 'center',
                          borderWidth: 1,
                          borderRadius: 8,
                          borderColor: newKeyType === 'SECRET' ? Colors.primary : Colors.border,
                          backgroundColor: newKeyType === 'SECRET' ? Colors.primary + '12' : Colors.surface,
                        }}
                        onPress={() => setNewKeyType('SECRET')}
                      >
                        <Text style={{
                          fontSize: 14,
                          fontWeight: newKeyType === 'SECRET' ? '600' : '400',
                          color: newKeyType === 'SECRET' ? Colors.primary : Colors.textPrimary,
                        }}>Full Secret</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{
                          flex: 1,
                          paddingVertical: 10,
                          alignItems: 'center',
                          borderWidth: 1,
                          borderRadius: 8,
                          borderColor: newKeyType === 'RESTRICTED' ? Colors.primary : Colors.border,
                          backgroundColor: newKeyType === 'RESTRICTED' ? Colors.primary + '12' : Colors.surface,
                        }}
                        onPress={() => setNewKeyType('RESTRICTED')}
                      >
                        <Text style={{
                          fontSize: 14,
                          fontWeight: newKeyType === 'RESTRICTED' ? '600' : '400',
                          color: newKeyType === 'RESTRICTED' ? Colors.primary : Colors.textPrimary,
                        }}>Restricted</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Scopes for restricted */}
                  {newKeyType === 'RESTRICTED' && (
                    <View style={{ marginBottom: Spacing.md }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 }}>
                        Authorized Permissions
                      </Text>
                      <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                        <TouchableOpacity
                          style={{
                            flex: 1,
                            paddingVertical: 8,
                            alignItems: 'center',
                            borderWidth: 1,
                            borderRadius: 8,
                            borderColor: newKeyScopes['sessions:read'] ? Colors.primary : Colors.border,
                            backgroundColor: newKeyScopes['sessions:read'] ? Colors.primary + '10' : Colors.surface,
                          }}
                          onPress={() => setNewKeyScopes((prev) => ({ ...prev, 'sessions:read': !prev['sessions:read'] }))}
                        >
                          <Text style={{ fontSize: 13, color: newKeyScopes['sessions:read'] ? Colors.primary : Colors.textPrimary }}>Read Sessions</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{
                            flex: 1,
                            paddingVertical: 8,
                            alignItems: 'center',
                            borderWidth: 1,
                            borderRadius: 8,
                            borderColor: newKeyScopes['sessions:write'] ? Colors.primary : Colors.border,
                            backgroundColor: newKeyScopes['sessions:write'] ? Colors.primary + '10' : Colors.surface,
                          }}
                          onPress={() => setNewKeyScopes((prev) => ({ ...prev, 'sessions:write': !prev['sessions:write'] }))}
                        >
                          <Text style={{ fontSize: 13, color: newKeyScopes['sessions:write'] ? Colors.primary : Colors.textPrimary }}>Write Sessions</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* IP Whitelist */}
                  <View style={{ marginBottom: Spacing.md }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 }}>
                      IP Whitelist (comma-separated, optional)
                    </Text>
                    <TextInput
                      style={[styles.fieldInput, { color: Colors.textPrimary, borderColor: Colors.border, backgroundColor: Colors.background }]}
                      placeholder="e.g. 192.168.1.1, 10.0.0.0/24"
                      placeholderTextColor={Colors.textSecondary}
                      value={newKeyIpWhitelist}
                      onChangeText={setNewKeyIpWhitelist}
                    />
                  </View>

                  {/* Key Expiration Days */}
                  <View style={{ marginBottom: Spacing.md }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 }}>
                      Key Expiration (optional)
                    </Text>
                    <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                      {[
                        { label: 'Never', val: null },
                        { label: '30 Days', val: 30 },
                        { label: '90 Days', val: 90 },
                      ].map((opt) => (
                        <TouchableOpacity
                          key={opt.label}
                          style={{
                            flex: 1,
                            paddingVertical: 8,
                            alignItems: 'center',
                            borderWidth: 1,
                            borderRadius: 8,
                            borderColor: newKeyExpirationDays === opt.val ? Colors.primary : Colors.border,
                            backgroundColor: newKeyExpirationDays === opt.val ? Colors.primary + '10' : Colors.surface,
                          }}
                          onPress={() => setNewKeyExpirationDays(opt.val)}
                        >
                          <Text style={{ fontSize: 13, color: newKeyExpirationDays === opt.val ? Colors.primary : Colors.textPrimary }}>{opt.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Key Label Input */}
                  <View style={{ marginBottom: Spacing.md }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 }}>
                      Key Name / Label
                    </Text>
                    <TextInput
                      style={[styles.fieldInput, { color: Colors.textPrimary, borderColor: Colors.border, backgroundColor: Colors.background }]}
                      placeholder="e.g. Production Server Key"
                      placeholderTextColor={Colors.textSecondary}
                      value={newKeyName}
                      onChangeText={setNewKeyName}
                      autoFocus
                    />
                  </View>

                  <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm }}>
                    <TouchableOpacity style={[styles.primaryBtn, { flex: 1, borderRadius: 8 }]} onPress={handleCreate} disabled={creating}>
                      {creating ? <ActivityIndicator color={Colors.secondary} /> : <Text style={[styles.primaryBtnText, { color: Colors.secondary }]}>Create</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.secondaryBtn, { flex: 1, borderColor: Colors.border, borderRadius: 8 }]} onPress={() => setShowForm(false)}>
                      <Text style={[styles.secondaryBtnText, { color: Colors.textPrimary }]}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                activeKeysCount < 10 && (
                  <TouchableOpacity
                    style={[styles.addBtn, { borderColor: Colors.primary }]}
                    onPress={handleShowForm}
                    accessibilityRole="button"
                  >
                    <Feather name="plus" size={18} color={Colors.primary} />
                    <Text style={[styles.addBtnText, { color: Colors.primary }]}>
                      Create {activeTab === 'LIVE' ? 'Live' : 'Test'} API Key
                    </Text>
                  </TouchableOpacity>
                )
              )}
            </ScrollView>
          )}
        </View>
      ) : (
        // API REQUEST LOGS VIEW
        <View style={{ flex: 1 }}>
          {logsLoading && logs.length === 0 ? (
            <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
          ) : (
            <ScrollView contentContainerStyle={{ padding: Spacing.md }}>
              {logs.length === 0 ? (
                <View style={{ padding: Spacing.lg, alignItems: 'center', justifyContent: 'center', marginVertical: Spacing.xl }}>
                  <Text style={{ color: Colors.textSecondary, fontSize: 14, textAlign: 'center' }}>
                    No API request logs found.
                  </Text>
                </View>
              ) : (
                logs.map((log) => {
                  const isError = log.statusCode >= 400;
                  return (
                    <View key={log.id} style={[styles.keyRow, {
                      borderColor: Colors.border,
                      backgroundColor: Colors.surface,
                      padding: Spacing.md,
                      flexDirection: 'column',
                      alignItems: 'stretch',
                    }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                        <Text style={{
                          fontSize: 11,
                          fontWeight: '800',
                          color: log.method === 'POST' ? Colors.info : Colors.textPrimary,
                        }}>{log.method}</Text>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.textPrimary, flex: 1 }} numberOfLines={1}>
                          {log.path}
                        </Text>
                        <Text style={{
                          fontSize: 12,
                          fontWeight: '700',
                          color: isError ? Colors.error : Colors.success,
                        }}>{log.statusCode}</Text>
                      </View>
                      
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                        <Text style={{ fontSize: 10, color: Colors.textSecondary }}>
                          Client IP: {log.ipAddress}
                        </Text>
                        <Text style={{ fontSize: 10, color: Colors.textSecondary }}>
                          {new Date(log.createdAt).toLocaleString()}
                        </Text>
                      </View>
                      {log.errorMessage && (
                        <Text style={{ fontSize: 11, color: Colors.error, marginTop: 6, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
                          Error: {log.errorMessage}
                        </Text>
                      )}
                    </View>
                  );
                })
              )}

              {hasMoreLogs && (
                <TouchableOpacity
                  style={[styles.secondaryBtn, { borderColor: Colors.border, marginVertical: Spacing.md, borderRadius: 8 }]}
                  onPress={() => loadLogs(logsPage + 1)}
                  disabled={logsLoading}
                >
                  {logsLoading ? (
                    <ActivityIndicator color={Colors.textPrimary} />
                  ) : (
                    <Text style={[styles.secondaryBtnText, { color: Colors.textPrimary }]}>Load More Logs</Text>
                  )}
                </TouchableOpacity>
              )}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}
