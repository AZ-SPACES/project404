import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  StatusBar,
  Dimensions,
  Animated,
} from 'react-native';
import { Feather } from '@react-native-vector-icons/feather';
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { RootStackParamList } from '../../../navigation/types';

const { width, height } = Dimensions.get('window');
const AVATAR_SIZE = width * 0.42;
const RING_SIZE = AVATAR_SIZE + 16;
const PIP_WIDTH = 100;
const PIP_HEIGHT = 140;
const THEME_GREEN = '#174717';

export default function AudioCallScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'AudioCall'>>();
  const { name, avatar } = route.params;
  const insets = useSafeAreaInsets();

  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [isVideoMode, setIsVideoMode] = useState(false);
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [duration, setDuration] = useState(0);
  const [status, setStatus] = useState<'ringing' | 'connected'>('ringing');

  const [permission, requestPermission] = useCameraPermissions();

  // Animation driver: 0 = audio, 1 = video
  const transition = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  useEffect(() => {
    const timer = setTimeout(() => setStatus('connected'), 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === 'connected') {
      interval = setInterval(() => setDuration(prev => prev + 1), 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [status]);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const toggleVideoMode = () => {
    const toVideo = !isVideoMode;
    setIsVideoMode(toVideo);
    Animated.timing(transition, {
      toValue: toVideo ? 1 : 0,
      duration: 400,
      useNativeDriver: false,
    }).start();
  };

  // Derived animated values
  const remoteVideoOpacity = transition;

  const avatarScale = transition.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  const avatarOpacity = transition.interpolate({
    inputRange: [0, 0.4],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const pipOpacity = transition.interpolate({
    inputRange: [0.5, 1],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const gradientOpacity = transition.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  const cameraReady = permission?.granted && isVideoMode;
  const pipBottom = 140 + Math.max(insets.bottom, 16);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Audio mode: gradient background */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: gradientOpacity }]} pointerEvents="none">
        <LinearGradient
          colors={[THEME_GREEN, '#0a2a0a', '#050f05', '#000']}
          locations={[0, 0.35, 0.6, 1]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Video mode: full-screen remote feed (simulated) */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: remoteVideoOpacity }]} pointerEvents="none">
        <Image source={{ uri: avatar }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      </Animated.View>

      {/* Top gradient overlay (always present, adjusts for readability) */}
      <LinearGradient
        colors={[isVideoMode ? THEME_GREEN : 'transparent', 'transparent']}
        style={styles.topGradient}
        pointerEvents="none"
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerName} numberOfLines={1}>{name}</Text>
          <Text style={styles.headerDuration}>
            {status === 'connected' ? formatDuration(duration) : 'Ringing...'}
          </Text>
        </View>

        <TouchableOpacity hitSlop={12}>
          <Feather name="more-horizontal" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Audio mode: centered avatar */}
      <Animated.View
        style={[styles.avatarSection, { opacity: avatarOpacity, transform: [{ scale: avatarScale }] }]}
        pointerEvents={isVideoMode ? 'none' : 'auto'}
      >
        <View style={styles.avatarRing}>
          <Image source={{ uri: avatar }} style={styles.avatar} />
        </View>
      </Animated.View>

      {/* Video mode: PiP self view with camera */}
      <Animated.View style={[styles.pipContainer, { bottom: pipBottom, opacity: pipOpacity }]}>
        {cameraReady ? (
          <CameraView style={styles.pipCamera} facing={facing} />
        ) : (
          <View style={styles.pipPlaceholder}>
            <Feather name="video-off" size={22} color="rgba(255,255,255,0.5)" />
          </View>
        )}
        <TouchableOpacity
          style={styles.pipFlipButton}
          onPress={() => setFacing(prev => (prev === 'front' ? 'back' : 'front'))}
          activeOpacity={0.7}
        >
          <Ionicons name="camera-reverse-outline" size={16} color="#fff" />
        </TouchableOpacity>
      </Animated.View>

      {/* Bottom gradient for video mode */}
      {isVideoMode && (
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          style={styles.bottomGradient}
          pointerEvents="none"
        />
      )}

      {/* Bottom controls */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 24) + 16 }, !isVideoMode && styles.bottomBarAudio]}>
        <View style={styles.controlRow}>
          <TouchableOpacity
            style={[styles.controlButton, isSpeaker && styles.controlButtonActive]}
            onPress={() => setIsSpeaker(prev => !prev)}
            activeOpacity={0.7}
          >
            <Feather name="volume-2" size={22} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, isMuted && styles.controlButtonActive]}
            onPress={() => setIsMuted(prev => !prev)}
            activeOpacity={0.7}
          >
            <Feather name={isMuted ? 'mic-off' : 'mic'} size={22} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, isVideoMode && styles.controlButtonActive]}
            onPress={toggleVideoMode}
            activeOpacity={0.7}
          >
            <Feather name={isVideoMode ? 'video-off' : 'video'} size={22} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Feather name="message-circle" size={22} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.endCallButton} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <MaterialIcons name="call-end" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  // Top gradient overlay
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 160,
    zIndex: 2,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0.2,
  },
  headerDuration: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 2,
  },

  // Audio mode avatar
  avatarSection: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  avatarRing: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },

  // Video mode PiP
  pipContainer: {
    position: 'absolute',
    right: 16,
    width: PIP_WIDTH,
    height: PIP_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1E1E1E',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    zIndex: 15,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  pipCamera: {
    width: '100%',
    height: '100%',
  },
  pipPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2D3748',
  },
  pipFlipButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Bottom gradient (video mode)
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 180,
    zIndex: 2,
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 20,
    paddingHorizontal: 20,
    zIndex: 20,
  },
  bottomBarAudio: {
    backgroundColor: 'rgba(23, 71, 23, 0.35)',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  controlButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
  endCallButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
