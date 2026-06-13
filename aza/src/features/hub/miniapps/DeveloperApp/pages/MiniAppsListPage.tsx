import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, StyleSheet,
} from 'react-native';
import { Feather } from '@react-native-vector-icons/feather';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMyMiniApps, resubmitMiniApp } from '../../../../../services/api';
import { ThemeColors, Spacing, Radius, Typography } from '../../../../../theme';
import { NavProps, MiniAppData } from '../types';

const STATUS_META: Record<MiniAppData['status'], { label: string; color: string }> = {
  DRAFT:          { label: 'Draft',          color: '#888' },
  PENDING_REVIEW: { label: 'In Review',       color: '#d97706' },
  ACTIVE:         { label: 'Live',            color: '#22c55e' },
  REJECTED:       { label: 'Rejected',        color: '#ef4444' },
  SUSPENDED:      { label: 'Suspended',       color: '#f97316' },
};

export default function MiniAppsListPage({ navigate, Colors }: NavProps) {
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const qc = useQueryClient();

  const { data: apps = [], isLoading } = useQuery<MiniAppData[]>({
    queryKey: ['myMiniApps'],
    queryFn: () => getMyMiniApps().then(r => r.data?.data ?? []),
    staleTime: 30_000,
  });

  const resubmit = useMutation({
    mutationFn: (appId: string) => resubmitMiniApp(appId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myMiniApps'] }),
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
        <Text style={[styles.title, { color: Colors.textPrimary }]}>My Mini Apps</Text>
        <TouchableOpacity
          style={[styles.newBtn, { backgroundColor: Colors.primary }]}
          onPress={() => navigate('miniapp_submit')}
        >
          <Feather name="plus" size={16} color={Colors.black} />
          <Text style={[styles.newBtnText, { color: Colors.black }]}>Submit app</Text>
        </TouchableOpacity>
      </View>

      {apps.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="box" size={32} color={Colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: Colors.textPrimary }]}>No apps yet</Text>
          <Text style={[styles.emptyText, { color: Colors.textSecondary }]}>
            Submit your first mini app to reach all Aza users
          </Text>
        </View>
      ) : (
        apps.map(app => {
          const meta = STATUS_META[app.status];
          return (
            <TouchableOpacity
              key={app.id}
              style={[styles.card, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
              onPress={() => navigate('miniapp_detail', { app })}
              activeOpacity={0.75}
            >
              <View style={styles.cardRow}>
                <View style={styles.cardText}>
                  <Text style={[styles.appName, { color: Colors.textPrimary }]}>{app.name}</Text>
                  <Text style={[styles.appDesc, { color: Colors.textSecondary }]} numberOfLines={1}>
                    {app.description}
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: meta.color + '22', borderColor: meta.color + '55' }]}>
                  <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
                </View>
              </View>
              {app.status === 'REJECTED' && app.rejectionReason && (
                <View style={[styles.rejectionRow, { borderTopColor: Colors.border }]}>
                  <Feather name="alert-circle" size={12} color="#ef4444" />
                  <Text style={styles.rejectionText} numberOfLines={2}>{app.rejectionReason}</Text>
                </View>
              )}
              {(app.status === 'REJECTED' || app.status === 'DRAFT') && (
                <TouchableOpacity
                  style={[styles.resubmitBtn, { borderColor: Colors.primary }]}
                  onPress={() => resubmit.mutate(app.id)}
                  disabled={resubmit.isPending}
                >
                  <Text style={[styles.resubmitText, { color: Colors.primary }]}>
                    {resubmit.isPending ? 'Submitting...' : 'Submit for review'}
                  </Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
}

function createStyles(Colors: ThemeColors) {
  return StyleSheet.create({
    content: { padding: Spacing.lg, paddingBottom: Spacing.xl * 2 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.lg,
    },
    title: { fontSize: 20, fontWeight: '700' },
    newBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: Spacing.md,
      paddingVertical: 8,
      borderRadius: Radius.full,
    },
    newBtnText: { ...Typography.caption, fontWeight: '700' },
    empty: {
      alignItems: 'center',
      paddingVertical: Spacing.xl * 2,
      gap: Spacing.sm,
    },
    emptyTitle: { fontSize: 17, fontWeight: '600', marginTop: Spacing.sm },
    emptyText: { ...Typography.body, textAlign: 'center', lineHeight: 22, maxWidth: 260 },
    card: {
      borderWidth: 1,
      borderRadius: Radius.lg,
      padding: Spacing.md,
      marginBottom: Spacing.md,
    },
    cardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cardText: { flex: 1, marginRight: Spacing.sm },
    appName: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
    appDesc: { ...Typography.caption },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: Radius.full,
      borderWidth: 1,
    },
    badgeText: { fontSize: 11, fontWeight: '700' },
    rejectionRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 6,
      marginTop: Spacing.sm,
      paddingTop: Spacing.sm,
      borderTopWidth: 1,
    },
    rejectionText: { ...Typography.caption, color: '#ef4444', flex: 1 },
    resubmitBtn: {
      marginTop: Spacing.sm,
      paddingVertical: 8,
      borderRadius: Radius.md,
      borderWidth: 1,
      alignItems: 'center',
    },
    resubmitText: { ...Typography.caption, fontWeight: '600' },
  });
}
