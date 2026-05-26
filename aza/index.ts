// Must be imported before any crypto/Zustand modules so global.crypto.getRandomValues
// is available when @noble/* initializes.
import './src/crypto/random';

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
