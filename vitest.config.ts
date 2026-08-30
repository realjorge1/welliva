import { defineConfig } from "vitest/config";

/**
 * Vitest config for the pure `health-os/` and `fitness/` layers
 * (docs/architecture/11-testing-strategy.md). Node environment — the domain
 * code is pure + storage-port-injected, so no React Native runtime is needed.
 * `resolve.tsconfigPaths` mirrors the `@/*` alias from tsconfig natively; the
 * setup file mocks AsyncStorage so the module graph loads.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: [
      "health-os/**/*.test.ts",
      "fitness/**/*.test.ts",
      "practices/**/*.test.ts",
      "components/charts/**/*.test.ts",
      "components/home/**/*.test.ts",
      "components/navigation/**/*.test.ts",
      "components/__tests__/**/*.test.ts",
      "constants/**/*.test.ts",
      "lib/**/*.test.ts",
      "services/sync/**/*.test.ts",
      "services/nutrition/**/*.test.ts",
      "services/gozlin/**/*.test.ts",
      "services/api/**/*.test.ts",
      "services/catalogs/**/*.test.ts",
      "services/__tests__/**/*.test.ts",
      "services/account/**/*.test.ts",
      "models/__tests__/**/*.test.ts",
    ],
  },
});
