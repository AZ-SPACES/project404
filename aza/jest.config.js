const path = require('path');

// Installs a Node-level resolution fallback for this config-load process —
// see jest/moduleFallback.js for why (npm hoists @react-native/jest-preset to
// the monorepo root while react-native stays nested in this workspace).
require('./jest/moduleFallback');

const expoPreset = require('jest-expo/jest-preset');

// Files that live inside the ROOT-hoisted @react-native/jest-preset cannot
// resolve their own runtime deps when jest workers load them. Swap each one
// for a local wrapper that installs the fallback first, then delegates.
const rootPresetDir = path.join('@react-native', 'jest-preset');
const wrappers = {
  'react-native-env.js': require.resolve('./jest/rn-env.js'),
  'resolver.js': require.resolve('./jest/rn-resolver.js'),
  'setup.js': require.resolve('./jest/rn-setup.js'),
  'assetFileTransformer.js': require.resolve('./jest/rn-assetFileTransformer.js'),
};

function rewrap(value) {
  if (Array.isArray(value)) return value.map(rewrap);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rewrap(v)]));
  }
  if (typeof value === 'string' && value.includes(rootPresetDir)) {
    return wrappers[path.basename(value)] ?? value;
  }
  return value;
}

const preset = rewrap(expoPreset);

module.exports = {
  ...preset,
  moduleNameMapper: {
    ...preset.moduleNameMapper,
    // Sandboxed code transformed by babel-jest references @babel/runtime
    // helpers; map them to this workspace's copy so files loaded from the
    // root-hoisted preset can find them too.
    '^@babel/runtime/(.*)$':
      path.join(__dirname, 'node_modules', '@babel', 'runtime') + '/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|native-base|react-native-svg|@noble/.*)',
  ],
  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
};
