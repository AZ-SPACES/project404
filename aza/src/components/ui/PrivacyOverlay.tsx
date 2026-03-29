import React, { useEffect, useState } from 'react';
import { AppState, AppStateStatus, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useDisplayContext } from '../../providers/DisplayProvider';

export default function PrivacyOverlay() {
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const { activeColorScheme } = useDisplayContext();

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      setAppState(nextAppState);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  if (appState === 'active') {
    return null;
  }

  return (
    <View style={[StyleSheet.absoluteFill, styles.container]}>
      <BlurView
        style={StyleSheet.absoluteFill}
        tint={activeColorScheme === 'dark' ? 'dark' : 'light'}
        intensity={100}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    zIndex: 99999,
    elevation: 99999,
  },
});
