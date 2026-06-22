import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import { useQuery } from '@tanstack/react-query';
import { getAgentTransactions } from '../../../../../services/api';
import { queryKeys } from '../../../../../lib/queryKeys';
import { extractData, fmtAmount } from '../helpers';
import { NavProps } from '../types';

interface AgentTransaction {
  id: string;
  type: 'CASH_IN' | 'CASH_OUT';
  amount: number;
  fee: number;
  counterpartyName?: string | null;
  createdAt?: string | null;
}

function fmtWhen(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('en-GH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function HistoryPage({ goBack, Colors, styles }: NavProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.agentTransactions(),
    queryFn: () => getAgentTransactions(0, 50),
    staleTime: 30_000,
  });

  const page = data ? extractData(data) : null;
  const items: AgentTransaction[] = page?.content ?? [];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={goBack}>
            <MaterialIcons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Transaction history</Text>
        </View>

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : isError ? (
          <Text style={styles.subtitle}>Couldn’t load your history. Pull back and try again.</Text>
        ) : items.length === 0 ? (
          <Text style={styles.subtitle}>No cash-ins or cash-outs yet.</Text>
        ) : (
          items.map((t) => {
            const cashIn = t.type === 'CASH_IN';
            return (
              <View key={t.id} style={styles.card}>
                <View style={styles.row}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <MaterialIcons
                      name={cashIn ? 'south-west' : 'north-east'}
                      size={18}
                      color={cashIn ? (Colors.error || '#D1222E') : Colors.primary}
                    />
                    <Text style={styles.value}>{cashIn ? 'Cash in' : 'Cash out'}</Text>
                  </View>
                  <Text style={styles.value}>{fmtAmount(t.amount)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>{t.counterpartyName ?? 'Customer'}</Text>
                  <Text style={styles.label}>{fmtWhen(t.createdAt)}</Text>
                </View>
                {t.fee > 0 ? (
                  <View style={styles.row}>
                    <Text style={styles.label}>Fee</Text>
                    <Text style={styles.label}>{fmtAmount(t.fee)}</Text>
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
