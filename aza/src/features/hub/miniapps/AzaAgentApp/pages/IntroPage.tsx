import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import { applyAgent } from '../../../../../services/api';
import { errorMessage } from '../helpers';
import { NavProps } from '../types';

export default function IntroPage({ refresh, Colors, styles }: NavProps) {
  const [businessName, setBusinessName] = useState('');
  const [location, setLocation] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [expectedVolume, setExpectedVolume] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const apply = async () => {
    if (!businessName.trim()) {
      Alert.alert('Business name required', 'Enter your business or trading name to continue.');
      return;
    }
    setSubmitting(true);
    try {
      const volume = parseFloat(expectedVolume.replace(/,/g, ''));
      const payload: Parameters<typeof applyAgent>[0] = {};
      if (businessName.trim()) payload.businessName = businessName.trim();
      if (location.trim()) payload.location = location.trim();
      if (contactPhone.trim()) payload.contactPhone = contactPhone.trim();
      if (idNumber.trim()) payload.idNumber = idNumber.trim();
      if (Number.isFinite(volume) && volume > 0) payload.expectedMonthlyVolumeGhs = volume;
      if (notes.trim()) payload.applicationNotes = notes.trim();
      await applyAgent(payload);
      refresh();
      Alert.alert('Application submitted', 'We will review your application and notify you.');
    } catch (e) {
      Alert.alert('Could not apply', errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
      <View style={{ alignItems: 'center', marginVertical: 12 }}>
        <MaterialIcons name="storefront" size={48} color={Colors.primary} />
      </View>
      <Text style={styles.title}>Become an AZA Agent</Text>
      <Text style={styles.subtitle}>
        Help people turn cash into wallet balance and back. Earn a commission on every deposit and
        withdrawal you handle.
      </Text>

      <Text style={styles.inputLabel}>Business / trading name</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Adwoa Mobile Money"
        placeholderTextColor={Colors.textSecondary}
        value={businessName}
        onChangeText={setBusinessName}
      />

      <Text style={styles.inputLabel}>Where will you operate? (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Kumasi Central Market"
        placeholderTextColor={Colors.textSecondary}
        value={location}
        onChangeText={setLocation}
      />

      <Text style={styles.inputLabel}>Contact phone for your till (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 024 123 4567"
        placeholderTextColor={Colors.textSecondary}
        value={contactPhone}
        onChangeText={setContactPhone}
        keyboardType="phone-pad"
      />

      <Text style={styles.inputLabel}>Ghana Card number (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="GHA-XXXXXXXXX-X"
        placeholderTextColor={Colors.textSecondary}
        value={idNumber}
        onChangeText={setIdNumber}
        autoCapitalize="characters"
      />

      <Text style={styles.inputLabel}>Expected monthly cash volume in GHS (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 50000"
        placeholderTextColor={Colors.textSecondary}
        value={expectedVolume}
        onChangeText={setExpectedVolume}
        keyboardType="numeric"
      />

      <Text style={styles.inputLabel}>Anything else we should know? (optional)</Text>
      <TextInput
        style={[styles.input, { height: 88, textAlignVertical: 'top' }]}
        placeholder="Tell us about your experience or business"
        placeholderTextColor={Colors.textSecondary}
        value={notes}
        onChangeText={setNotes}
        multiline
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
