import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing } from '../../../theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';

type SendAmountScreenProps = NativeStackScreenProps<RootStackParamList, 'SendAmount'>;

export default function SendAmountScreen({ navigation, route }: SendAmountScreenProps) {
  const { name, username, avatar } = route.params;
  const [amount, setAmount] = useState('0.00');
  const [note, setNote] = useState('');
  const amountInputRef = useRef<TextInput>(null);

  const numericAmount = parseFloat(amount) || 0;

  const handleAmountChange = (text: string) => {
    // Allow only digits and a single decimal point
    const cleaned = text.replace(/[^0-9.]/g, '');

    // Reject multiple decimal points
    if ((cleaned.match(/\./g) || []).length > 1) return;

    // If there's a decimal, allow at most 2 digits after it
    const dotIndex = cleaned.indexOf('.');
    if (dotIndex !== -1 && cleaned.length - dotIndex - 1 > 2) return;

    // Cap integer part at 8 digits (99,999,999.99)
    const intPart = dotIndex !== -1 ? cleaned.slice(0, dotIndex) : cleaned;
    if (intPart.length > 8) return;

    setAmount(cleaned);
  };

  const handleAmountFocus = () => {
    if (amount === '0.00') {
      setAmount('');
    }
  };

  const handleAmountBlur = () => {
    if (amount === '' || amount === '.') {
      setAmount('0.00');
      return;
    }

    // Format to exactly 2 decimal places
    const num = parseFloat(amount);
    if (isNaN(num)) {
      setAmount('0.00');
      return;
    }
    setAmount(num.toFixed(2));
  };

  const handleSend = () => {
    if (numericAmount <= 0) return;
    // Handle send logic
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.flex}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={styles.backButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="chevron-left" size={24} color={Colors.textPrimary} style={styles.backicon} />
              </TouchableOpacity>

              <View style={styles.headerCenter}>
                <Text style={styles.headerName}>{name}</Text>
                <Text style={styles.headerUsername}>{username}</Text>
              </View>

              <Image source={{ uri: avatar }} style={styles.headerAvatar} />
            </View>

            {/* Amount Section */}
            <View style={styles.amountSection}>
              <TouchableOpacity
                style={styles.amountRow}
                activeOpacity={1}
                onPress={() => amountInputRef.current?.focus()}
              >
                <Text style={styles.currencySymbol}>GH¢ </Text>
                <TextInput
                  ref={amountInputRef}
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={handleAmountChange}
                  onFocus={handleAmountFocus}
                  onBlur={handleAmountBlur}
                  keyboardType="decimal-pad"
                  selectionColor={Colors.primary}
                />
              </TouchableOpacity>
              <Text style={styles.noFees}>No fees</Text>
            </View>

            {/* Spacer */}
            <View style={styles.flex} />

            {/* Note Input */}
            <View style={styles.noteContainer}>
              <View style={styles.noteInputRow}>
                <Feather
                  name="edit-3"
                  size={18}
                  color={Colors.textSecondary}
                  style={styles.noteIcon}
                />
                <TextInput
                  style={styles.noteInput}
                  placeholder="Add Note"
                  placeholderTextColor={Colors.textSecondary}
                  value={note}
                  onChangeText={setNote}
                />
              </View>
            </View>

            {/* Send Button */}
            <TouchableOpacity
              style={[
                styles.sendButton,
                numericAmount <= 0 && styles.sendButtonDisabled,
              ]}
              activeOpacity={0.7}
              onPress={handleSend}
              disabled={numericAmount <= 0}
            >
              <Text style={styles.sendButtonText}>Send</Text>
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const AVATAR_SIZE = 40;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 50,
    backgroundColor: 'rgba(22,51,0,0.07)',
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backicon: {
    fontSize: 28,
    color: Colors.textPrimary,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerName: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  headerUsername: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  headerAvatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: Colors.surface,
  },
  amountSection: {
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  currencySymbol: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  amountInput: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textPrimary,
    padding: 0,
    minWidth: 60,
  },
  noFees: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  noteContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  noteInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  noteIcon: {
    marginRight: Spacing.sm,
  },
  noteInput: {
    flex: 1,
    ...Typography.body,
    color: Colors.textPrimary,
    padding: 0,
  },
  sendButton: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    ...Typography.button,
    color: Colors.white,
  },
});
