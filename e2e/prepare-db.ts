import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { closeDb } from "@/db";
import { runSeed } from "@/db/seed";
import { resetDb } from "../tests/helpers/db";

// Executado via tsx com `--env-file=.env.test`: migra, zera e semeia o banco de teste.
async function main(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
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
