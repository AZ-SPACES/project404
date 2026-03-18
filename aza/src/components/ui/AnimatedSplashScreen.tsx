import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Animated, Easing } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

const splashImage = require('../../assets/aza-logo.png');

export default function AnimatedSplashScreen({ children }: { children: React.ReactNode }) {
  const [isAppReady, setAppReady] = useState(false);
  const [isSplashVisible, setSplashVisible] = useState(true);
  
  const logoScale = useRef(new Animated.Value(1)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    async function prepare() {
      try {
        await SplashScreen.preventAutoHideAsync();
        
        // Wait 1s and simulate app loading to hold the logo
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
        // Fintech animations: Subtle initial bounce then exponential zoom + fade out
        Animated.sequence([
          // A subtle pulse down
          Animated.timing(logoScale, {
            toValue: 0.9,
            duration: 200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          // Huge scale up acting as a reveal
          Animated.timing(logoScale, {
            toValue: 2.5, 
            duration: 400,
            easing: Easing.in(Easing.exp),
            useNativeDriver: true,
          }),
        ]).start();

        // Fade out overlay simultaneously after the initial bounce
        setTimeout(() => {
          Animated.timing(overlayOpacity, {
            toValue: 0,
            duration: 350,
            useNativeDriver: true,
          }).start(() => {
            setSplashVisible(false);
          });
        }, 150);
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
    backgroundColor: '#ffffff', // Ensures perfectly smooth handoff from the native splash screen
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999, // ensures it sits above the whole app
  },
  logo: {
    width: '60%', 
    height: '60%', 
  },
});
