import React from 'react';
import { View, Text } from 'react-native';
import { ThemeColors, Radius } from '../../../../../theme';
import { STATUS_COLORS } from '../constants';
import { statusLabel } from '../helpers';

export default function StatusBadge({ status, Colors }: { status: string; Colors: ThemeColors }) {
  const color = STATUS_COLORS[status] ?? '#757575';
  return (
    <View style={{ backgroundColor: color + '22', borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 3 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color }}>{statusLabel(status)}</Text>
    </View>
  );
}
