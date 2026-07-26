const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Ensure all changes are picked up during development
config.resolver.resetCache = true;

// Ensure proper caching behavior
config.cacheStores = [];

// Watch all files in the project
config.watchFolders = [__dirname];

module.exports = config;
