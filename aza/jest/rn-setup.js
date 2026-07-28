// Wrapper: installs the workspace module fallback before loading the hoisted
// react-native jest setup file.
require('./moduleFallback');
module.exports = require('@react-native/jest-preset/jest/setup.js');
