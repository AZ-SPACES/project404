const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// The mini apps live outside this app, in project404/miniapps, and are consumed as @miniapps/*
// npm workspace packages (symlinked into the workspace node_modules by the root install).
//
// Three things must line up for that to bundle, and all three are load-bearing — dropping any one
// produces a differently-confusing failure:
//   1. watchFolders     — so Metro indexes files outside aza/.
//   2. nodeModulesPaths — so the @miniapps/* symlinks resolve from the workspace root.
//   3. serverRoot       — raised to the workspace root by EXPO_USE_METRO_WORKSPACE_ROOT=1, set in
//                         eas.json and required for local `expo export` too. Without it Metro
//                         resolves the files and then dies on "Failed to get the SHA-1", because
//                         serverRoot defaults to aza/ and refuses to read above itself.
config.watchFolders = [
  path.join(workspaceRoot, 'miniapps'),
  path.join(workspaceRoot, 'node_modules'),
];

config.resolver.nodeModulesPaths = [
  path.join(projectRoot, 'node_modules'),
  path.join(workspaceRoot, 'node_modules'),
];

// The SDK is published to npm rather than being a workspace member, so it has no node_modules
// entry here. Nothing in the app imports it today; this keeps the source path working if it does.
const externalModules = {
  '@aza/miniapp-sdk': path.join(workspaceRoot, 'miniapps', 'aza-sdk', 'src', 'index.ts'),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const filePath = externalModules[moduleName];
  if (filePath) return { type: 'sourceFile', filePath };
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
