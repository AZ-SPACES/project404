import React, { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { ThemeColors } from '../../../../../theme';
import { createStyles } from '../styles';

export default function FieldInput({
  label,
  hint,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secureTextEntry,
  multiline,
  Colors,
  styles,
}: {
  label: string;
  hint?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: any;
  secureTextEntry?: boolean;
  multiline?: boolean;
  Colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        underlineColorAndroid="transparent"
        style={[
          styles.fieldInput,
          focused && { borderColor: Colors.primary + '80' },
          multiline && { minHeight: 88, textAlignVertical: 'top', paddingTop: 13 },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textSecondary + '60'}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        autoCapitalize="none"
        autoCorrect={false}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}
