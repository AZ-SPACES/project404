const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withSwiftUICoreFix = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfile = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      if (fs.existsSync(podfile)) {
        let contents = fs.readFileSync(podfile, 'utf8');

        if (!contents.includes('DEAD_CODE_STRIPPING')) {
          const patch = `  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['DEAD_CODE_STRIPPING'] = 'YES'
      
      # Xcode 16 SwiftUICore fix
      search_paths = config.build_settings['LIBRARY_SEARCH_PATHS'] || ['$(inherited)']
      unless search_paths.include?('$(SDKROOT)/System/Library/Frameworks/SwiftUICore.framework')
        search_paths << '$(SDKROOT)/System/Library/Frameworks/SwiftUICore.framework'
        config.build_settings['LIBRARY_SEARCH_PATHS'] = search_paths
      end
    end
  end
`;
          // insert it inside the post_install block
          contents = contents.replace(/post_install do \|installer\|/g, `post_install do |installer|\n\n${patch}`);
          fs.writeFileSync(podfile, contents);
        }
      }
      return config;
    },
  ]);
};

module.exports = withSwiftUICoreFix;
