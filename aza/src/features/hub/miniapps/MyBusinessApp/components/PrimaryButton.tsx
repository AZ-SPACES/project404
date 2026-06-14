import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, View } from 'react-native';
import { ThemeColors } from '../../../../../theme';
import { createStyles } from '../styles';

export default function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  icon,
  Colors,
  styles,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  Colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}) {
  const inactive = disabled || loading;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={inactive}
      activeOpacity={0.75}
      style={[styles.primaryBtn, inactive && { opacity: 0.45 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {loading ? (
        <ActivityIndicator size="small" color={Colors.secondary} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {icon}
          <Text style={styles.primaryBtnText}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
