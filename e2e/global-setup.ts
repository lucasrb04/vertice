import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";

/** Migra, zera e semeia o banco de teste (5433) antes da suíte E2E. */
export default function globalSetup(): void {
  // Os valores de .env.test vencem qualquer variável já exportada no shell (ex.: DATABASE_URL de dev).
  const testEnv = parseEnv(readFileSync(".env.test", "utf8"));
  execFileSync("pnpm", ["exec", "tsx", "e2e/prepare-db.ts"], {
    stdio: "inherit",
    env: { ...process.env, ...testEnv },
  });
}
