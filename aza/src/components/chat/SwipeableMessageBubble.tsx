import React, { memo, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../../theme';
import type { Message } from './chatTypes';

const SWIPE_THRESHOLD = 60;
const MAX_TRANSLATE = 80;

type SwipeableMessageBubbleProps = {
  message: Message;
  onSwipeToReply: (message: Message) => void;
  children: React.ReactNode;
};

function SwipeableMessageBubbleInner({
  message,
  onSwipeToReply,
  children,
}: SwipeableMessageBubbleProps) {
  const { colors: Colors } = useAppTheme();
  const translateX = useSharedValue(0);
  const hasTriggered = useSharedValue(false);
  const isMe = message.sender === 'me';

  const triggerReply = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSwipeToReply(message);
  }, [message, onSwipeToReply]);

  const panGesture = Gesture.Pan()
    .activeOffsetX(isMe ? -15 : 15)
    .failOffsetY([-15, 15])
    .onUpdate((event) => {
      if (isMe) {
        // Sender: swipe left (negative translateX)
        const clamped = Math.max(-MAX_TRANSLATE, Math.min(0, event.translationX));
        translateX.value = clamped;

        if (clamped <= -SWIPE_THRESHOLD && !hasTriggered.value) {
          hasTriggered.value = true;
          runOnJS(triggerReply)();
        }
      } else {
        // Receiver: swipe right (positive translateX)
        const clamped = Math.max(0, Math.min(MAX_TRANSLATE, event.translationX));
        translateX.value = clamped;

        if (clamped >= SWIPE_THRESHOLD && !hasTriggered.value) {
          hasTriggered.value = true;
          runOnJS(triggerReply)();
        }
      }
    })
    .onEnd(() => {
      translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
      hasTriggered.value = false;
    });

  const animatedBubbleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const animatedIconStyle = useAnimatedStyle(() => {
    const absTranslate = Math.abs(translateX.value);
    const progress = interpolate(
      absTranslate,
      [0, SWIPE_THRESHOLD * 0.5, SWIPE_THRESHOLD],
      [0, 0.5, 1],
      Extrapolation.CLAMP,
    );

    const scale = interpolate(progress, [0, 0.5, 1], [0.3, 0.8, 1.1], Extrapolation.CLAMP);

    return {
      opacity: progress,
      transform: [{ scale }],
    };
  });

  return (
    <View style={styles.container}>
      {/* Reply icon — revealed as the bubble moves */}
      <Animated.View
        style={[
          styles.replyIcon,
          isMe ? styles.replyIconRight : styles.replyIconLeft,
          animatedIconStyle,
        ]}
      >
        <View style={[styles.replyIconCircle, { backgroundColor: Colors.primary + '1A' }]}>
          <Feather name="corner-up-left" size={16} color={Colors.primary} />
        </View>
      </Animated.View>

      {/* Swipeable bubble */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={animatedBubbleStyle}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

export const SwipeableMessageBubble = memo(SwipeableMessageBubbleInner);

const styles = StyleSheet.create({
  container: {
    overflow: 'visible',
  },
  replyIcon: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  replyIconLeft: {
    right: 8,
  },
  replyIconRight: {
    left: 8,
  },
  replyIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
