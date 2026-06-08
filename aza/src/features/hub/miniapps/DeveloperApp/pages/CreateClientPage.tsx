import React, { useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, StyleSheet,
} from 'react-native';
import { Feather } from '@react-native-vector-icons/feather';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { Spacing, Radius, Typography } from '../../../../../theme';
import { NavProps } from '../types';
import { registerDeveloperClient } from '../../../../../services/api';
import { queryClient } from '../../../../../lib/queryClient';
import { queryKeys } from '../../../../../lib/queryKeys';

const ALL_SCOPES = [
  { id: 'identity',     label: 'Identity',       desc: 'Name, username, photo' },
  { id: 'email',        label: 'Email',           desc: 'Email address' },
  { id: 'phone',        label: 'Phone',           desc: 'Phone number' },
  { id: 'wallet:read',  label: 'Wallet (read)',   desc: 'Balance & currency' },
];

export default function CreateClientPage({ goBack, navigate, Colors }: NavProps) {
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);

  const [appName,     setAppName]     = useState('');
  const [appDesc,     setAppDesc]     = useState('');
  const [logoUrl,     setLogoUrl]     = useState('');
  const [websiteUrl,  setWebsiteUrl]  = useState('');
  const [redirectUri, setRedirectUri] = useState('');
  const [scopes,      setScopes]      = useState<string[]>(['identity']);
  const [saving,      setSaving]      = useState(false);

  function toggleScope(id: string) {
    setScopes(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  }

  async function handleCreate() {
    if (!appName.trim()) { Alert.alert('Required', 'App name is required.'); return; }
    if (!redirectUri.trim()) { Alert.alert('Required', 'At least one redirect URI is required.'); return; }
    if (scopes.length === 0) { Alert.alert('Required', 'Select at least one scope.'); return; }

    setSaving(true);
    try {
      const res = await registerDeveloperClient({
        appName:      appName.trim(),
        appDescription: appDesc.trim() || undefined,
        logoUrl:      logoUrl.trim() || undefined,
        websiteUrl:   websiteUrl.trim() || undefined,
        redirectUris: redirectUri.split('\n').map(u => u.trim()).filter(Boolean),
        scopes,
      });
      const client = res.data?.data;
      await queryClient.invalidateQueries({ queryKey: queryKeys.developerClients() });
      navigate('detail', { client, justCreated: true });
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? 'Failed to create app.';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <TouchableOpacity style={styles.back} onPress={goBack}>
        <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        <Text style={[styles.backText, { color: Colors.textPrimary }]}>Back</Text>
      </TouchableOpacity>

      <Text style={[styles.title, { color: Colors.textPrimary }]}>Register an app</Text>
      <Text style={[styles.subtitle, { color: Colors.textSecondary }]}>
        Your app will receive a client ID and secret to use the "Sign in with AZA" API.
      </Text>

      <Text style={[styles.label, { color: Colors.textSecondary }]}>App name *</Text>
      <TextInput
        style={[styles.input, { color: Colors.textPrimary, borderColor: Colors.border, backgroundColor: Colors.surface }]}
        value={appName} onChangeText={setAppName}
        placeholder="e.g. Accra Travel" placeholderTextColor={Colors.textSecondary}
      />

      <Text style={[styles.label, { color: Colors.textSecondary }]}>Description</Text>
      <TextInput
        style={[styles.input, styles.textarea, { color: Colors.textPrimary, borderColor: Colors.border, backgroundColor: Colors.surface }]}
        value={appDesc} onChangeText={setAppDesc}
        placeholder="Brief description of your app" placeholderTextColor={Colors.textSecondary}
        multiline numberOfLines={3}
      />

      <Text style={[styles.label, { color: Colors.textSecondary }]}>Logo URL</Text>
      <TextInput
        style={[styles.input, { color: Colors.textPrimary, borderColor: Colors.border, backgroundColor: Colors.surface }]}
        value={logoUrl} onChangeText={setLogoUrl}
        placeholder="https://example.com/logo.png" placeholderTextColor={Colors.textSecondary}
        autoCapitalize="none" keyboardType="url"
      />

      <Text style={[styles.label, { color: Colors.textSecondary }]}>Website URL</Text>
      <TextInput
        style={[styles.input, { color: Colors.textPrimary, borderColor: Colors.border, backgroundColor: Colors.surface }]}
        value={websiteUrl} onChangeText={setWebsiteUrl}
        placeholder="https://example.com" placeholderTextColor={Colors.textSecondary}
        autoCapitalize="none" keyboardType="url"
      />

      <Text style={[styles.label, { color: Colors.textSecondary }]}>Redirect URIs *</Text>
      <TextInput
        style={[styles.input, styles.textarea, { color: Colors.textPrimary, borderColor: Colors.border, backgroundColor: Colors.surface }]}
        value={redirectUri} onChangeText={setRedirectUri}
        placeholder={'https://example.com/callback\nhttps://example.com/auth'}
        placeholderTextColor={Colors.textSecondary}
        multiline numberOfLines={3} autoCapitalize="none" keyboardType="url"
      />
      <Text style={[styles.hint, { color: Colors.textSecondary }]}>One per line. Must use HTTPS (or http://localhost for dev).</Text>

      <Text style={[styles.label, { color: Colors.textSecondary }]}>Permissions *</Text>
      <Text style={[styles.hint, { color: Colors.textSecondary }]}>Select what your app can read from the user's account.</Text>
      <View style={styles.scopeGrid}>
        {ALL_SCOPES.map(scope => {
          const active = scopes.includes(scope.id);
          return (
            <TouchableOpacity
              key={scope.id}
              style={[styles.scopeCard, {
                borderColor:       active ? Colors.primary : Colors.border,
                backgroundColor:   active ? Colors.primary + '15' : Colors.surface,
              }]}
              onPress={() => toggleScope(scope.id)}
              activeOpacity={0.7}
            >
              <View style={styles.scopeCardRow}>
                <Text style={[styles.scopeLabel, { color: active ? Colors.primary : Colors.textPrimary }]}>
                  {scope.label}
                </Text>
                {active && <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />}
              </View>
              <Text style={[styles.scopeDesc, { color: Colors.textSecondary }]}>{scope.desc}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={[styles.submitBtn, { backgroundColor: Colors.primary, opacity: saving ? 0.7 : 1 }]}
        onPress={handleCreate}
        disabled={saving}
      >
        {saving
          ? <ActivityIndicator color={Colors.black} />
          : <Text style={[styles.submitText, { color: Colors.black }]}>Create app</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

function createStyles(Colors: any) {
  return StyleSheet.create({
    content:       { padding: Spacing.lg, paddingBottom: Spacing.xl * 2 },
    back:          { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.lg },
    backText:      { fontSize: 15, fontWeight: '500' },
    title:         { fontSize: 22, fontWeight: '700', marginBottom: Spacing.xs },
    subtitle:      { ...Typography.caption as any, marginBottom: Spacing.lg, lineHeight: 18 },
    label:         { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: Spacing.md },
    input:         { borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 12, fontSize: 15 },
    textarea:      { height: 80, textAlignVertical: 'top' },
    hint:          { ...Typography.caption as any, marginTop: 4, marginBottom: Spacing.xs },
    scopeGrid:     { gap: Spacing.sm, marginBottom: Spacing.lg },
    scopeCard:     { borderWidth: 1.5, borderRadius: Radius.md, padding: Spacing.md },
    scopeCardRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
    scopeLabel:    { fontSize: 14, fontWeight: '600' },
    scopeDesc:     { fontSize: 12 },
    submitBtn:     { height: 52, borderRadius: Radius.full, justifyContent: 'center', alignItems: 'center' },
    submitText:    { fontSize: 16, fontWeight: '700' },
  });
}
