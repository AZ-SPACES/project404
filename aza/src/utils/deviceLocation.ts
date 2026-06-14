import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

const LOCATION_OPT_OUT_KEY = '@aza:locationDisabled';
const LOCATION_RATIONALE_KEY = '@aza:locationRationaleShown';

export async function isLocationEnabled(): Promise<boolean> {
  const disabled = await AsyncStorage.getItem(LOCATION_OPT_OUT_KEY);
  return disabled !== 'true';
}

export async function setLocationEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(LOCATION_OPT_OUT_KEY, enabled ? 'false' : 'true');
}

/**
 * Returns the device's city-level location as "City, Country" (e.g. "Accra, Ghana"),
 * or null if permission is denied, user has opted out, or times out.
 * Silent — never throws.
 */
export async function getDeviceLocation(): Promise<string | null> {
  try {
    const disabled = await AsyncStorage.getItem(LOCATION_OPT_OUT_KEY);
    if (disabled === 'true') return null;

    const { status: currentStatus } = await Location.getForegroundPermissionsAsync();
    if (currentStatus === 'undetermined') {
      const rationaleShown = await AsyncStorage.getItem(LOCATION_RATIONALE_KEY);
      if (!rationaleShown) {
        await new Promise<void>((resolve) => {
          Alert.alert(
            'Location access',
            'Aza uses your city-level location when you log in or send money to detect suspicious activity and protect your account. No precise coordinates are stored.',
            [{ text: 'Continue', onPress: () => resolve() }],
            { cancelable: false },
          );
        });
        await AsyncStorage.setItem(LOCATION_RATIONALE_KEY, 'true');
      }
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    const pos = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
    ]);
    if (!pos) return null;

    const [geo] = await Location.reverseGeocodeAsync({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    });
    if (!geo) return null;

    const city = geo.city || geo.district || geo.subregion || '';
    const country = geo.country || '';
    if (!city && !country) return null;
    return city && country ? `${city}, ${country}` : city || country;
  } catch {
    return null;
  }
}
