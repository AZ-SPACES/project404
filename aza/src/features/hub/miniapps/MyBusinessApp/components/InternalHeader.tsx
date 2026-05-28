import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Feather } from '@react-native-vector-icons/feather';
import { ThemeColors } from '../../../../../theme';
import { createStyles } from '../styles';
import { BackButton } from '../../../../../components/ui/BackButton';

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
      <BackButton onPress={onBack} />
      <Text style={[styles.internalHeaderTitle, { color: Colors.textPrimary }]}>{title}</Text>
      <View style={styles.backBtn} />
    </View>
  );
}
