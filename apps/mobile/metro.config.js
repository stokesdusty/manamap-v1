const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Windows: jest-worker child process spawning fails with UNKNOWN/-4094 when
// the OS or antivirus blocks forking. Single worker avoids the issue.
config.maxWorkers = 1;

module.exports = config;
