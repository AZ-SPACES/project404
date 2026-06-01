import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  StatusBar,
  Dimensions,
} from 'react-native';
import { Feather } from '@react-native-vector-icons/feather';
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../../../navigation/types';
import { CloseButton } from '../../../components/ui/CloseButton';
import { useCallStore } from '../../../store/callStore';

const { width } = Dimensions.get('window');
const PIP_WIDTH = 100;
const PIP_HEIGHT = 140;
const THEME_GREEN = '#174717';

export default function VideoCallScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'VideoCall'>>();
  const { name, avatar } = route.params;
  const insets = useSafeAreaInsets();

  const {
    activeCall,
    isMuted,
    isSpeakerOn,
    isLocalVideoEnabled,
    cameraFacing,
    toggleMute,
    toggleSpeaker,
    toggleVideo,
    flipCamera,
    endCurrentCall
  } = useCallStore();

  const [duration, setDuration] = useState(0);

  // If the call ends while we are on this screen, close it
  useEffect(() => {
    if (!activeCall) {
      if (navigation.canGoBack()) navigation.goBack();
      else navigation.navigate('MainTabs');
    }
  }, [activeCall, navigation]);

  // Duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeCall?.status === 'ACTIVE') {
      interval = setInterval(() => {
        if (activeCall.startedAt) {
          setDuration(Math.floor((Date.now() - activeCall.startedAt) / 1000));
        }
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeCall?.status, activeCall?.startedAt]);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const handleEndCall = async () => {
    await endCurrentCall();
  };

  if (!activeCall) return null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Full-screen remote video */}
      {activeCall.remoteStream ? (
        <View style={styles.remoteVideo} />
      ) : (
        <Image source={{ uri: avatar }} style={styles.remoteVideo} resizeMode="cover" />
      )}

      {/* Top gradient overlay for header readability */}
      <LinearGradient
        colors={[THEME_GREEN, 'rgba(23, 71, 23, 0.6)', 'transparent']}
        locations={[0, 0.5, 1]}
        style={styles.topGradient}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <CloseButton onPress={handleEndCall} />

        <View style={styles.headerCenter}>
          <Text style={styles.headerName} numberOfLines={1}>{name}</Text>
          <Text style={styles.headerDuration}>
            {activeCall.status === 'ACTIVE' ? formatDuration(duration) : 
             activeCall.status === 'RINGING' ? 'Ringing...' : 'Connecting...'}
          </Text>
        </View>

        <TouchableOpacity hitSlop={12}>
          <Feather name="more-horizontal" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* PiP self view — live camera */}
      <View style={[styles.pipContainer, { bottom: 140 + Math.max(insets.bottom, 16) }]}>
        {activeCall.localStream && isLocalVideoEnabled ? (
          <View style={styles.pipCamera} />
        ) : (
          <View style={styles.pipPlaceholder}>
            <Feather
              name={!isLocalVideoEnabled ? 'video-off' : 'camera-off'}
              size={22}
              color="rgba(255,255,255,0.5)"
            />
          </View>
        )}
        <TouchableOpacity
          style={styles.pipFlipButton}
          onPress={flipCamera}
          activeOpacity={0.7}
        >
          <Ionicons name="camera-reverse-outline" size={16} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Bottom gradient overlay for controls readability */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.7)']}
        style={styles.bottomGradient}
      />

      {/* Bottom controls */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <View style={styles.controlRow}>
          <TouchableOpacity
            style={[styles.controlButton, isSpeakerOn && styles.controlButtonActive]}
            onPress={toggleSpeaker}
            activeOpacity={0.7}
          >
            <Feather name="volume-2" size={22} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, isMuted && styles.controlButtonActive]}
            onPress={toggleMute}
            activeOpacity={0.7}
          >
            <Feather name={isMuted ? 'mic-off' : 'mic'} size={22} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, !isLocalVideoEnabled && styles.controlButtonActive]}
            onPress={toggleVideo}
            activeOpacity={0.7}
          >
            <Feather name={!isLocalVideoEnabled ? 'video-off' : 'video'} size={22} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.endCallButton} onPress={handleEndCall} activeOpacity={0.8}>
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

  // Remote video
  remoteVideo: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },

  // Top gradient
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
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
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },

  // PiP
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
    zIndex: 5,
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

  // Bottom gradient
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
    paddingTop: 16,
    paddingHorizontal: 24,
    zIndex: 10,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  endCallButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
