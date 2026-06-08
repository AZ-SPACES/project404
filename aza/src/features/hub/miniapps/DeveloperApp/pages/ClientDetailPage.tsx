import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Clipboard, StyleSheet,
} from 'react-native';
import { Feather } from '@react-native-vector-icons/feather';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { Spacing, Radius, Typography } from '../../../../../theme';
import { NavProps, OAuthClientData } from '../types';
import {
  rotateDeveloperClientSecret,
  deleteDeveloperClient,
  linkMerchantToOAuthClient,
  unlinkMerchantFromOAuthClient,
} from '../../../../../services/api';
import { queryClient } from '../../../../../lib/queryClient';
import { queryKeys } from '../../../../../lib/queryKeys';

const SCOPE_ICONS: Record<string, string> = {
  identity:      'person-outline',
  email:         'mail-outline',
  phone:         'call-outline',
  'wallet:read': 'wallet-outline',
  payment:       'card-outline',
};

const SCOPE_LABELS: Record<string, string> = {
  identity:      'Identity (name, username, photo)',
  email:         'Email address',
  phone:         'Phone number',
  'wallet:read': 'Wallet balance (read-only)',
  payment:       'Initiate payments from user wallet',
};

interface Props extends NavProps {
  client: OAuthClientData;
  justCreated?: boolean;
}

export default function ClientDetailPage({ goBack, client: initialClient, justCreated, Colors }: Props) {
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);

  const [client,   setClient]   = useState(initialClient);
  const [rotating, setRotating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [linking,  setLinking]  = useState(false);

  function copy(text: string, label: string) {
    Clipboard.setString(text);
    Alert.alert('Copied', `${label} copied to clipboard.`);
  }

  async function handleRotate() {
    Alert.alert(
      'Rotate secret?',
      'The current secret will stop working immediately. Any running integrations will fail until you update them.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Rotate', style: 'destructive',
          onPress: async () => {
            setRotating(true);
            try {
              const res = await rotateDeveloperClientSecret(client.clientId);
              const updated = res.data?.data;
              setClient(updated);
              await queryClient.invalidateQueries({ queryKey: queryKeys.developerClients() });
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.error?.message ?? 'Failed to rotate secret.');
            } finally {
              setRotating(false);
            }
          },
        },
      ]
    );
  }

  async function handleLinkMerchant() {
    const hasPaymentScope = client.allowedScopes.includes('payment');
    if (!hasPaymentScope) {
      Alert.alert(
        'Payment scope required',
        "Add the 'payment' scope to this app before linking a merchant account.",
      );
      return;
    }
    Alert.alert(
      'Link merchant account?',
      'Users who authorise this app with the payment scope will be able to pay your merchant account directly.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Link',
          onPress: async () => {
            setLinking(true);
            try {
              const res = await linkMerchantToOAuthClient(client.clientId);
              const updated = res.data?.data;
              setClient((prev: OAuthClientData) => ({ ...prev, merchantId: updated.merchantId, merchantName: updated.merchantName }));
              await queryClient.invalidateQueries({ queryKey: queryKeys.developerClients() });
              Alert.alert('Linked', `Merchant "${updated.merchantName}" linked successfully.`);
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.error?.message ?? 'Failed to link merchant.');
            } finally {
              setLinking(false);
            }
          },
        },
      ]
    );
  }

  async function handleUnlinkMerchant() {
    Alert.alert(
      'Unlink merchant?',
      'This app will no longer be able to initiate payments to your merchant account.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlink', style: 'destructive',
          onPress: async () => {
            setLinking(true);
            try {
              const res = await unlinkMerchantFromOAuthClient(client.clientId);
              const updated = res.data?.data;
              setClient((prev: OAuthClientData) => ({ ...prev, merchantId: updated.merchantId, merchantName: updated.merchantName }));
              await queryClient.invalidateQueries({ queryKey: queryKeys.developerClients() });
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.error?.message ?? 'Failed to unlink merchant.');
            } finally {
              setLinking(false);
            }
          },
        },
      ]
    );
  }

  async function handleDelete() {
    Alert.alert(
      'Delete app?',
      'All tokens issued to this app will stop working. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteDeveloperClient(client.clientId);
              await queryClient.invalidateQueries({ queryKey: queryKeys.developerClients() });
              goBack();
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.error?.message ?? 'Failed to delete app.');
              setDeleting(false);
            }
          },
        },
      ]
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <TouchableOpacity style={styles.back} onPress={goBack}>
        <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        <Text style={[styles.backText, { color: Colors.textPrimary }]}>Back</Text>
      </TouchableOpacity>

      <View style={styles.appHeader}>
        <View style={[styles.appIcon, { backgroundColor: Colors.primary + '20' }]}>
          <Ionicons name="apps" size={32} color={Colors.primary} />
        </View>
        <Text style={[styles.appName, { color: Colors.textPrimary }]}>{client.appName}</Text>
        {client.appDescription ? (
          <Text style={[styles.appDesc, { color: Colors.textSecondary }]}>{client.appDescription}</Text>
        ) : null}
      </View>

      {/* One-time secret banner */}
      {client.clientSecret && (
        <View style={[styles.secretBanner, { backgroundColor: Colors.primary + '18', borderColor: Colors.primary + '40' }]}>
          <View style={styles.secretBannerHeader}>
            <Ionicons name="key" size={16} color={Colors.primary} />
            <Text style={[styles.secretBannerTitle, { color: Colors.primary }]}>
              {justCreated ? 'Save your client secret now' : 'New secret — save it now'}
            </Text>
          </View>
          <Text style={[styles.secretBannerNote, { color: Colors.textSecondary }]}>
            This is shown only once. Copy it before leaving this screen.
          </Text>
          <TouchableOpacity
            style={[styles.secretBox, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
            onPress={() => copy(client.clientSecret!, 'Client secret')}
            activeOpacity={0.7}
          >
            <Text style={[styles.secretText, { color: Colors.textPrimary }]} numberOfLines={2}>
              {client.clientSecret}
            </Text>
            <Feather name="copy" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Client ID */}
      <Text style={[styles.sectionLabel, { color: Colors.textSecondary }]}>Client ID</Text>
      <TouchableOpacity
        style={[styles.row, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
        onPress={() => copy(client.clientId, 'Client ID')}
        activeOpacity={0.7}
      >
        <Text style={[styles.rowValue, { color: Colors.textPrimary }]} numberOfLines={1}>{client.clientId}</Text>
        <Feather name="copy" size={15} color={Colors.textSecondary} />
      </TouchableOpacity>

      {/* Redirect URIs */}
      <Text style={[styles.sectionLabel, { color: Colors.textSecondary }]}>Redirect URIs</Text>
      <View style={[styles.listCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
        {client.redirectUris.map(uri => (
          <Text key={uri} style={[styles.listItem, { color: Colors.textPrimary }]}>{uri}</Text>
        ))}
      </View>

      {/* Scopes */}
      <Text style={[styles.sectionLabel, { color: Colors.textSecondary }]}>Permissions</Text>
      <View style={[styles.listCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
        {client.allowedScopes.map(scope => (
          <View key={scope} style={styles.scopeRow}>
            <Ionicons name={(SCOPE_ICONS[scope] ?? 'shield-outline') as never} size={16} color={Colors.primary} />
            <Text style={[styles.listItem, { color: Colors.textPrimary }]}>
              {SCOPE_LABELS[scope] ?? scope}
            </Text>
          </View>
        ))}
      </View>

      {/* Merchant account */}
      {client.allowedScopes.includes('payment') && (
        <>
          <Text style={[styles.sectionLabel, { color: Colors.textSecondary }]}>Pay with AZA</Text>
          {client.merchantId ? (
            <>
              <View style={[styles.row, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
                <Ionicons name="storefront-outline" size={16} color={Colors.primary} />
                <Text style={[styles.rowValue, { color: Colors.textPrimary, flex: 1, marginLeft: 8 }]} numberOfLines={1}>
                  {client.merchantName ?? client.merchantId}
                </Text>
                <View style={[styles.badge, { backgroundColor: Colors.primary + '20' }]}>
                  <Text style={[styles.badgeText, { color: Colors.primary }]}>Linked</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.actionRow, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
                onPress={handleUnlinkMerchant}
                disabled={linking}
                activeOpacity={0.7}
              >
                {linking
                  ? <ActivityIndicator size="small" color={Colors.textSecondary} />
                  : <Feather name="x-circle" size={16} color={Colors.textSecondary} />}
                <Text style={[styles.actionText, { color: Colors.textSecondary }]}>Unlink merchant</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={[{ color: Colors.textSecondary, fontSize: 12, marginBottom: 8, lineHeight: 18 }]}>
                Link your merchant account so users can pay you directly through this app.
              </Text>
              <TouchableOpacity
                style={[styles.actionRow, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
                onPress={handleLinkMerchant}
                disabled={linking}
                activeOpacity={0.7}
              >
                {linking
                  ? <ActivityIndicator size="small" color={Colors.primary} />
                  : <Ionicons name="storefront-outline" size={16} color={Colors.primary} />}
                <Text style={[styles.actionText, { color: Colors.primary }]}>Link merchant account</Text>
              </TouchableOpacity>
            </>
          )}
        </>
      )}

      {/* Actions */}
      <Text style={[styles.sectionLabel, { color: Colors.textSecondary }]}>Credentials</Text>
      <TouchableOpacity
        style={[styles.actionRow, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
        onPress={handleRotate}
        disabled={rotating}
        activeOpacity={0.7}
      >
        {rotating
          ? <ActivityIndicator size="small" color={Colors.primary} />
          : <Feather name="refresh-cw" size={16} color={Colors.primary} />}
        <Text style={[styles.actionText, { color: Colors.primary }]}>Rotate client secret</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.deleteBtn, { borderColor: Colors.error ?? '#EF4444' }]}
        onPress={handleDelete}
        disabled={deleting}
        activeOpacity={0.7}
      >
        {deleting
          ? <ActivityIndicator size="small" color={Colors.error ?? '#EF4444'} />
          : <Feather name="trash-2" size={16} color={Colors.error ?? '#EF4444'} />}
        <Text style={[styles.deleteText, { color: Colors.error ?? '#EF4444' }]}>Delete app</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function createStyles(Colors: any) {
  return StyleSheet.create({
    content:           { padding: Spacing.lg, paddingBottom: Spacing.xl * 2 },
    back:              { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.lg },
    backText:          { fontSize: 15, fontWeight: '500' },
    appHeader:         { alignItems: 'center', marginBottom: Spacing.xl },
    appIcon:           { width: 72, height: 72, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md },
    appName:           { fontSize: 22, fontWeight: '700', textAlign: 'center' },
    appDesc:           { ...Typography.caption as any, textAlign: 'center', marginTop: 4 },
    secretBanner:      { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.lg, gap: Spacing.sm },
    secretBannerHeader:{ flexDirection: 'row', alignItems: 'center', gap: 6 },
    secretBannerTitle: { fontSize: 14, fontWeight: '700' },
    secretBannerNote:  { fontSize: 12, lineHeight: 16 },
    secretBox:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: 10, gap: 8 },
    secretText:        { flex: 1, fontFamily: 'monospace', fontSize: 13 },
    sectionLabel:      { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, marginTop: Spacing.lg },
    row:               { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 12 },
    rowValue:          { flex: 1, fontSize: 13, fontFamily: 'monospace', marginRight: 8 },
    listCard:          { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.sm },
    listItem:          { fontSize: 13 },
    scopeRow:          { flexDirection: 'row', alignItems: 'center', gap: 8 },
    actionRow:         { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 14, marginBottom: Spacing.sm },
    actionText:        { fontSize: 15, fontWeight: '600' },
    deleteBtn:         { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 14, marginTop: Spacing.md },
    deleteText:        { fontSize: 15, fontWeight: '600' },
    badge:             { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    badgeText:         { fontSize: 11, fontWeight: '700' },
  });
}
