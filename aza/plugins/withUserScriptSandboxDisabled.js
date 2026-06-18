const { withXcodeProject } = require('@expo/config-plugins');

/**
 * Xcode 16+ enables User Script Sandboxing by default, which makes the
 * "[CP] Copy Pods Resources" build phase fail with a sandbox deny error when it
 * writes resources-to-copy-<target>.txt into the Pods directory. Disable it on
 * every build configuration of the app's Xcode project so the resource-copy
 * phase can run. Re-applied on each prebuild since the generated project
 * defaults the setting back to YES.
 */
const withUserScriptSandboxDisabled = (config) => {
  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const configurations = project.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(configurations)) {
      const buildSettings = configurations[key] && configurations[key].buildSettings;
      if (buildSettings && typeof buildSettings === 'object') {
        buildSettings.ENABLE_USER_SCRIPT_SANDBOXING = 'NO';
      }
    }
    return config;
  });
};

module.exports = withUserScriptSandboxDisabled;
