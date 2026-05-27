import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Typography, Spacing } from '../../../../../theme';
import { NavProps } from '../types';
import { extractData, fmtAmount, fmtDate } from '../helpers';
import { getMerchantSettlements } from '../../../../../services/api';
import InternalHeader from '../components/InternalHeader';

export default function SettlementsPage({ goBack, Colors, styles }: NavProps) {
  const [settlements, setSettlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMerchantSettlements(0, 30)
      .then((r: any) => setSettlements(extractData(r)?.content ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <InternalHeader title="Settlements" onBack={goBack} Colors={Colors} styles={styles} />

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : settlements.length === 0 ? (
        <View style={styles.center}>
          <Feather name="trending-up" size={36} color={Colors.textSecondary} />
          <Text style={[Typography.body as any, { color: Colors.textSecondary, marginTop: Spacing.sm }]}>
            No settlements yet
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: Spacing.md }}>
          {settlements.map((s) => (
            <View
              key={s.id}
              style={{
                borderWidth: 1,
                borderColor: Colors.border,
                backgroundColor: Colors.surface,
                borderRadius: 10,
                padding: Spacing.md,
                marginBottom: Spacing.xs,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.textPrimary }}>
                    {fmtAmount(s.netAmount, s.currency)}
                  </Text>
                  <Text style={{ fontSize: 11, color: Colors.textSecondary, marginTop: 2 }}>
                    {s.transactionCount ?? 0} transactions · Fee: {fmtAmount(s.feeAmount, s.currency)}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 12, color: Colors.primary, fontWeight: '600' }}>Settled</Text>
                  <Text style={{ fontSize: 11, color: Colors.textSecondary }}>{fmtDate(s.settledAt)}</Text>
                </View>
              </View>
              {(s.periodStart || s.periodEnd) ? (
                <Text style={{ fontSize: 11, color: Colors.textSecondary, marginTop: Spacing.xs }}>
                  Period: {fmtDate(s.periodStart)} – {fmtDate(s.periodEnd)}
                </Text>
              ) : null}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
