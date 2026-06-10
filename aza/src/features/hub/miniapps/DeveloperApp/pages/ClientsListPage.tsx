import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, StyleSheet,
} from 'react-native';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { Feather } from '@react-native-vector-icons/feather';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../../../lib/queryKeys';
import { getDeveloperClients } from '../../../../../services/api';
import { Spacing, Radius, Typography } from '../../../../../theme';
import { NavProps, OAuthClientData } from '../types';

const SCOPE_ICONS: Record<string, string> = {
  identity:      'person-outline',
  email:         'mail-outline',
  phone:         'call-outline',
  'wallet:read': 'wallet-outline',
};

export default function ClientsListPage({ navigate, Colors }: NavProps) {
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);

  const { data: clients = [], isLoading } = useQuery<OAuthClientData[]>({
    queryKey: queryKeys.developerClients(),
    queryFn:  () => getDeveloperClients().then(r => r.data?.data ?? []),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: Colors.textPrimary }]}>OAuth Apps</Text>
        <TouchableOpacity
          style={[styles.newBtn, { backgroundColor: Colors.primary }]}
          onPress={() => navigate('create')}
        >
          <Feather name="plus" size={16} color={Colors.black} />
          <Text style={[styles.newBtnText, { color: Colors.black }]}>New app</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.subtitle, { color: Colors.textSecondary }]}>
        Apps that use "Sign in with AZA" to authenticate your users.
      </Text>

      {clients.length === 0 ? (
        <View style={[styles.empty, { borderColor: Colors.border }]}>
          <Ionicons name="apps-outline" size={40} color={Colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: Colors.textPrimary }]}>No apps yet</Text>
          <Text style={[styles.emptyDesc, { color: Colors.textSecondary }]}>
            Create your first OAuth app to let users sign in with their AZA account.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {clients.map(client => (
            <TouchableOpacity
              key={client.clientId}
              style={[styles.card, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
              onPress={() => navigate('detail', { client })}
              activeOpacity={0.7}
            >
              <View style={styles.cardRow}>
                <View style={[styles.appIcon, { backgroundColor: Colors.primary + '20' }]}>
                  <Ionicons name="apps" size={22} color={Colors.primary} />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={[styles.appName, { color: Colors.textPrimary }]}>{client.appName}</Text>
                  <Text style={[styles.clientId, { color: Colors.textSecondary }]} numberOfLines={1}>
                    {client.clientId}
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={Colors.textSecondary} />
              </View>

              <View style={styles.scopeRow}>
                {client.allowedScopes.map(s => (
                  <View key={s} style={[styles.scopeChip, { backgroundColor: Colors.primary + '15' }]}>
                    <Ionicons name={(SCOPE_ICONS[s] ?? 'shield-outline') as never} size={11} color={Colors.primary} />
                    <Text style={[styles.scopeText, { color: Colors.primary }]}>{s}</Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function createStyles(Colors: any) {
  return StyleSheet.create({
    content:    { padding: Spacing.lg, paddingBottom: Spacing.xl * 2 },
    center:     { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.xs },
    title:      { fontSize: 22, fontWeight: '700' },
    newBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full },
    newBtnText: { fontSize: 13, fontWeight: '700' },
    subtitle:   { ...Typography.caption as any, marginBottom: Spacing.lg },
    empty:      { alignItems: 'center', gap: Spacing.sm, borderWidth: 1, borderStyle: 'dashed', borderRadius: Radius.lg, padding: Spacing.xl, marginTop: Spacing.md },
    emptyTitle: { fontSize: 16, fontWeight: '600' },
    emptyDesc:  { ...Typography.caption as any, textAlign: 'center', lineHeight: 18 },
    list:       { gap: Spacing.md },
    card:       { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md, gap: Spacing.sm },
    cardRow:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    appIcon:    { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    cardInfo:   { flex: 1 },
    appName:    { fontSize: 15, fontWeight: '600' },
    clientId:   { ...Typography.caption as any, marginTop: 1 },
    scopeRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    scopeChip:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
    scopeText:  { fontSize: 11, fontWeight: '600' },
  });
}
