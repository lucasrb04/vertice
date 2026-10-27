import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getEnv } from "@/env";
import { lazy } from "@/lib/lazy";
import * as schema from "./schema";

let pool: Pool | undefined;

function createDb() {
  pool = new Pool({ connectionString: getEnv().DATABASE_URL });
  // Erro em cliente ocioso (ex.: Postgres reiniciou) não pode derrubar o processo.
  pool.on("error", (err) => {
    console.error("Erro em cliente ocioso do pool do Postgres:", err.message);
  });
  return drizzle(pool, { schema });
}

let instance: ReturnType<typeof createDb> | undefined;

/** Instância real (memoizada). Criada no primeiro uso, nunca no import. */
export function getDb(): ReturnType<typeof createDb> {
  instance ??= createDb();
  return instance;
}

export const db = lazy(getDb);

export type Db = ReturnType<typeof getDb>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export async function closeDb(): Promise<void> {
  await pool?.end();
}
