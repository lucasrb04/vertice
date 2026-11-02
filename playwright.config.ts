import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;
const testEnv = parseEnv(readFileSync(".env.test", "utf8"));

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { baseURL: BASE_URL },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm dev --port ${PORT}`,
    // "/" consulta a instituição, e o servidor sobe antes do globalSetup zerar e semear o banco: pingar a
    // home guardaria o id antigo no cache de tenant (ou daria 500 num banco vazio). /entrar não toca o banco
    // sem sessão e já compila o layout raiz, evitando recargas do dev server durante o primeiro teste.
    url: `${BASE_URL}/entrar`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...testEnv,
      // A origem do navegador é :3100; a rota /api/sign-out rejeita requisições de outra origem.
      BETTER_AUTH_URL: BASE_URL,
      NEXT_PUBLIC_APP_URL: BASE_URL,
    },
  },
});
