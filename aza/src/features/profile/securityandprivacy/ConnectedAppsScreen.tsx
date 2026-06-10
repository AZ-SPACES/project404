import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Image, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';
import { BackButton } from '../../../components/ui/BackButton';
import { getConnectedApps, revokeConnectedApp } from '../../../services/api';
import { queryKeys } from '../../../lib/queryKeys';

const SCOPE_LABELS: Record<string, string> = {
  identity:      'Identity',
  email:         'Email',
  phone:         'Phone',
  'wallet:read': 'Wallet balance',
};

interface ConnectedApp {
  clientId: string;
  appName: string;
  appDescription?: string;
  logoUrl?: string;
  grantedScopes: string[];
  grantedAt?: string;
}

export function ConnectedAppsScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation();
  const qc = useQueryClient();

  const { data: apps = [], isLoading } = useQuery<ConnectedApp[]>({
    queryKey: queryKeys.connectedApps(),
    queryFn:  () => getConnectedApps().then(r => r.data?.data ?? []),
    staleTime: 30_000,
  });

  const revoke = useMutation({
    mutationFn: (clientId: string) => revokeConnectedApp(clientId),
    onSuccess:  () => qc.invalidateQueries({ queryKey: queryKeys.connectedApps() }),
  });

  const [revokingId, setRevokingId] = useState<string | null>(null);

  function handleRevoke(app: ConnectedApp) {
    Alert.alert(
      `Revoke ${app.appName}?`,
      `${app.appName} will no longer be able to access your account. You can re-authorise it later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke access', style: 'destructive',
          onPress: () => {
            setRevokingId(app.clientId);
            revoke.mutate(app.clientId, { onSettled: () => setRevokingId(null) });
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors.background }]}>
      <View style={styles.topBar}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={[styles.pageTitle, { color: Colors.textPrimary }]}>Connected Apps</Text>
        <View style={{ width: 36 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : apps.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="apps-outline" size={48} color={Colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: Colors.textPrimary }]}>No connected apps</Text>
          <Text style={[styles.emptyDesc, { color: Colors.textSecondary }]}>
            When you sign in to a third-party app using AZA, it will appear here.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          <Text style={[styles.listNote, { color: Colors.textSecondary }]}>
            These apps have been granted access to your AZA account. Revoke any you no longer use.
          </Text>

          {apps.map(app => (
            <View
              key={app.clientId}
              style={[styles.card, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
            >
              <View style={styles.cardHeader}>
                {app.logoUrl ? (
                  <Image source={{ uri: app.logoUrl }} style={styles.appLogo} />
                ) : (
                  <View style={[styles.appIconFallback, { backgroundColor: Colors.primary + '20' }]}>
                    <Ionicons name="apps" size={22} color={Colors.primary} />
                  </View>
                )}
                <View style={styles.appInfo}>
                  <Text style={[styles.appName, { color: Colors.textPrimary }]}>{app.appName}</Text>
                  {app.appDescription ? (
                    <Text style={[styles.appDesc, { color: Colors.textSecondary }]} numberOfLines={1}>
                      {app.appDescription}
                    </Text>
                  ) : null}
                </View>
              </View>

              <View style={styles.scopesRow}>
                {app.grantedScopes.filter(s => s).map(scope => (
                  <View key={scope} style={[styles.scopeChip, { backgroundColor: Colors.primary + '15' }]}>
                    <Text style={[styles.scopeText, { color: Colors.primary }]}>
                      {SCOPE_LABELS[scope] ?? scope}
                    </Text>
                  </View>
                ))}
              </View>

              {app.grantedAt ? (
                <Text style={[styles.grantedAt, { color: Colors.textSecondary }]}>
                  Granted {new Date(app.grantedAt).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
              ) : null}

              <TouchableOpacity
                style={[styles.revokeBtn, { borderColor: Colors.error ?? '#EF4444' }]}
                onPress={() => handleRevoke(app)}
                disabled={revokingId === app.clientId}
                activeOpacity={0.7}
              >
                {revokingId === app.clientId ? (
                  <ActivityIndicator size="small" color={Colors.error ?? '#EF4444'} />
                ) : (
                  <Text style={[styles.revokeBtnText, { color: Colors.error ?? '#EF4444' }]}>
                    Revoke access
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  return StyleSheet.create({
    container:       { flex: 1 },
    topBar:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
    pageTitle:       { fontSize: 17, fontWeight: '700' },
    center:          { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.xl },
    emptyTitle:      { fontSize: 18, fontWeight: '600', textAlign: 'center' },
    emptyDesc:       { ...Typography.caption as any, textAlign: 'center', lineHeight: 18 },
    list:            { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xl * 2 },
    listNote:        { ...Typography.caption as any, marginBottom: Spacing.xs, lineHeight: 18 },
    card:            { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md, gap: Spacing.sm },
    cardHeader:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    appLogo:         { width: 44, height: 44, borderRadius: 12 },
    appIconFallback: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    appInfo:         { flex: 1 },
    appName:         { fontSize: 15, fontWeight: '600' },
    appDesc:         { ...Typography.caption as any, marginTop: 1 },
    scopesRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    scopeChip:       { paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.full },
    scopeText:       { fontSize: 12, fontWeight: '600' },
    grantedAt:       { ...Typography.caption as any },
    revokeBtn:       { borderWidth: 1, borderRadius: Radius.md, paddingVertical: 10, alignItems: 'center', marginTop: 4 },
    revokeBtnText:   { fontSize: 13, fontWeight: '600' },
  });
}
