const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Ported from a hand-edited ios/Podfile post_install hook (see git history:
// d70102d, d5166f4, c44500a) when the native ios/ directory was removed in
// favor of a fresh prebuild on every EAS build. Without this, EAS's cached
// Windows-originated checkout can leave .xcode.env with CRLF endings, which
// breaks bash sourcing and leaves NODE_BINARY unset during the
// [Expo] Configure project build phase.
const POST_INSTALL_FIX = `
    xcode_env_path = File.join(__dir__, '.xcode.env')
    if File.exist?(xcode_env_path)
      raw = File.binread(xcode_env_path)
      fixed = raw.gsub("\\r\\n", "\\n").gsub("\\r", "\\n")
      File.binwrite(xcode_env_path, fixed) if raw != fixed
    end

    node_binary = \`command -v node\`.strip
    unless node_binary.empty?
      File.write(File.join(__dir__, '.xcode.env.local'), "export NODE_BINARY=#{node_binary}\\n")
    end
`;

const CALL_REGEX = /react_native_post_install\([\s\S]*?\n {4}\)\n/;

function withXcodeEnvFix(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      const contents = fs.readFileSync(podfilePath, 'utf8');

      if (contents.includes('xcode_env_path')) {
        return config;
      }

      const match = contents.match(CALL_REGEX);
      if (!match) {
        throw new Error(
          'withXcodeEnvFix: could not find react_native_post_install(...) call in Podfile to anchor the .xcode.env fix.'
        );
      }

      const insertAt = match.index + match[0].length;
      const patched = contents.slice(0, insertAt) + POST_INSTALL_FIX + contents.slice(insertAt);
      fs.writeFileSync(podfilePath, patched);

      return config;
    },
  ]);
}

module.exports = withXcodeEnvFix;
