import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  StatusBar, Dimensions, Alert, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@react-native-vector-icons/feather';
import { CameraView, useCameraPermissions, FlashMode, CameraType } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

type CameraMode = 'PHOTO' | 'VIDEO';

export default function CameraScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'ChatCamera'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'ChatCamera'>>();
  const { recipientName, chatId } = route.params;
  const insets = useSafeAreaInsets();

  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [mode, setMode] = useState<CameraMode>('PHOTO');
  const [lastCaptureUri, setLastCaptureUri] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  // ---------------------------------------------------------------------------
  // Permissions
  // ---------------------------------------------------------------------------
  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <Feather name="camera-off" size={48} color="#666" />
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionBody}>
          We need access to your camera to take photos.
        </Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission} activeOpacity={0.8}>
          <Text style={styles.permissionBtnText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.permissionBackBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Text style={styles.permissionBackText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Flash cycle: off → on → auto → off
  // ---------------------------------------------------------------------------
  const cycleFlash = () => {
    setFlash(prev => {
      if (prev === 'off') return 'on';
      if (prev === 'on') return 'auto';
      return 'off';
    });
  };

  const flashIcon = flash === 'off' ? 'zap-off' : 'zap';

  // ---------------------------------------------------------------------------
  // Capture
  // ---------------------------------------------------------------------------
  const handleCapture = async () => {
    if (isCapturing || !cameraRef.current) return;
    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      if (photo?.uri) {
        setLastCaptureUri(photo.uri);
        navigation.navigate('MediaPreview', {
          media: [{ uri: photo.uri, type: 'image' }],
          recipientName,
          chatId,
          source: 'camera',
        });
      }
    } catch (err) {
      Alert.alert('Capture Failed', 'Could not take a photo. Please try again.');
    } finally {
      setIsCapturing(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Gallery shortcut
  // ---------------------------------------------------------------------------
  const handleGalleryTap = async () => {
    const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permResult.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos', 'livePhotos'] as ImagePicker.MediaType[],
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: 10,
    });
    if (!result.canceled && result.assets.length > 0) {
      const media = result.assets.map(a => ({
        uri: a.uri,
        type: (a.type === 'video' ? 'video' : 'image') as 'image' | 'video',
      }));
      navigation.navigate('MediaPreview', {
        media,
        recipientName,
        chatId,
        source: 'gallery',
      });
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" translucent />

      {/* Viewfinder */}
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        flash={flash}
      />

      {/* Top controls */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 20) + 12 }]}>
        <TouchableOpacity
          style={styles.topBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Feather name="x" size={24} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.topBtn} onPress={cycleFlash} activeOpacity={0.7}>
          <Feather name={flashIcon} size={22} color="#fff" />
          {flash === 'auto' && <Text style={styles.flashLabel}>A</Text>}
        </TouchableOpacity>
      </View>

      {/* Bottom controls */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
        {/* Zoom pill */}
        <View style={styles.zoomPill}>
          <Text style={styles.zoomText}>1x</Text>
        </View>

        {/* Shutter row */}
        <View style={styles.shutterRow}>
          {/* Gallery thumbnail */}
          <TouchableOpacity style={styles.galleryThumb} onPress={handleGalleryTap} activeOpacity={0.8}>
            {lastCaptureUri ? (
              <Image source={{ uri: lastCaptureUri }} style={styles.galleryThumbImg} />
            ) : (
              <Feather name="image" size={22} color="#aaa" />
            )}
          </TouchableOpacity>

          {/* Shutter button */}
          <TouchableOpacity
            style={styles.shutterOuter}
            onPress={handleCapture}
            activeOpacity={0.85}
            disabled={isCapturing}
          >
            <View style={styles.shutterInner} />
          </TouchableOpacity>

          {/* Camera flip */}
          <TouchableOpacity
            style={styles.flipBtn}
            onPress={() => setFacing(prev => (prev === 'back' ? 'front' : 'back'))}
            activeOpacity={0.7}
          >
            <Feather name="refresh-cw" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Mode selector */}
        <View style={styles.modeRow}>
          <TouchableOpacity onPress={() => setMode('VIDEO')} activeOpacity={0.7}>
            <Text style={[styles.modeText, mode === 'VIDEO' && styles.modeTextActive]}>VIDEO</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMode('PHOTO')} activeOpacity={0.7}>
            <Text style={[styles.modeText, mode === 'PHOTO' && styles.modeTextActive]}>PHOTO</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },

  // Top bar
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 10,
  },
  topBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flashLabel: {
    position: 'absolute',
    bottom: 4,
    right: 8,
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },

  // Zoom
  zoomPill: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  zoomText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },

  // Shutter row
  shutterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: SCREEN_W,
    paddingHorizontal: 40,
    marginBottom: 20,
  },
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#fff',
  },

  // Gallery thumbnail
  galleryThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  galleryThumbImg: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
  },

  // Camera flip
  flipBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Mode selector
  modeRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 8,
  },
  modeText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
  },
  modeTextActive: {
    color: '#D4A843',
  },

  // Permission states
  permissionContainer: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  permissionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 8,
  },
  permissionBody: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  permissionBtn: {
    backgroundColor: '#174717',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 12,
  },
  permissionBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  permissionBackBtn: {
    marginTop: 8,
    paddingVertical: 8,
  },
  permissionBackText: {
    color: '#888',
    fontSize: 14,
  },
});
