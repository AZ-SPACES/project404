import { Platform, PermissionsAndroid, Alert, Linking } from 'react-native';

/**
 * Request mic (and camera if needed) before starting WebRTC. On Android
 * `getUserMedia` triggers a permission prompt the first time but silently
 * fails on some devices if the permission was previously denied — handling
 * it explicitly lets us surface a meaningful error and a path to settings.
 * iOS prompts via the standard Info.plist NSMicrophoneUsageDescription /
 * NSCameraUsageDescription flow when getUserMedia runs.
 */
export async function ensureCallPermissions(type: 'VOICE' | 'VIDEO'): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  const needed: string[] = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
  if (type === 'VIDEO') needed.push(PermissionsAndroid.PERMISSIONS.CAMERA);

  const result = await PermissionsAndroid.requestMultiple(needed as any);

  const denied = needed.filter(
    (p) => result[p as keyof typeof result] !== PermissionsAndroid.RESULTS.GRANTED,
  );
  if (denied.length === 0) return true;

  const blocked = denied.some(
    (p) => result[p as keyof typeof result] === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
  );

  Alert.alert(
    'Permission required',
    type === 'VIDEO'
      ? 'Camera and microphone access are needed for video calls.'
      : 'Microphone access is needed for calls.',
    blocked
      ? [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open settings', onPress: () => Linking.openSettings() },
        ]
      : [{ text: 'OK' }],
  );
  return false;
}
