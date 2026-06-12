import React from 'react';
import { ThemeColors } from '../../../../../theme';
import { createStyles } from '../styles';
import Button from '../../../../../components/ui/Button';

export default function PrimaryButton({
  label, onPress, disabled, loading, Colors, styles,
}: {
  label: string; onPress: () => void; disabled?: boolean; loading?: boolean;
  Colors: ThemeColors; styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Button
      title={label}
      onPress={onPress}
      disabled={disabled ?? false}
      loading={loading ?? false}
      style={[styles.primaryBtn, (disabled || loading) ? { opacity: 0.45 } : {}]}
      backgroundColor="transparent"
      textColor={Colors.secondary}
      textStyle={styles.primaryBtnText}
      accessibilityRole="button"
      accessibilityLabel={label}
    />
  );
}
