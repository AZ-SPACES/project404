// Wrapper: installs the workspace module fallback before loading the hoisted
// react-native jest resolver, and adds a workspace-level retry for sandboxed
// resolution. Files that live in the ROOT-hoisted @react-native/jest-preset
// (mocks, setup) require bare specifiers like 'react' that only exist in
// aza/node_modules; retrying with this workspace as the base directory lets
// jest-resolve find them. The retry only runs on the failure path.
require('./moduleFallback');

const path = require('path');
const baseResolver = require('@react-native/jest-preset/jest/resolver.js');

const workspaceDir = path.join(__dirname, '..');

module.exports = function azaWorkspaceResolver(request, options) {
  try {
    return baseResolver(request, options);
  } catch (error) {
    if (typeof request === 'string' && !request.startsWith('.') && !path.isAbsolute(request)) {
      return baseResolver(request, { ...options, basedir: workspaceDir });
    }
    throw error;
  }
};
