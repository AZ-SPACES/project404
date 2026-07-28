/**
 * Node-level module resolution fallback for the npm-workspaces hoisting split.
 *
 * npm hoists @react-native/jest-preset (jest-expo's peer dep) to the monorepo
 * root, but react-native, @babel/runtime and friends stay nested in
 * aza/node_modules because other workspaces pin conflicting versions. Files
 * loaded from the hoisted preset therefore fail to resolve their own runtime
 * deps. This patch retries any failed bare-specifier resolution against this
 * workspace's node_modules. It only ever runs on the failure path, so normal
 * resolution behavior is untouched.
 *
 * Required (directly or via the wrappers in this directory) by every jest
 * process that loads root-preset files: the config-load process, and each
 * worker (test environment, resolver, transformers are loaded outside the
 * sandbox with plain Node require).
 */

'use strict';

const path = require('path');
const Module = require('module');

const workspaceNodeModules = path.join(__dirname, '..', 'node_modules');

if (!Module.__azaWorkspaceFallbackInstalled) {
  Module.__azaWorkspaceFallbackInstalled = true;
  const originalResolve = Module._resolveFilename;
  Module._resolveFilename = function (request, parent, isMain, options) {
    try {
      return originalResolve.call(this, request, parent, isMain, options);
    } catch (e) {
      if (
        e.code === 'MODULE_NOT_FOUND' &&
        typeof request === 'string' &&
        !request.startsWith('.') &&
        !path.isAbsolute(request)
      ) {
        return originalResolve.call(
          this,
          path.join(workspaceNodeModules, request),
          parent,
          isMain,
          options,
        );
      }
      throw e;
    }
  };
}
