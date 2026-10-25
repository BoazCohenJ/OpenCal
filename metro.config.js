const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The F-Droid variant has no expo-updates (remote code loading isn't allowed there), so its JS
// imports resolve to an inert stub. See app.config.js.
if (process.env.OPENCAL_VARIANT === 'fdroid') {
  const upstream = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === 'expo-updates') {
      return { type: 'sourceFile', filePath: path.join(__dirname, 'src/stubs/expo-updates.ts') };
    }
    return (upstream ?? context.resolveRequest)(context, moduleName, platform);
  };
}

module.exports = config;
