import React, { memo, useState, useCallback } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@react-native-vector-icons/feather';
import { useAppTheme, Typography, Spacing, Radius } from '../../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreate: (question: string, options: string[]) => void;
};

export const PollCreatorSheet = memo(function PollCreatorSheet({ visible, onClose, onCreate }: Props) {
  const { colors: Colors, isDark } = useAppTheme();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);

  const handleAddOption = useCallback(() => {
    if (options.length < 4) setOptions((o) => [...o, '']);
  }, [options.length]);

  const handleOptionChange = useCallback((text: string, index: number) => {
    setOptions((o) => o.map((v, i) => (i === index ? text : v)));
  }, []);

  const handleRemoveOption = useCallback((index: number) => {
    if (options.length <= 2) return;
    setOptions((o) => o.filter((_, i) => i !== index));
  }, [options.length]);

  const nonEmpty = options.filter((o) => o.trim()).length;
  const canCreate = question.trim().length > 0 && nonEmpty >= 2;

  const handleCreate = useCallback(() => {
    if (!canCreate) return;
    const validOptions = options.filter((o) => o.trim());
    onCreate(question.trim(), validOptions);
    setQuestion('');
    setOptions(['', '']);
    onClose();
  }, [canCreate, question, options, onCreate, onClose]);

  const handleClose = useCallback(() => {
    setQuestion('');
    setOptions(['', '']);
    onClose();
  }, [onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <BlurView intensity={30} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: 'flex-end' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.sheet, { backgroundColor: isDark ? '#1a1a1a' : '#fff' }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: Colors.textPrimary }]}>Create Poll</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            <Text style={[styles.label, { color: Colors.textSecondary }]}>Question</Text>
            <TextInput
              style={[styles.questionInput, { color: Colors.textPrimary, borderColor: Colors.border, backgroundColor: isDark ? Colors.surface : '#F9FAFB' }]}
              placeholder="Ask a question…"
              placeholderTextColor={Colors.textSecondary}
              value={question}
              onChangeText={setQuestion}
              multiline
              maxLength={200}
            />

            <Text style={[styles.label, { color: Colors.textSecondary, marginTop: Spacing.lg }]}>Options</Text>
            {options.map((opt, i) => (
              <View key={i} style={styles.optionRow}>
                <TextInput
                  style={[styles.optionInput, { color: Colors.textPrimary, borderColor: Colors.border, backgroundColor: isDark ? Colors.surface : '#F9FAFB' }]}
                  placeholder={`Option ${i + 1}`}
                  placeholderTextColor={Colors.textSecondary}
                  value={opt}
                  onChangeText={(t) => handleOptionChange(t, i)}
                  maxLength={80}
                />
                {options.length > 2 && (
                  <TouchableOpacity onPress={() => handleRemoveOption(i)} style={styles.removeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Feather name="minus-circle" size={20} color="#EF4444" />
                  </TouchableOpacity>
                )}
              </View>
            ))}

            {options.length < 4 && (
              <TouchableOpacity style={[styles.addOptionBtn, { borderColor: Colors.primary }]} onPress={handleAddOption} activeOpacity={0.75}>
                <Feather name="plus" size={16} color={Colors.primary} />
                <Text style={[styles.addOptionText, { color: Colors.primary }]}>Add option</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.createBtn, { backgroundColor: canCreate ? Colors.primary : Colors.border }]}
              onPress={handleCreate}
              activeOpacity={0.85}
              disabled={!canCreate}
            >
              <Text style={[styles.createBtnText, { color: canCreate ? '#fff' : Colors.textSecondary }]}>
                Create Poll
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
});

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  title: { fontSize: 17, fontWeight: '700' },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  label: { ...Typography.caption, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  questionInput: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 56,
    textAlignVertical: 'top',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  optionInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  removeBtn: { padding: 4 },
  addOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderStyle: 'dashed',
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  addOptionText: { fontSize: 14, fontWeight: '500' },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    paddingTop: Spacing.sm,
  },
  createBtn: {
    borderRadius: Radius.full,
    paddingVertical: 14,
    alignItems: 'center',
  },
  createBtnText: { fontSize: 16, fontWeight: '700' },
});
