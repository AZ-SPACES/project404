/**
 * RNG bootstrap. Importing this once at app startup installs a
 * cryptographically secure global.crypto.getRandomValues backed by the
 * platform CSPRNG (Android: SecureRandom, iOS: SecRandomCopyBytes).
 *
 * @noble/* libraries require getRandomValues to be present before any key
 * generation. Importing 'react-native-get-random-values' has the side effect
 * of installing the polyfill — there is no runtime API to call.
 */
import 'react-native-get-random-values';
