import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native';
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../theme';
import { useToast } from '../../providers/ToastProvider';
import { submitFeedback } from '../../services/api';
import Button from './Button';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Where the feedback was given, e.g. "SPENDING_SUMMARY". */
  context?: string;
};

const RATING_LABELS = ['', 'Terrible', 'Poor', 'Okay', 'Good', 'Great'];

export default function FeedbackSheet({ visible, onClose, context }: Props) {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const { showToast } = useToast();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => { setRating(0); setComment(''); setSubmitting(false); };

  const close = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    if (rating < 1) return;
    setSubmitting(true);
    try {
      await submitFeedback(rating, comment.trim() || undefined, context);
      showToast('Thanks for your feedback!', 'success');
      close();
    } catch {
      showToast('Could not send feedback. Please try again.', 'error');
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={styles.overlay} onPress={close}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.handle} />

            <Text style={styles.title}>How was your experience?</Text>
            <Text style={styles.subtitle}>Your feedback helps us improve.</Text>

            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity
                  key={n}
                  onPress={() => setRating(n)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  activeOpacity={0.7}
                >
                  <MaterialIcons
                    name={n <= rating ? 'star' : 'star-border'}
                    size={40}
                    color={n <= rating ? '#F59E0B' : Colors.border}
                  />
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.ratingLabel}>{RATING_LABELS[rating] || ' '}</Text>

            <TextInput
              style={styles.input}
              placeholder="Tell us more (optional)"
              placeholderTextColor={Colors.textSecondary}
              value={comment}
              onChangeText={setComment}
              multiline
              maxLength={2000}
              textAlignVertical="top"
            />

            <Button
              title="Submit feedback"
              onPress={handleSubmit}
              backgroundColor={Colors.primary}
              textColor={Colors.secondary}
              borderRadius={Radius.sm}
              paddingVertical={16}
              fontSize={Typography.button.fontSize}
              fontWeight={Typography.button.fontWeight}
              loading={submitting}
              disabled={rating < 1}
              style={{ marginTop: Spacing.lg }}
            />
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
    flex: { flex: 1 },
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: isDark ? Colors.surface : Colors.white,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingHorizontal: Spacing.lg,
      paddingBottom: 40,
      paddingTop: Spacing.md,
    },
    handle: {
      width: 32, height: 4, borderRadius: 2,
      backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.lg,
    },
    title: { ...Typography.h3, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
    subtitle: {
      ...Typography.body, color: Colors.textSecondary,
      textAlign: 'center', marginTop: 4, marginBottom: Spacing.lg,
    },
    stars: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm },
    ratingLabel: {
      ...Typography.caption, color: Colors.textSecondary,
      textAlign: 'center', marginTop: Spacing.sm, marginBottom: Spacing.md, minHeight: 18,
    },
    input: {
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: Radius.sm,
      backgroundColor: isDark ? Colors.background : '#FFFFFF',
      color: Colors.textPrimary,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      minHeight: 96,
      fontSize: Typography.body.fontSize,
    },
  });
}
