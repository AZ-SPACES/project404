import React, { memo, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Modal, TextInput,
  TouchableOpacity, Dimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export type TextLabel = {
  id: string;
  text: string;
  color: string;
  x: number;
  y: number;
};

type DraggableTextProps = {
  label: TextLabel;
  onPositionChange: (id: string, x: number, y: number) => void;
  onDelete: (id: string) => void;
};

function DraggableText({ label, onPositionChange, onDelete }: DraggableTextProps) {
  const translateX = useSharedValue(label.x);
  const translateY = useSharedValue(label.y);
  const startX = useSharedValue(label.x);
  const startY = useSharedValue(label.y);

  const updatePosition = useCallback(
    (x: number, y: number) => onPositionChange(label.id, x, y),
    [label.id, onPositionChange],
  );

  const panGesture = Gesture.Pan()
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      translateX.value = startX.value + event.translationX;
      translateY.value = startY.value + event.translationY;
    })
    .onEnd(() => {
      runOnJS(updatePosition)(translateX.value, translateY.value);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.draggableLabel, animatedStyle]}>
        <Text style={[styles.labelText, { color: label.color }]}>{label.text}</Text>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => onDelete(label.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="x" size={12} color="#fff" />
        </TouchableOpacity>
      </Animated.View>
    </GestureDetector>
  );
}

// ---------------------------------------------------------------------------

type TextOverlayProps = {
  labels: TextLabel[];
  onLabelsChange: (labels: TextLabel[]) => void;
  textColor: string;
  showInput: boolean;
  onDismissInput: () => void;
};

function TextOverlayInner({
  labels,
  onLabelsChange,
  textColor,
  showInput,
  onDismissInput,
}: TextOverlayProps) {
  const [inputText, setInputText] = useState('');
  const inputRef = useRef<TextInput>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = inputText.trim();
    if (!trimmed) {
      onDismissInput();
      return;
    }
    const newLabel: TextLabel = {
      id: Date.now().toString(),
      text: trimmed,
      color: textColor,
      x: SCREEN_W * 0.2,
      y: SCREEN_H * 0.35,
    };
    onLabelsChange([...labels, newLabel]);
    setInputText('');
    onDismissInput();
  }, [inputText, textColor, labels, onLabelsChange, onDismissInput]);

  const handlePositionChange = useCallback(
    (id: string, x: number, y: number) => {
      onLabelsChange(labels.map(l => (l.id === id ? { ...l, x, y } : l)));
    },
    [labels, onLabelsChange],
  );

  const handleDelete = useCallback(
    (id: string) => {
      onLabelsChange(labels.filter(l => l.id !== id));
    },
    [labels, onLabelsChange],
  );

  return (
    <>
      {/* Draggable labels on the image */}
      {labels.map(label => (
        <DraggableText
          key={label.id}
          label={label}
          onPositionChange={handlePositionChange}
          onDelete={handleDelete}
        />
      ))}

      {/* Text input modal */}
      <Modal
        visible={showInput}
        transparent
        animationType="fade"
        onRequestClose={onDismissInput}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.inputCard}>
            <TextInput
              ref={inputRef}
              style={[styles.textInput, { color: textColor }]}
              placeholder="Type your text…"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={inputText}
              onChangeText={setInputText}
              autoFocus
              maxLength={120}
              multiline
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={handleSubmit}
            />
            <View style={styles.inputActions}>
              <TouchableOpacity onPress={onDismissInput} style={styles.inputBtn}>
                <Text style={styles.inputBtnLabel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSubmit} style={[styles.inputBtn, styles.inputBtnDone]}>
                <Text style={[styles.inputBtnLabel, { color: '#174717' }]}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

export const TextOverlay = memo(TextOverlayInner);

const styles = StyleSheet.create({
  draggableLabel: {
    position: 'absolute',
    zIndex: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  labelText: {
    fontSize: 22,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  deleteBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  inputCard: {
    width: '100%',
    backgroundColor: 'rgba(30,30,30,0.95)',
    borderRadius: 12,
    padding: 16,
  },
  textInput: {
    fontSize: 20,
    fontWeight: '600',
    minHeight: 48,
    maxHeight: 120,
    marginBottom: 12,
  },
  inputActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  inputBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  inputBtnLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  inputBtnDone: {
    backgroundColor: '#B7EE7A',
  },
});
