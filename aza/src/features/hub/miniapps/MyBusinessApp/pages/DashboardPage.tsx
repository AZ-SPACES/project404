import React from 'react';
import { ScrollView, View, Text, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Spacing } from '../../../../../theme';
import { NavProps, Page } from '../types';
import { fmtAmount } from '../helpers';
import { CATEGORY_LABELS } from '../constants';
import StatusBadge from '../components/StatusBadge';

export default function DashboardPage({ merchant, navigate, Colors, styles }: NavProps) {
  const feePercent = ((merchant?.feeRateBps ?? 150) / 100).toFixed(2);

  return (
    <ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
      {/* Balance card */}
      <View style={[styles.balanceCard, { backgroundColor: Colors.primary }]}>
        <Text style={[styles.balanceLabel, { color: Colors.secondary + 'BB' }]}>Merchant Balance</Text>
        <Text style={[styles.balanceAmount, { color: Colors.secondary }]}>
          {fmtAmount(merchant?.balance, merchant?.currency ?? 'GHS')}
        </Text>
        <View style={styles.balanceRow}>
          <View>
            <Text style={[styles.balanceSub, { color: Colors.secondary + 'BB' }]}>Total Volume</Text>
            <Text style={[styles.balanceSubVal, { color: Colors.secondary }]}>
              {fmtAmount(merchant?.totalVolume, merchant?.currency ?? 'GHS')}
            </Text>
          </View>
          <View>
            <Text style={[styles.balanceSub, { color: Colors.secondary + 'BB' }]}>Platform Fee</Text>
            <Text style={[styles.balanceSubVal, { color: Colors.secondary }]}>{feePercent}%</Text>
          </View>
        </View>
      </View>

      {/* Quick actions */}
      <Text style={[styles.sectionLabel, { color: Colors.textPrimary }]}>Quick Actions</Text>
      <View style={styles.actionGrid}>
        {[
          { icon: 'link', label: 'Payment Link', page: 'create_session' as Page },
          { icon: 'list', label: 'Transactions', page: 'sessions' as Page },
          { icon: 'download', label: 'Payouts', page: 'payouts' as Page },
        ].map(({ icon, label, page }) => (
          <TouchableOpacity
            key={page}
            style={[styles.actionCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
            onPress={() => navigate(page)}
            accessibilityRole="button"
          >
            <Feather name={icon as any} size={24} color={Colors.primary} />
            <Text style={[styles.actionLabel, { color: Colors.textPrimary }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Developer */}
      <Text style={[styles.sectionLabel, { color: Colors.textPrimary }]}>Developer</Text>
      <View style={styles.actionGrid}>
        {[
          { icon: 'key', label: 'API Keys', page: 'api_keys' as Page },
          { icon: 'zap', label: 'Webhooks', page: 'webhooks' as Page },
        ].map(({ icon, label, page }) => (
          <TouchableOpacity
            key={page}
            style={[styles.actionCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
            onPress={() => navigate(page)}
            accessibilityRole="button"
          >
            <Feather name={icon as any} size={24} color={Colors.primary} />
            <Text style={[styles.actionLabel, { color: Colors.textPrimary }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Business info */}
      <View style={[styles.infoCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
        <Text style={[styles.infoCardTitle, { color: Colors.textPrimary }]}>{merchant?.businessName}</Text>
        <Text style={[styles.infoCardHandle, { color: Colors.textSecondary }]}>@{merchant?.businessHandle}</Text>
        {merchant?.category && (
          <Text style={[styles.infoCardHandle, { color: Colors.textSecondary }]}>
            {CATEGORY_LABELS[merchant.category] ?? merchant.category}
          </Text>
        )}
        <View style={{ marginTop: Spacing.sm }}>
          <StatusBadge status={merchant?.status ?? 'ACTIVE'} Colors={Colors} />
        </View>
      </View>
    </ScrollView>
  );
}
