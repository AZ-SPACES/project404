import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ThemeColors } from '../../../../../theme';
import { createStyles } from '../styles';

export default function InternalHeader({
  title,
  onBack,
  Colors,
  styles,
}: {
  title: string;
  onBack: () => void;
  Colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.internalHeader}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
        <Feather name="arrow-left" size={22} color={Colors.textPrimary} />
      </TouchableOpacity>
      <Text style={[styles.internalHeaderTitle, { color: Colors.textPrimary }]}>{title}</Text>
      <View style={styles.backBtn} />
    </View>
  );
}
