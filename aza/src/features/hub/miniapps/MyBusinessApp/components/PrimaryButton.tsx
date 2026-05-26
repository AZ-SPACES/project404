import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { ThemeColors } from '../../../../../theme';
import { createStyles } from '../styles';

export default function PrimaryButton({
  label, onPress, disabled, loading, Colors, styles,
}: {
  label: string; onPress: () => void; disabled?: boolean; loading?: boolean;
  Colors: ThemeColors; styles: ReturnType<typeof createStyles>;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.primaryBtn, (disabled || loading) && { opacity: 0.45 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {loading
        ? <ActivityIndicator color={Colors.secondary} />
        : <Text style={[styles.primaryBtnText, { color: Colors.secondary }]}>{label}</Text>}
    </TouchableOpacity>
  );
}
