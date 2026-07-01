const path = require('path');

const workspaceRoot = __dirname;
const projectRoot = path.resolve(workspaceRoot, 'apps/mobile');

// expo is in the mobile app's node_modules, not the workspace root
const { getDefaultConfig } = require(path.join(projectRoot, 'node_modules', 'expo', 'metro-config'));

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
