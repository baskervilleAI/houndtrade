const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add support for additional file extensions
config.resolver.assetExts.push('db', 'mp3', 'ttf', 'obj', 'png', 'jpg');

// Add support for TypeScript paths
config.resolver.alias = {
  '@': './src',
  '@components': './src/components',
  '@screens': './src/screens',
  '@stores': './src/stores',
  '@services': './src/services',
  '@utils': './src/utils',
  '@types': './src/types',
  '@config': './src/config',
  '@assets': './assets',
};

// Fix for import.meta issues in web builds
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Tamagui configuration
config.transformer.minifierConfig = {
  keep_fnames: true,
  mangle: {
    keep_fnames: true,
  },
};

// Web-specific configuration
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: false,
  },
});

module.exports = config;