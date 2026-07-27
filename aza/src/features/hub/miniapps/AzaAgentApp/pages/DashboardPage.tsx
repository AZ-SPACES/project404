import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import { fmtAmount } from '../helpers';
import { NavProps } from '../types';

export default function DashboardPage({ navigate, refresh, agent, Colors, styles }: NavProps) {
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Float balance</Text>
        <Text style={styles.balanceValue}>{fmtAmount(agent?.floatBalance)}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Commission earned (cash-in)</Text>
          <Text style={styles.value}>{fmtAmount(agent?.commissionAccruedGhs)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Tier</Text>
          <Text style={styles.value}>{agent?.tier ?? '—'}</Text>
        </View>
        {agent?.code ? (
          <View style={styles.row}>
            <Text style={styles.label}>Agent code</Text>
            <Text style={styles.value}>{agent.code}</Text>
          </View>
        ) : null}
        {agent?.floatLimit != null ? (
          <View style={styles.row}>
            <Text style={styles.label}>Float limit</Text>
            <Text style={styles.value}>{fmtAmount(agent.floatLimit)}</Text>
          </View>
        ) : null}
      </View>

      <TouchableOpacity style={styles.button} onPress={() => navigate('cash_in')}>
        <Text style={styles.buttonText}>Cash in (take a deposit)</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={() => navigate('redeem')}>
        <Text style={styles.secondaryButtonText}>Cash out (redeem a code)</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16 }}
        onPress={() => navigate('history')}>
        <MaterialIcons name="receipt-long" size={18} color={Colors.textSecondary} />
        <Text style={[styles.label, { marginLeft: 6 }]}>Transaction history</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20 }}
        onPress={refresh}>
        <MaterialIcons name="refresh" size={18} color={Colors.textSecondary} />
        <Text style={[styles.label, { marginLeft: 6 }]}>Refresh</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
