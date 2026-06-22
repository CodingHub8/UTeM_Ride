const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

const config = getDefaultConfig(__dirname);

// Resolve symlinks/junctions dynamically to prevent Metro watch errors on Windows
try {
  const realPath = fs.realpathSync(__dirname);
  if (realPath !== __dirname) {
    console.log(`[Metro Config] Running inside junction. Adding watch folders:`);
    console.log(`  - Junction: ${__dirname}`);
    console.log(`  - Real Path: ${realPath}`);
    
    config.watchFolders = [
      __dirname,
      realPath,
      path.join(realPath, 'node_modules')
    ];
  }
} catch (e) {
  console.warn('[Metro Config] Failed to resolve realpath:', e.message);
}

module.exports = config;
