import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import { applyAgent } from '../../../../../services/api';
import { errorMessage } from '../helpers';
import { NavProps } from '../types';

export default function IntroPage({ refresh, Colors, styles }: NavProps) {
  const [location, setLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const apply = async () => {
    setSubmitting(true);
    try {
      const trimmed = location.trim();
      await applyAgent(trimmed ? { location: trimmed } : {});
      refresh();
      Alert.alert('Application submitted', 'We will review your application and notify you.');
    } catch (e) {
      Alert.alert('Could not apply', errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={{ alignItems: 'center', marginVertical: 12 }}>
        <MaterialIcons name="storefront" size={48} color={Colors.primary} />
      </View>
      <Text style={styles.title}>Become an AZA Agent</Text>
      <Text style={styles.subtitle}>
        Help people turn cash into wallet balance and back. Earn a commission on every deposit and
        withdrawal you handle.
      </Text>

      <Text style={styles.inputLabel}>Where will you operate? (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Kumasi Central Market"
        placeholderTextColor={Colors.textSecondary}
        value={location}
        onChangeText={setLocation}
      />

      <TouchableOpacity
        style={[styles.button, submitting && styles.buttonDisabled]}
        onPress={apply}
        disabled={submitting}>
        <Text style={styles.buttonText}>{submitting ? 'Submitting…' : 'Apply to become an agent'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
