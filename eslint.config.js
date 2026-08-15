// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const welliva = require('./eslint-rules');

module.exports = defineConfig([
  expoConfig,
  {
    // Accessibility ratchet. Starts as a WARNING so it counts against the
    // --max-warnings ceiling in CI without blocking today's work; lower the
    // ceiling as screens get labelled, then promote this to "error" once the
    // count reaches zero. See docs/accessibility.md.
    files: ['app/**/*.tsx', 'components/**/*.tsx', 'fitness/**/*.tsx'],
    plugins: { welliva },
    rules: {
      'welliva/has-accessible-name': 'warn',
    },
  },
  {
    // Build output — both gitignored. (The old `features/**` ignore was dropped:
    // that directory is no longer on disk, and config that guards nothing is
    // misleading during review.)
    ignores: ['dist/*', 'catalogs-dist/**'],
  },
  {
    // Node build scripts — not React Native. `__dirname`, `Buffer`, `process`
    // and friends are legitimate here, so the browser-globals environment that
    // the Expo preset applies to app code produces false `no-undef` errors.
    files: ['scripts/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        __dirname: 'readonly',
        __filename: 'readonly',
        Buffer: 'readonly',
        process: 'readonly',
        module: 'writable',
        require: 'readonly',
        exports: 'writable',
      },
    },
  },
  {
    // Test files: imports legitimately come AFTER the `vi.mock(...)` block.
    //
    // `import/first` is right for app code and wrong here. Vitest hoists
    // `vi.mock` above the imports at transform time, so the calls must be
    // readable before the imports they intercept — writing them in the order
    // the rule wants would put the mock below the import it replaces, which
    // reads as a bug to anyone reviewing it. Every test in this repo already
    // follows the mock-then-import layout.
    //
    // Scoped to test files only, and only this rule: 21 warnings that no one
    // can ever action were crowding out the accessibility ratchet above, which
    // is a count we actually want to drive to zero.
    files: ['**/*.test.ts', '**/*.test.tsx', '**/__tests__/**'],
    rules: {
      'import/first': 'off',
    },
  },
  {
    // Same, for the ESM build scripts (`.mjs` — real `import`/`export`).
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      sourceType: 'module',
      globals: {
        Buffer: 'readonly',
        process: 'readonly',
      },
    },
  },
]);
