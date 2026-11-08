import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { closeDb, getDb } from "@/db";

/**
 * Aplica as migrations de `drizzle/` com o migrador do drizzle-orm, o mesmo journal e a mesma tabela
 * (`drizzle.__drizzle_migrations`) do `drizzle-kit migrate`. Produção usa este script para a imagem
 * migrate não levar o drizzle-kit e o esbuild antigo que vem com ele.
 */
export async function runMigrations(): Promise<void> {
  await migrate(getDb(), { migrationsFolder: resolve(process.cwd(), "drizzle") });
}

const isDirectRun = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  runMigrations()
    .then(() => console.log("Migrations aplicadas."))
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => closeDb());
}
