import React from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Feather } from '@react-native-vector-icons/feather';
import { Typography, Spacing } from '../../../../../theme';
import { NavProps } from '../types';
import { extractData, fmtAmount, fmtDate } from '../helpers';
import { getMerchantCustomers } from '../../../../../services/api';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../../../lib/queryKeys';
import InternalHeader from '../components/InternalHeader';

export default function CustomersPage({ goBack, Colors, styles }: NavProps) {
  const { data: customers = [], isLoading: loading } = useQuery({
    queryKey: queryKeys.merchantCustomers(),
    queryFn: async () => { const r = await getMerchantCustomers(0, 30); return extractData(r)?.content ?? []; },
    staleTime: 60_000,
  });

  const initials = (name: string) =>
    name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();

  return (
    <View style={{ flex: 1 }}>
      <InternalHeader title="Customers" onBack={goBack} Colors={Colors} styles={styles} />

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : customers.length === 0 ? (
        <View style={styles.center}>
          <Feather name="users" size={36} color={Colors.textSecondary} />
          <Text style={[Typography.body as any, { color: Colors.textSecondary, marginTop: Spacing.sm }]}>
            No customers yet
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: Spacing.md }}>
          {customers.map((c: any) => (
            <View
              key={c.userId ?? c.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: Colors.border,
                backgroundColor: Colors.surface,
                borderRadius: 10,
                padding: Spacing.md,
                marginBottom: Spacing.xs,
                gap: Spacing.md,
              }}
            >
              <View style={{
                width: 40, height: 40, borderRadius: 20,
                backgroundColor: Colors.primary + '22',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.primary }}>
                  {initials(c.displayName ?? c.customerName ?? 'U')}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.textPrimary }}>
                  {c.displayName ?? c.customerName ?? 'Unknown'}
                </Text>
                {c.email ? (
                  <Text style={{ fontSize: 12, color: Colors.textSecondary }} numberOfLines={1}>{c.email}</Text>
                ) : null}
                <Text style={{ fontSize: 11, color: Colors.textSecondary, marginTop: 2 }}>
                  First payment: {fmtDate(c.firstPaymentAt)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.textPrimary }}>
                  {fmtAmount(c.totalSpend, c.currency)}
                </Text>
                <Text style={{ fontSize: 11, color: Colors.textSecondary }}>
                  {c.totalPayments ?? 0} payments
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
