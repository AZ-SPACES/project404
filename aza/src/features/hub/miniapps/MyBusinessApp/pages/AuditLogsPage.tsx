import React from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { Feather } from '@react-native-vector-icons/feather';
import { Typography, Spacing } from '../../../../../theme';
import { NavProps } from '../types';
import { extractData, fmtDate } from '../helpers';
import { getMerchantAuditLogs } from '../../../../../services/api';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../../../lib/queryKeys';
import InternalHeader from '../components/InternalHeader';

function formatAction(action: string) {
  return action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AuditLogsPage({ goBack, Colors, styles }: NavProps) {
  const { data: logs = [], isLoading: loading } = useQuery({
    queryKey: queryKeys.merchantAuditLogs(),
    queryFn: async () => { const r = await getMerchantAuditLogs(0, 40); return extractData(r)?.content ?? []; },
    staleTime: 60_000,
  });

  return (
    <View style={{ flex: 1 }}>
      <InternalHeader title="Audit Log" onBack={goBack} Colors={Colors} styles={styles} />

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : logs.length === 0 ? (
        <View style={styles.center}>
          <Feather name="clipboard" size={36} color={Colors.textSecondary} />
          <Text style={[Typography.body as any, { color: Colors.textSecondary, marginTop: Spacing.sm }]}>
            No audit events yet
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: Spacing.md }}>
          {logs.map((log, i) => (
            <View key={log.id ?? i} style={{ flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md }}>
              <View style={{ alignItems: 'center', gap: 4 }}>
                <View style={{
                  width: 10, height: 10, borderRadius: 5,
                  backgroundColor: Colors.primary, marginTop: 4,
                }} />
                {i < logs.length - 1 ? (
                  <View style={{ width: 1, flex: 1, backgroundColor: Colors.border }} />
                ) : null}
              </View>
              <View style={{ flex: 1, paddingBottom: Spacing.sm }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.textPrimary }}>
                  {formatAction(log.action ?? '')}
                </Text>
                {log.actorEmail ? (
                  <Text style={{ fontSize: 12, color: Colors.textSecondary }}>{log.actorEmail}</Text>
                ) : null}
                <Text style={{ fontSize: 11, color: Colors.textSecondary, marginTop: 2 }}>
                  {fmtDate(log.createdAt)}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
