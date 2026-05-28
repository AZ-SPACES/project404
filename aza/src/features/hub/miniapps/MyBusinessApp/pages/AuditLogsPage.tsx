import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { Feather } from '@react-native-vector-icons/feather';
import { Typography, Spacing } from '../../../../../theme';
import { NavProps } from '../types';
import { extractData, fmtDate } from '../helpers';
import { getMerchantAuditLogs } from '../../../../../services/api';
import InternalHeader from '../components/InternalHeader';

function formatAction(action: string) {
  return action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AuditLogsPage({ goBack, Colors, styles }: NavProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMerchantAuditLogs(0, 40)
      .then((r: any) => setLogs(extractData(r)?.content ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
