// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // `features/` is orphaned reference code from another app (Athemi) — it
    // imports packages this project doesn't have and nothing here imports it.
    ignores: ['dist/*', 'features/**'],
  },
]);
