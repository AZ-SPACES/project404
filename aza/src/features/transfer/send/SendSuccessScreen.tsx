import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAppTheme, Typography, Spacing } from '../../../theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';

type SendSuccessScreenProps = NativeStackScreenProps<RootStackParamList, 'SendSuccess'>;

export default function SendSuccessScreen({ navigation, route }: SendSuccessScreenProps) {
  const { name } = route.params;
  const { colors: Colors } = useAppTheme();
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const isDark = Colors.isDark;
  const backgroundColor = isDark ? Colors.background : Colors.accent;

  const handleDone = () => {
    navigation.popToTop();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['top', 'bottom']}>
      {/* Header with Close Button */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleDone}
          style={[styles.closeButton, { backgroundColor: isDark ? Colors.white10 : Colors.black10 }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="x" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Animated.Image
          source={require('../../../assets/success_image.png')}
          style={[styles.image, { opacity: opacityAnim }]}
          resizeMode="contain"
          onLoad={() => {
            Animated.timing(opacityAnim, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }).start();
          }}
        />
        <Text style={[styles.title, { color: Colors.textPrimary }]}>
          Sent
        </Text>
        <Text style={[styles.subtitle, { color: Colors.textSecondary }]}>
          It's with {name}. That only took less than a minute.
        </Text>
      </View>

      {/* Footer / Done Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.doneButton, { backgroundColor: Colors.primary }]}
          activeOpacity={0.8}
          onPress={handleDone}
        >
          <Text style={[styles.doneButtonText, { color: Colors.secondary }]}>
            Done
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    alignItems: 'flex-start',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: 80, // shift content up slightly
  },
  image: {
    width: 200,
    height: 250,
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.h2,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.body,
    textAlign: 'center',
    paddingHorizontal: Spacing.md,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 0 : Spacing.md,
  },
  doneButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 999, // Pill shape for modern look
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonText: {
    ...Typography.button,
    fontWeight: '600',
  },
});
