const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Defer module evaluation to first use instead of at bundle load. Metro rewrites
// top-level `require`s into call-site `require`s, so a heavy module is only
// evaluated when a screen actually touches it — regardless of whether it was
// imported statically or dynamically. This is what genuinely keeps the 189 KB
// ExerciseDatabase off the cold-start path: WorkoutGenerator's `await import()`
// achieved nothing on its own, because eight other modules import it statically.
config.transformer.getTransformOptions = async () => ({
  transform: { inlineRequires: true },
});

// NOTE — three settings were removed here on purpose; do not add them back:
//   config.resolver.resetCache = true  → not a real Metro option; did nothing.
//   config.cacheStores = []            → DISABLED the transform cache entirely,
//                                        forcing every module to be re-transformed
//                                        on every rebuild, every EAS build and
//                                        every CI run.
//   config.watchFolders = [__dirname]  → already the default.
// If you need a genuinely cold cache, use `npm run start:clean` instead.

module.exports = config;
