import React, { useState } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator, TouchableOpacity,
  Modal, StyleSheet,
} from 'react-native';
import { Feather } from '@react-native-vector-icons/feather';
import { Typography, Spacing } from '../../../../../theme';
import { NavProps } from '../types';
import { extractData, fmtAmount, fmtDate } from '../helpers';
import { getMerchantCustomers, getCustomerSessions } from '../../../../../services/api';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../../../lib/queryKeys';
import InternalHeader from '../components/InternalHeader';

const SESSION_COLOR: Record<string, string> = {
  COMPLETED: '#B7EE7A',
  PENDING: '#F59E0B',
  CANCELLED: '#F87171',
  EXPIRED: '#6B7280',
};

function CustomerDetail({ customer, visible, onClose, Colors }: {
  customer: any; visible: boolean; onClose: () => void; Colors: any;
}) {
  const [page, setPage] = useState(0);

  const { data: sessionsPage, isLoading } = useQuery({
    queryKey: ['customer-sessions', customer?.userId ?? customer?.id, page],
    queryFn: async () => {
      const r = await getCustomerSessions(customer.userId ?? customer.id, page, 10);
      return extractData(r);
    },
    enabled: visible && !!(customer?.userId ?? customer?.id),
    staleTime: 30_000,
  });

  const sessions = sessionsPage?.content ?? [];
  const initials = (name: string) =>
    (name ?? 'U').split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <View style={sty.overlay}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
        <View style={[sty.sheet, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
          {/* Handle */}
          <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 6 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border }} />
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: Colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary + '22', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.primary }}>
                  {initials(customer?.displayName ?? customer?.customerName)}
                </Text>
              </View>
              <View>
                <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.textPrimary }}>
                  {customer?.displayName ?? customer?.customerName ?? 'Unknown'}
                </Text>
                {customer?.email ? <Text style={{ fontSize: 12, color: Colors.textSecondary }}>{customer.email}</Text> : null}
              </View>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20 }}>
            {/* Stats */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
              <View style={[sty.statBox, { backgroundColor: Colors.background, flex: 1 }]}>
                <Text style={{ fontSize: 10, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Total Spent</Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.primary }}>{fmtAmount(customer?.totalSpend, customer?.currency)}</Text>
              </View>
              <View style={[sty.statBox, { backgroundColor: Colors.background, flex: 1 }]}>
                <Text style={{ fontSize: 10, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Payments</Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.textPrimary }}>{customer?.totalPayments ?? 0}</Text>
              </View>
            </View>
            <View style={[sty.statBox, { backgroundColor: Colors.background, marginBottom: 20 }]}>
              <Text style={{ fontSize: 10, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>First Payment</Text>
              <Text style={{ fontSize: 13, color: Colors.textPrimary }}>{fmtDate(customer?.firstPaymentAt)}</Text>
            </View>

            {/* Transaction history */}
            <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.textPrimary, marginBottom: 10 }}>Payment History</Text>

            {isLoading ? (
              <ActivityIndicator color={Colors.primary} />
            ) : sessions.length === 0 ? (
              <Text style={{ color: Colors.textSecondary, fontSize: 13, textAlign: 'center', paddingVertical: 12 }}>No transactions yet</Text>
            ) : (
              <>
                {sessions.map((s: any) => (
                  <View
                    key={s.id}
                    style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: Colors.border }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '500', color: Colors.textPrimary }} numberOfLines={1}>
                        {s.description ?? s.referenceId ?? s.id.slice(0, 8).toUpperCase()}
                      </Text>
                      <Text style={{ fontSize: 11, color: Colors.textSecondary }}>{fmtDate(s.createdAt)}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.textPrimary }}>{fmtAmount(s.amount, s.currency)}</Text>
                      <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99, backgroundColor: (SESSION_COLOR[s.status] ?? '#6B7280') + '22' }}>
                        <Text style={{ fontSize: 10, fontWeight: '600', color: SESSION_COLOR[s.status] ?? '#6B7280' }}>{s.status}</Text>
                      </View>
                    </View>
                  </View>
                ))}

                {(sessionsPage?.totalPages ?? 1) > 1 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
                    <TouchableOpacity
                      disabled={page === 0}
                      onPress={() => setPage(p => Math.max(0, p - 1))}
                      style={{ opacity: page === 0 ? 0.3 : 1 }}
                    >
                      <Feather name="chevron-left" size={20} color={Colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 12, color: Colors.textSecondary }}>
                      Page {(sessionsPage?.number ?? 0) + 1} of {sessionsPage?.totalPages}
                    </Text>
                    <TouchableOpacity
                      disabled={page >= (sessionsPage?.totalPages ?? 1) - 1}
                      onPress={() => setPage(p => p + 1)}
                      style={{ opacity: page >= (sessionsPage?.totalPages ?? 1) - 1 ? 0.3 : 1 }}
                    >
                      <Feather name="chevron-right" size={20} color={Colors.textPrimary} />
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function CustomersPage({ goBack, Colors, styles }: NavProps) {
  const [selected, setSelected] = useState<any | null>(null);

  const { data: customers = [], isLoading: loading } = useQuery({
    queryKey: queryKeys.merchantCustomers(),
    queryFn: async () => { const r = await getMerchantCustomers(0, 30); return extractData(r)?.content ?? []; },
    staleTime: 60_000,
  });

  const initials = (name: string) =>
    (name ?? 'U').split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();

  return (
    <View style={{ flex: 1 }}>
      <InternalHeader title="Customers" onBack={goBack} Colors={Colors} styles={styles} />

      {selected && (
        <CustomerDetail
          customer={selected}
          visible
          onClose={() => setSelected(null)}
          Colors={Colors}
        />
      )}

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
            <TouchableOpacity
              key={c.userId ?? c.id}
              onPress={() => setSelected(c)}
              activeOpacity={0.7}
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
                <Feather name="chevron-right" size={14} color={Colors.textSecondary} style={{ marginTop: 4 }} />
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const sty = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, maxHeight: '88%' },
  statBox: { borderRadius: 12, padding: 12 },
});
