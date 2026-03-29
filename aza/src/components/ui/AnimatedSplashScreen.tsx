import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Animated, Easing } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

import * as Font from 'expo-font';
import { Ionicons, Feather } from '@expo/vector-icons';

import { useDisplayContext } from '../../providers/DisplayProvider';

const splashImage = require('../../assets/aza-logo.png');

export default function AnimatedSplashScreen({ children }: { children: React.ReactNode }) {
  const [isAppReady, setAppReady] = useState(false);
  const [isSplashVisible, setSplashVisible] = useState(true);
  const { activeColorScheme } = useDisplayContext();
  
  const logoScale = useRef(new Animated.Value(1)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;

  const isDarkMode = activeColorScheme === 'dark';
  const backgroundColor = isDarkMode ? '#121212' : '#ffffff';

  useEffect(() => {
    async function prepare() {
      try {
        await SplashScreen.preventAutoHideAsync();
        
        // Pre-load fonts
        await Font.loadAsync({
          ...Ionicons.font,
          ...Feather.font,
        });
        
        await new Promise(resolve => setTimeout(resolve, 800));
      } catch (e) {
        console.warn(e);
      } finally {
        setAppReady(true);
      }
    }

    prepare();
  }, []);

  useEffect(() => {
    if (isAppReady) {
      SplashScreen.hideAsync().then(() => {
        Animated.parallel([
          Animated.sequence([
            Animated.timing(logoScale, {
              toValue: 0.8,
              duration: 150,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(logoScale, {
              toValue: 80, 
              duration: 250,
              easing: Easing.in(Easing.exp),
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.delay(150),
            Animated.timing(overlayOpacity, {
              toValue: 0,
              duration: 250,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
        ]).start(() => {
          setSplashVisible(false);
        });
      });
    }
  }, [isAppReady, logoScale, overlayOpacity]);

  return (
    <View style={styles.container}>
      {children}
      
      {isSplashVisible && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.splashOverlay,
            {
              opacity: overlayOpacity,
              backgroundColor,
            },
          ]}
        >
          <Animated.Image
            source={splashImage}
            style={[
              styles.logo,
              {
                transform: [{ scale: logoScale }],
              },
              isDarkMode && { tintColor: '#ffffff' } // Tinting logo to white for dark mode if it's a dark logo
            ]}
            resizeMode="contain"
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  splashOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  logo: {
    width: '60%', 
    height: '60%', 
  },
});
