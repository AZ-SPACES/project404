import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import { useQuery } from '@tanstack/react-query';
import { getFloatDistributions } from '../../../../../services/api';
import { queryKeys } from '../../../../../lib/queryKeys';
import { extractData, fmtAmount } from '../helpers';
import { NavProps } from '../types';

interface Distribution {
  transactionId: string;
  amount: number;
  superAgentFloatBalance?: number;
  targetAgentCode?: string | null;
  targetAgentName?: string | null;
}

export default function DistributionsPage({ goBack, Colors, styles }: NavProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.floatDistributions(),
    queryFn: () => getFloatDistributions(0, 50),
    staleTime: 30_000,
  });

  const page = data ? extractData(data) : null;
  const items: Distribution[] = page?.content ?? [];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={goBack}>
            <MaterialIcons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Float distributions</Text>
        </View>

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : isError ? (
          <Text style={styles.subtitle}>Couldn’t load distributions. Pull back and try again.</Text>
        ) : items.length === 0 ? (
          <Text style={styles.subtitle}>You haven’t distributed float to any agents yet.</Text>
        ) : (
          items.map((d) => (
            <View key={d.transactionId} style={styles.card}>
              <View style={styles.row}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <MaterialIcons name="north-east" size={18} color={Colors.primary} />
                  <Text style={styles.value}>Float sent</Text>
                </View>
                <Text style={styles.value}>{fmtAmount(d.amount)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>{d.targetAgentName ?? 'Agent'}</Text>
                <Text style={styles.label}>{d.targetAgentCode ?? ''}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
