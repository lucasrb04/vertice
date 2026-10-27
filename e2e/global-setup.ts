import { execFileSync } from "node:child_process";

/** Migra, zera e semeia o banco de teste (5433) antes da suíte E2E. */
export default function globalSetup(): void {
  execFileSync("pnpm", ["exec", "tsx", "--env-file=.env.test", "e2e/prepare-db.ts"], {
    stdio: "inherit",
  });
}
