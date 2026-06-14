import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Feather } from '@react-native-vector-icons/feather';
import { ThemeColors } from '../../../../../theme';
import { createStyles } from '../styles';

export default function InternalHeader({
  title,
  subtitle,
  onBack,
  right,
  Colors,
  styles,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  right?: React.ReactNode;
  Colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.internalHeader}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.65}>
        <Feather name="arrow-left" size={18} color={Colors.textPrimary} />
      </TouchableOpacity>

      <View style={{ flex: 1 }}>
        <Text style={styles.internalHeaderTitle} numberOfLines={1}>{title}</Text>
        {subtitle ? (
          <Text style={styles.internalHeaderSubtitle} numberOfLines={1}>{subtitle}</Text>
        ) : null}
      </View>

      {right ? (
        <View>{right}</View>
      ) : (
        <View style={{ width: 36 }} />
      )}
    </View>
  );
}
