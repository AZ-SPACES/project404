import { Platform, Share } from 'react-native';
import { captureRef } from '../native/viewShot';
import * as Sharing from 'expo-sharing';

/**
 * Capture a view as a PNG and put it in the share sheet, falling back to a
 * text-only share when capture or the sharing module is unavailable.
 *
 * A merchant's "save the poster" used to be a link to a third-party QR image
 * service opened in the browser, which meant the printable artwork depended on
 * someone else's uptime and sent the handle off-platform to be drawn. Rendering
 * the poster in-app and sharing the capture keeps both on the device.
 *
 * @param ref     The view to capture — usually the white poster card.
 * @param message Text to accompany the image, and the whole share when capture fails.
 */
export async function sharePoster(
  ref: React.RefObject<any>,
  message: string,
): Promise<boolean> {
  let imageUri: string | null = null;
  try {
    imageUri = await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' });
  } catch {
    imageUri = null;
  }

  if (imageUri) {
    // iOS: RN Share attaches the file via `url` and keeps the message. Android:
    // RN's Share drops `url`, so route image+text through expo-sharing instead.
    if (Platform.OS === 'ios') {
      try {
        await Share.share({ message, url: imageUri });
        return true;
      } catch {
        // fall through to expo-sharing
      }
    }
    const available = await Sharing.isAvailableAsync().catch(() => false);
    if (available) {
      try {
        await Sharing.shareAsync(imageUri, {
          mimeType: 'image/png',
          UTI: 'public.png',
          dialogTitle: message,
        });
        return true;
      } catch {
        // fall through to text-only share
      }
    }
  }

  try {
    await Share.share({ message });
    return true;
  } catch {
    return false;
  }
}
