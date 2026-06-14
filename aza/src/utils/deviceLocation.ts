import * as Location from 'expo-location';

/**
 * Returns the device's city-level location as "City, Country" (e.g. "Accra, Ghana"),
 * or null if permission is denied, unavailable, or times out.
 * Silent — never throws.
 */
export async function getDeviceLocation(): Promise<string | null> {
  try {
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
