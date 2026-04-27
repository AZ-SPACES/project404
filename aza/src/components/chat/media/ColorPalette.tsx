import React, { memo, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';

const COLORS = [
  '#FFFFFF',
  '#000000',
  '#EF4444',
  '#F97316',
  '#FACC15',
  '#22C55E',
  '#06B6D4',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#A3A3A3',
  '#174717',
];

type ColorPaletteProps = {
  selectedColor: string;
  onSelectColor: (color: string) => void;
};

function ColorPaletteInner({ selectedColor, onSelectColor }: ColorPaletteProps) {
  const handlePress = useCallback(
    (color: string) => () => onSelectColor(color),
    [onSelectColor],
  );

  return (
    <View style={styles.container}>
      {COLORS.map(color => {
        const isActive = selectedColor === color;
        return (
          <TouchableOpacity
            key={color}
            style={[styles.swatch, isActive && styles.swatchActive]}
            onPress={handlePress(color)}
            activeOpacity={0.7}
            accessibilityLabel={`Select color ${color}`}
          >
            <View
              style={[
                styles.swatchInner,
                { backgroundColor: color },
                color === '#FFFFFF' && styles.whiteBorder,
              ]}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export const ColorPalette = memo(ColorPaletteInner);

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 12,
    top: '20%',
    alignItems: 'center',
    gap: 6,
    zIndex: 20,
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchActive: {
    borderColor: '#fff',
  },
  swatchInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  whiteBorder: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
});
