import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ImageBackground, Animated, Easing } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { RootStackParamList } from "../../navigation/types";
import { Colors } from "../../theme";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const DURATION = 3200; // slightly longer for premium feel

export default function CreatingAccountScreen() {
  const navigation = useNavigation<NavigationProp>();
  
  const [status, setStatus] = useState("Securing your profile");
  const [isDone, setIsDone] = useState(false);
  
  const progressAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const checkScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Content Fade-in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
      easing: Easing.out(Easing.quad),
    }).start();

    // 2. Progress Bar Animation
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: DURATION - 400, // leave some time for the 'Success' state
      useNativeDriver: false,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    }).start();

    // 3. Footer Pulse Animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.6,
          duration: 1000,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.quad),
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.quad),
        }),
      ])
    ).start();

    // 4. Lifecycle Stages
    const stage1 = setTimeout(() => {
      setStatus("Finishing setup");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, DURATION * 0.4);

    const stage2 = setTimeout(() => {
      setStatus("Everything is ready");
      setIsDone(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      Animated.spring(checkScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }).start();
    }, DURATION - 600);

    const navigationTimer = setTimeout(() => {
      navigation.replace("AccountReady");
    }, DURATION + 400);

    return () => {
      clearTimeout(stage1);
      clearTimeout(stage2);
      clearTimeout(navigationTimer);
    };
  }, [navigation, fadeAnim, progressAnim, pulseAnim, checkScale]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <ImageBackground
      source={require("../../assets/man_holdingphone.png")} 
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <Animated.View style={[styles.centerContent, { opacity: fadeAnim }]}>
          <Text style={styles.title}>Creating your{"\n"}account</Text>
          
          <View style={styles.progressContainer}>
            {!isDone ? (
              <>
                <View style={styles.progressBarWrapper}>
                  <Animated.View style={[styles.progressBarFill, { width: progressWidth }]} />
                </View>
                <Text style={styles.statusText}>{status}</Text>
              </>
            ) : (
              <Animated.View style={{ transform: [{ scale: checkScale }], alignItems: 'center' }}>
                <View style={styles.successCircle}>
                  <MaterialIcons name="check" size={28} color={Colors.white} />
                </View>
                <Text style={styles.statusTextReady}>{status}</Text>
              </Animated.View>
            )}
          </View>
        </Animated.View>
        
        <Animated.Text style={[styles.footerText, { opacity: isDone ? 0 : pulseAnim }]}>
          This might take a few seconds
        </Animated.Text>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: "100%",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.52)",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 40,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  title: {
    color: Colors.white,
    fontSize: 40,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -1,
    lineHeight: 46,
    marginBottom: 40,
  },
  progressContainer: {
    width: "70%",
    height: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  progressBarWrapper: {
    height: 4,
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 16,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: Colors.white,
  },
  statusText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
  },
  statusTextReady: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 12,
  },
  successCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.2)",
  },
  footerText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    fontWeight: "500",
  },
});
