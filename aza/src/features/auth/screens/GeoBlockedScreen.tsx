import React, { useEffect } from 'react';
import { View, Text, StyleSheet, StatusBar, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@react-native-vector-icons/feather';
import { useVideoPlayer, VideoView } from 'expo-video';
import Button from '../../../components/ui/Button';

const SUPPORT_EMAIL = 'support@aza.systems';
const blockedVideo = require('../../../assets/videos/blocked.mp4');

export default function GeoBlockedScreen() {
  const player = useVideoPlayer(blockedVideo);

  useEffect(() => {
    if (player) {
      player.loop = true;
      player.play();
      player.allowsExternalPlayback = false;
    }
  }, [player]);

  const handleContactSupport = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Region%20Access%20Issue`);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" />

      {/* Background Video */}
      <View style={styles.videoContainer}>
        <VideoView
          style={styles.video}
          player={player}
          contentFit="cover"
          nativeControls={false}
          allowsPictureInPicture={false}
        />
        <View style={styles.overlay} />
      </View>

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.contentContainer}>
          <Text style={styles.title}>NOT AVAILABLE IN{"\n"}YOUR REGION</Text>
          <Text style={styles.description}>
            AZA is currently unavailable in your location due to regulatory restrictions.
          </Text>
          <Text style={[styles.description, { marginTop: 16 }]}>
            If you are using a VPN or proxy, disabling it may restore your access.
          </Text>
        </View>

        <View style={styles.footer}>
          <Button
            title="Contact Support"
            onPress={handleContactSupport}
            backgroundColor="#ffffff"
            textColor="#111827"
            leftIcon={<Feather name="mail" size={16} color="#111827" />}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  video: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ffffff',
    lineHeight: 40,
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 15,
    fontWeight: '500',
    color: '#e5e7eb',
    lineHeight: 22,
    paddingRight: 24,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 16,
  },
});
