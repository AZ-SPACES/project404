import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { ThemeColors, Spacing } from '../../../../../theme';
import { createStyles } from '../styles';

export default function PickerRow({
  label, options, optionLabels, value, onChange, Colors, styles,
}: {
  label: string; options: string[]; optionLabels: Record<string, string>;
  value: string; onChange: (v: string) => void;
  Colors: ThemeColors; styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={{ marginBottom: Spacing.md }}>
      <Text style={[styles.fieldLabel, { color: Colors.textSecondary }]}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm, paddingVertical: 4 }}>
        {options.map((opt) => {
          const active = value === opt;
          return (
            <TouchableOpacity
              key={opt}
              onPress={() => onChange(opt)}
              style={[styles.chip, active && { backgroundColor: Colors.primary, borderColor: Colors.primary }]}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
            >
              <Text style={[styles.chipText, { color: active ? Colors.secondary : Colors.textSecondary }]}>
                {optionLabels[opt] ?? opt}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
