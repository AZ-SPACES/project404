import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, AccessibilityInfo,
} from 'react-native';
import { GestureHandlerRootView, Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, useAnimatedProps,
  withSpring, withTiming, interpolate, interpolateColor, runOnJS,
} from 'react-native-reanimated';
import Svg, { Path, Circle, Ellipse } from 'react-native-svg';
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import * as Haptics from 'expo-haptics';
import { useToast } from '../../providers/ToastProvider';
import { submitFeedback } from '../../services/api';

const AnimatedPath = Animated.createAnimatedComponent(Path);

type Props = {
  visible: boolean;
  onClose: () => void;
  context?: string;
  /** Called with the chosen rating (1/3/5) after a successful submit. */
  onSubmitted?: (rating: number) => void;
};

// Three stops along the track: Bad / Not bad / Good → progress 0, 0.5, 1.
const STOP_INPUT = [0, 0.5, 1];
const RATINGS = [1, 3, 5];                  // backend value per stop
const LABELS = ['Bad', 'Not bad', 'Good'];
const WORDS = ['BAD', 'NOT BAD', 'GOOD'];

// Drenched background + matching dark ink that stays readable on each.
const BG = ['#ef1b14ff', '#F2B24C', '#AFE066'];
const INK = ['#5C1513', '#5A3A0A', '#1B4D1B'];

const QUESTIONS: Record<string, string> = {
  SPENDING_SUMMARY: 'How was your spending experience?',
  TRANSFER: 'How was sending money?',
  ONBOARDING: 'How was setting up your account?',
  AI_ASSISTANT: 'How helpful was the assistant?',
  SUPPORT: 'How was your support experience?',
  RATE_US: 'How are you enjoying Aza?',
};

function stopIndexFor(p: number): number {
  'worklet';
  return p < 0.25 ? 0 : p < 0.75 ? 1 : 2;
}

const hit = { top: 10, bottom: 10, left: 10, right: 10 };

export default function FeedbackSheet({ visible, onClose, context, onSubmitted }: Props) {
  const { showToast } = useToast();

  const progress = useSharedValue(0.5);
  const lastIdx = useSharedValue(1);
  const trackW = useSharedValue(1);
  const enter = useSharedValue(0);

  const [stop, setStop] = useState(1);
  const [noteOpen, setNoteOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  // Reset + play entrance whenever the sheet opens.
  useEffect(() => {
    if (!visible) return;
    progress.value = 0.5;
    lastIdx.value = 1;
    setStop(1); setNoteOpen(false); setComment(''); setSubmitting(false);
    enter.value = 0;
    enter.value = reduceMotion ? 1 : withSpring(1, { damping: 16, stiffness: 140 });
  }, [visible, reduceMotion, progress, lastIdx, enter]);

  const onStopChange = useCallback((idx: number) => {
    setStop(idx);
    Haptics.selectionAsync().catch(() => {});
  }, []);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      await submitFeedback(RATINGS[stop]!, comment.trim() || undefined, context);
      onSubmitted?.(RATINGS[stop]!);
      showToast('Thanks for your feedback!', 'success');
      onClose();
    } catch {
      showToast('Could not send feedback. Please try again.', 'error');
      setSubmitting(false);
    }
  }, [stop, comment, context, showToast, onClose, onSubmitted]);

  const setStopProgress = useCallback((idx: number) => {
    progress.value = reduceMotion ? idx * 0.5 : withSpring(idx * 0.5, { damping: 18, stiffness: 170 });
    lastIdx.value = idx;
    onStopChange(idx);
  }, [progress, lastIdx, reduceMotion, onStopChange]);

  const pan = Gesture.Pan()
    .onBegin((e) => {
      progress.value = Math.min(Math.max(e.x / trackW.value, 0), 1);
    })
    .onUpdate((e) => {
      const next = Math.min(Math.max(e.x / trackW.value, 0), 1);
      progress.value = next;
      const idx = stopIndexFor(next);
      if (idx !== lastIdx.value) { lastIdx.value = idx; runOnJS(onStopChange)(idx); }
    })
    .onEnd(() => {
      const idx = stopIndexFor(progress.value);
      progress.value = reduceMotion
        ? withTiming(idx * 0.5, { duration: 0 })
        : withSpring(idx * 0.5, { damping: 18, stiffness: 160 });
    });

  // ── Animated styles ──────────────────────────────────────────────────────
  const bgStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, STOP_INPUT, BG),
  }));
  const inkColor = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, STOP_INPUT, INK),
  }));
  const faceEnterStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ scale: interpolate(enter.value, [0, 1], [0.82, 1]) }],
  }));
  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * trackW.value - 17 }],
    backgroundColor: interpolateColor(progress.value, STOP_INPUT, INK),
  }));
  const submitBgStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, STOP_INPUT, INK),
  }));

  // Mouth morphs frown (∩) → straight → smile (∪) via the control-point Y.
  const mouthProps = useAnimatedProps(() => {
    const cx = 90, half = 32, y = 120;
    const cy = y + interpolate(progress.value, [0, 0.5, 1], [-30, -2, 34]);
    return {
      d: `M ${cx - half} ${y} Q ${cx} ${cy} ${cx + half} ${y}`,
      stroke: interpolateColor(progress.value, STOP_INPUT, INK),
    };
  });
  // Eyebrows: worried (inner ends raised) at Bad → flat at Not bad → relaxed
  // raised arch at Good. inner = end toward the nose, outer = end toward the ear.
  const browLProps = useAnimatedProps(() => {
    const inner = interpolate(progress.value, [0, 0.5, 1], [58, 66, 63]);
    const outer = interpolate(progress.value, [0, 0.5, 1], [73, 66, 57]);
    const mid = (inner + outer) / 2 - 4;
    return {
      d: `M 56 ${outer} Q 69 ${mid} 82 ${inner}`,
      stroke: interpolateColor(progress.value, STOP_INPUT, INK),
    };
  });
  const browRProps = useAnimatedProps(() => {
    const inner = interpolate(progress.value, [0, 0.5, 1], [58, 66, 63]);
    const outer = interpolate(progress.value, [0, 0.5, 1], [73, 66, 57]);
    const mid = (inner + outer) / 2 - 4;
    return {
      d: `M 124 ${outer} Q 111 ${mid} 98 ${inner}`,
      stroke: interpolateColor(progress.value, STOP_INPUT, INK),
    };
  });

  // Giant word opacity peaks at its own stop. (Constant 3-length lists.)
  const word0 = useAnimatedStyle(() => ({ opacity: interpolate(Math.abs(progress.value - 0), [0, 0.28], [0.16, 0], 'clamp') }));
  const word1 = useAnimatedStyle(() => ({ opacity: interpolate(Math.abs(progress.value - 0.5), [0, 0.28], [0.16, 0], 'clamp') }));
  const word2 = useAnimatedStyle(() => ({ opacity: interpolate(Math.abs(progress.value - 1), [0, 0.28], [0.16, 0], 'clamp') }));
  const wordStyles = [word0, word1, word2];

  const lbl0 = useAnimatedStyle(() => ({ opacity: interpolate(Math.abs(progress.value - 0), [0, 0.3], [1, 0.45], 'clamp'), color: interpolateColor(progress.value, STOP_INPUT, INK) }));
  const lbl1 = useAnimatedStyle(() => ({ opacity: interpolate(Math.abs(progress.value - 0.5), [0, 0.3], [1, 0.45], 'clamp'), color: interpolateColor(progress.value, STOP_INPUT, INK) }));
  const lbl2 = useAnimatedStyle(() => ({ opacity: interpolate(Math.abs(progress.value - 1), [0, 0.3], [1, 0.45], 'clamp'), color: interpolateColor(progress.value, STOP_INPUT, INK) }));
  const lblStyles = [lbl0, lbl1, lbl2];

  const question = (context && QUESTIONS[context]) || 'How was your experience?';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[styles.root, bgStyle]}>
          <KeyboardAvoidingView
            style={styles.root}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            {/* Top bar */}
            <View style={styles.topBar}>
              <TouchableOpacity onPress={onClose} style={styles.iconBtn} hitSlop={hit}>
                <Animated.Text style={[styles.iconTxt, inkColor]}>✕</Animated.Text>
              </TouchableOpacity>
              <View style={styles.iconBtn} />
            </View>

            <Animated.Text style={[styles.question, inkColor]}>{question}</Animated.Text>

            {/* Face + giant word */}
            <View style={styles.stage}>
              {WORDS.map((w, i) => (
                <Animated.View key={w} style={[StyleSheet.absoluteFill, styles.wordLayer, wordStyles[i]]} pointerEvents="none">
                  <Animated.Text style={[styles.bigWord, inkColor]} numberOfLines={1} adjustsFontSizeToFit>
                    {w}
                  </Animated.Text>
                </Animated.View>
              ))}
              <Animated.View style={faceEnterStyle}>
                <Svg width={224} height={224} viewBox="0 0 180 180">
                  <Ellipse cx={68} cy={92} rx={15} ry={18} fill="#1C1C1E" opacity={0.92} />
                  <Ellipse cx={112} cy={92} rx={15} ry={18} fill="#1C1C1E" opacity={0.92} />
                  <Circle cx={73} cy={86} r={4.5} fill="#FFFFFF" />
                  <Circle cx={117} cy={86} r={4.5} fill="#FFFFFF" />
                  <AnimatedPath animatedProps={browLProps} strokeWidth={5} strokeLinecap="round" fill="none" />
                  <AnimatedPath animatedProps={browRProps} strokeWidth={5} strokeLinecap="round" fill="none" />
                  <AnimatedPath animatedProps={mouthProps} strokeWidth={7} strokeLinecap="round" fill="none" />
                </Svg>
              </Animated.View>
            </View>

            {/* Slider */}
            <View style={styles.sliderBlock}>
              <GestureDetector gesture={pan}>
                <View
                  style={styles.trackHit}
                  onLayout={(e) => { trackW.value = e.nativeEvent.layout.width; }}
                >
                  <View style={styles.track} />
                  <Animated.View style={[styles.knob, knobStyle]}>
                    <View style={styles.knobInner} />
                  </Animated.View>
                </View>
              </GestureDetector>
              <View style={styles.labels}>
                {LABELS.map((l, i) => (
                  <TouchableOpacity key={l} onPress={() => setStopProgress(i)} hitSlop={hit} style={styles.labelBtn}>
                    <Animated.Text style={[styles.label, lblStyles[i], i === 0 && { textAlign: 'left' }, i === 2 && { textAlign: 'right' }]}>
                      {l}
                    </Animated.Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Note */}
            {noteOpen && (
              <View style={styles.noteWrap}>
                <TextInput
                  style={styles.noteInput}
                  placeholder="Tell us more…"
                  placeholderTextColor="rgba(28,28,30,0.45)"
                  value={comment}
                  onChangeText={setComment}
                  autoFocus
                  multiline
                  maxLength={2000}
                  textAlignVertical="top"
                />
              </View>
            )}

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity style={styles.notePill} onPress={() => setNoteOpen((o) => !o)} activeOpacity={0.7}>
                <MaterialIcons name={noteOpen ? 'expand-more' : 'edit'} size={16} color="#1C1C1E" />
                <Text style={styles.noteText}>{noteOpen ? 'Hide note' : comment ? 'Edit note' : 'Add note'}</Text>
              </TouchableOpacity>

              <Animated.View style={[styles.submitWrap, submitBgStyle]}>
                <TouchableOpacity style={styles.submit} onPress={handleSubmit} disabled={submitting} activeOpacity={0.85}>
                  <Text style={styles.submitText}>{submitting ? 'Sending…' : 'Submit'}</Text>
                  {!submitting && <MaterialIcons name="arrow-forward" size={18} color="#FFFFFF" />}
                </TouchableOpacity>
              </Animated.View>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 44, paddingBottom: 8,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.06)', alignItems: 'center', justifyContent: 'center',
  },
  iconTxt: { fontSize: 18, fontWeight: '600' },
  question: {
    fontSize: 26, fontWeight: '700', textAlign: 'center',
    paddingHorizontal: 32, marginTop: 8, letterSpacing: -0.5, lineHeight: 32,
  },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  wordLayer: { alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 28, paddingHorizontal: 20 },
  bigWord: {
    fontSize: 88, fontWeight: '900', letterSpacing: -2,
    textAlign: 'center', includeFontPadding: false,
  },
  sliderBlock: { paddingHorizontal: 28, paddingBottom: 8 },
  trackHit: { height: 48, justifyContent: 'center' },
  track: { height: 5, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.14)' },
  knob: {
    position: 'absolute', left: 0, width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3,
  },
  knobInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.9)' },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  labelBtn: { flex: 1 },
  label: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  noteWrap: { paddingHorizontal: 24, paddingBottom: 8 },
  noteInput: {
    backgroundColor: 'rgba(255,255,255,0.65)', borderRadius: 14, color: '#1C1C1E',
    paddingHorizontal: 14, paddingVertical: 12, minHeight: 80, fontSize: 15,
  },
  actions: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 24, paddingTop: 8, gap: 12,
  },
  notePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 14, paddingHorizontal: 18, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  noteText: { fontSize: 15, fontWeight: '600', color: '#1C1C1E' },
  submitWrap: { borderRadius: 999 },
  submit: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 15, paddingHorizontal: 30 },
  submitText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
