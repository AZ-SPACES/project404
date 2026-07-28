// Wrapper: installs the workspace module fallback before loading the hoisted
// react-native asset transformer (which resolves react-native/package.json).
require('./moduleFallback');
module.exports = require('@react-native/jest-preset/jest/assetFileTransformer.js');
