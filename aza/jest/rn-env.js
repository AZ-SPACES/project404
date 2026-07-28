// Wrapper: installs the workspace module fallback before loading the hoisted
// react-native test environment (which requires @babel/runtime from the root).
require('./moduleFallback');
module.exports = require('@react-native/jest-preset/jest/react-native-env.js');
