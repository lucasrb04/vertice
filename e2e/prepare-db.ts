import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { closeDb } from "@/db";
import { runSeed } from "@/db/seed";
import { assertTestDatabase } from "@/db/test-db-guard";
import { getEnv } from "@/env";
import { resetDb } from "../tests/helpers/db";

// Executado por e2e/global-setup.ts com o ambiente de .env.test: migra, zera e semeia o banco de teste.
async function main(): Promise<void> {
  assertTestDatabase(getEnv().NODE_ENV, getEnv().DATABASE_URL); // antes de migrar ou zerar qualquer coisa
  const pool = new Pool({ connectionString: getEnv().DATABASE_URL });
  try {
    await migrate(drizzle(pool), { migrationsFolder: resolve(process.cwd(), "drizzle") });
  } finally {
    await pool.end();
  }
  await resetDb();
  await runSeed();
  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
