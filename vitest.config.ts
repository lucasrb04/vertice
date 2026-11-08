import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

const testEnv = parseEnv(readFileSync(".env.test", "utf8"));

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    // Unitários e integração somados numa medição só. Páginas e componentes ficam com os E2E.
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/actions/**", "src/db/**", "src/env.ts", "src/proxy.ts"],
      exclude: ["src/db/seed-data.ts", "src/db/seed-demo.ts", "src/lib/email/templates/**", "src/db/schema/**"],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
      reporter: ["text-summary", "text"],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.{ts,tsx}"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          fileParallelism: false,
          globalSetup: ["tests/setup/integration-global-setup.ts"],
          env: testEnv,
        },
      },
    ],
  },
});
