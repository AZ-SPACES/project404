const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const miniappsRoot = path.resolve(projectRoot, '../miniapps');

const config = getDefaultConfig(projectRoot);

// Watch the standalone miniapps directory so Metro hot-reloads changes there.
config.watchFolders = [miniappsRoot];

// Files outside the project root don't inherit aza's node_modules search path.
// This tells Metro to look here for react, react-native, react-native-webview, etc.
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];

// Map each @miniapps/* import to its directory. Metro finds index.tsx inside.
config.resolver.extraNodeModules = {
  '@miniapps/play-2048':         path.join(miniappsRoot, 'play-2048'),
  '@miniapps/snake':             path.join(miniappsRoot, 'snake'),
  '@miniapps/connect4':          path.join(miniappsRoot, 'connect4'),
  '@miniapps/radio':             path.join(miniappsRoot, 'radio'),
  '@miniapps/notepad':           path.join(miniappsRoot, 'notepad'),
  '@miniapps/cedirates':         path.join(miniappsRoot, 'cedirates'),
  '@miniapps/salifu-and-master': path.join(miniappsRoot, 'salifu-and-master'),
  // SDK package — maps @aza/miniapp-sdk to the source entry point
  '@aza/miniapp-sdk':            path.join(miniappsRoot, 'aza-sdk', 'src', 'index.ts'),
};

module.exports = config;
