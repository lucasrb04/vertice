import { sql } from "drizzle-orm";
import { db } from "@/db";
import { clearTenantCache } from "@/lib/tenant";

/** Esvazia todas as tabelas do schema público (exceto o controle de migrations do Drizzle). */
export async function resetDb(): Promise<void> {
  clearTenantCache();
  const { rows } = await db.execute<{ tablename: string }>(sql`
    select tablename from pg_tables
    where schemaname = 'public' and tablename <> '__drizzle_migrations'
  `);
  if (rows.length === 0) return;
  const names = rows.map((r) => `"public"."${r.tablename}"`).join(", ");
  await db.execute(sql.raw(`TRUNCATE ${names} RESTART IDENTITY CASCADE`));
}
