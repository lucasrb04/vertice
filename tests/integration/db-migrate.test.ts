import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sql } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { runMigrations } from "@/db/migrate";

const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as { entries: unknown[] };

// Migrations de produção sem drizzle-kit: a imagem migrate não leva o esbuild antigo que ele traz.
describe("runMigrations", () => {
  it("aplica todas as migrations do journal e é idempotente", async () => {
    await runMigrations();
    await runMigrations();
    const rows = await db.execute(sql`select count(*)::int as n from drizzle.__drizzle_migrations`);
    expect(rows.rows[0].n).toBe(journal.entries.length);
  });
});

describe("db:migrate:deploy (execução direta do script)", () => {
  it("aplica as migrations, avisa no console e não marca erro", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const argv1 = process.argv[1];
    process.argv[1] = resolve("src/db/migrate.ts");
    try {
      vi.resetModules();
      await import("@/db/migrate");
      await vi.waitFor(() => expect(log).toHaveBeenCalledWith("Migrations aplicadas."));
      expect(process.exitCode ?? 0).toBe(0);
    } finally {
      process.argv[1] = argv1;
      log.mockRestore();
    }
  });
});
