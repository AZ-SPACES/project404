import React from 'react';
import { View, Text } from 'react-native';
import { ThemeColors } from '../../../../../theme';
import { STATUS_COLORS } from '../constants';
import { statusLabel } from '../helpers';

const STATUS_DOTS: Record<string, string> = {
  COMPLETED: '#4ADE80',
  ACTIVE: '#4ADE80',
  KYB_SUBMITTED: '#60A5FA',
  KYB_UNDER_REVIEW: '#60A5FA',
  PENDING: '#FBBF24',
  PENDING_KYB: '#FBBF24',
  MORE_INFO_REQUIRED: '#FB923C',
  PAUSED: '#FBBF24',
  EXPIRED: '#9CA3AF',
  REVOKED: '#9CA3AF',
  CANCELLED: '#F87171',
  SUSPENDED: '#F87171',
  REJECTED: '#F87171',
  REFUNDED: '#C084FC',
};

export default function StatusBadge({ status, Colors }: { status: string; Colors: ThemeColors }) {
  const dotColor = STATUS_DOTS[status] ?? STATUS_COLORS[status] ?? '#9CA3AF';
  const bg = dotColor + '18';
  const border = dotColor + '30';

  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 99,
      backgroundColor: bg,
      borderWidth: 1,
      borderColor: border,
    }}>
      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: dotColor }} />
      <Text style={{ fontSize: 11, fontWeight: '600', color: dotColor, letterSpacing: 0.1 }}>
        {statusLabel(status)}
      </Text>
    </View>
  );
}
