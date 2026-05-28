import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { Feather } from '@react-native-vector-icons/feather';
import { Typography, Spacing } from '../../../../../theme';
import { NavProps } from '../types';
import { extractData, fmtAmount, fmtDate } from '../helpers';
import { getMerchantDisputes } from '../../../../../services/api';
import InternalHeader from '../components/InternalHeader';
import StatusBadge from '../components/StatusBadge';

export default function DisputesPage({ goBack, Colors, styles }: NavProps) {
  const [disputes, setDisputes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMerchantDisputes(0, 30)
      .then((r: any) => setDisputes(extractData(r)?.content ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <InternalHeader title="Disputes" onBack={goBack} Colors={Colors} styles={styles} />

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : disputes.length === 0 ? (
        <View style={styles.center}>
          <Feather name="shield" size={36} color={Colors.textSecondary} />
          <Text style={[Typography.body as any, { color: Colors.textSecondary, marginTop: Spacing.sm }]}>
            No disputes — great!
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: Spacing.md }}>
          {disputes.map((d) => (
            <View
              key={d.id}
              style={{
                borderWidth: 1,
                borderColor: Colors.border,
                backgroundColor: Colors.surface,
                borderRadius: 10,
                padding: Spacing.md,
                marginBottom: Spacing.xs,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.textPrimary }}>
                  {fmtAmount(d.amount, d.currency)}
                </Text>
                <StatusBadge status={d.status} Colors={Colors} />
              </View>
              {d.reason ? (
                <Text style={{ fontSize: 13, color: Colors.textSecondary, marginBottom: Spacing.xs }} numberOfLines={2}>
                  {d.reason}
                </Text>
              ) : null}
              <Text style={{ fontSize: 11, color: Colors.textSecondary }}>
                Opened: {fmtDate(d.createdAt)}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
