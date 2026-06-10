import React from 'react';
import { View, Text, TextInput } from 'react-native';
import { ThemeColors, Spacing } from '../../../../../theme';
import { createStyles } from '../styles';

export default function FieldInput({
  label, value, onChangeText, placeholder, keyboardType, secureTextEntry, multiline, Colors, styles,
}: {
  label: string; value: string; onChangeText: (v: string) => void; placeholder?: string;
  keyboardType?: any; secureTextEntry?: boolean; multiline?: boolean;
  Colors: ThemeColors; styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={{ marginBottom: Spacing.md }}>
      <Text style={[styles.fieldLabel, { color: Colors.textSecondary }]}>{label}</Text>
      <TextInput
        underlineColorAndroid="transparent"
        style={[styles.fieldInput, { color: Colors.textPrimary, borderColor: Colors.border, backgroundColor: Colors.surface }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textSecondary}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}
