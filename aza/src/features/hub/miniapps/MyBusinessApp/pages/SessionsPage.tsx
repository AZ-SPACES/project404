import React, { useState, useEffect } from 'react';
import { View, ScrollView, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Typography, Spacing } from '../../../../../theme';
import { NavProps } from '../types';
import { extractData, fmtAmount, fmtDate } from '../helpers';
import { getMerchantSessions } from '../../../../../services/api';
import InternalHeader from '../components/InternalHeader';
import StatusBadge from '../components/StatusBadge';

export default function SessionsPage({ navigate, goBack, Colors, styles }: NavProps) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMerchantSessions(0, 30)
      .then((r: any) => setSessions(extractData(r)?.content ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <InternalHeader title="Transactions" onBack={goBack} Colors={Colors} styles={styles} />
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : sessions.length === 0 ? (
        <View style={styles.center}>
          <Feather name="inbox" size={36} color={Colors.textSecondary} />
          <Text style={[Typography.body as any, { color: Colors.textSecondary, marginTop: Spacing.sm }]}>No transactions yet</Text>
          <TouchableOpacity style={{ marginTop: Spacing.md }} onPress={() => navigate('create_session')}>
            <Text style={{ color: Colors.primary, fontWeight: '600' }}>Create Payment Link</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: Spacing.md }}>
          {sessions.map((s) => (
            <View key={s.id} style={[styles.sessionRow, { borderColor: Colors.border, backgroundColor: Colors.surface }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sessionAmount, { color: Colors.textPrimary }]}>
                  {fmtAmount(s.amount, s.currency)}
                </Text>
                <Text style={[styles.sessionDesc, { color: Colors.textSecondary }]} numberOfLines={1}>
                  {s.description ?? 'Payment'}
                </Text>
                <Text style={[styles.sessionDate, { color: Colors.textSecondary }]}>{fmtDate(s.createdAt)}</Text>
              </View>
              <StatusBadge status={s.status} Colors={Colors} />
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
