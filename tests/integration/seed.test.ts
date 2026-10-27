import { beforeEach, describe, it, expect } from "vitest";
import { eq, count } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { institutions, courses, tags, users } from "@/db/schema";
import { runSeed } from "@/db/seed";
import { COURSES, TAGS } from "@/db/seed-data";
import { resetDb } from "../helpers/db";

const total = async (t: PgTable) => (await db.select({ n: count() }).from(t))[0].n;

describe("runSeed", () => {
  beforeEach(resetDb);

  it("popula instituição, cursos e tags verificadas", async () => {
    await runSeed();
    expect(await total(institutions)).toBe(1);
    expect(await total(courses)).toBe(COURSES.length);
    const all = await db.select().from(tags);
    expect(all).toHaveLength(TAGS.length);
    expect(all.every((t) => t.isVerified)).toBe(true);
    expect(all.find((t) => t.name === "C++")?.normalizedSlug).toBe("c++");
  });

  it("é idempotente", async () => {
    await runSeed();
    await runSeed();
    expect(await total(courses)).toBe(COURSES.length);
    expect(await total(tags)).toBe(TAGS.length);
  });

  it("faz upsert: corrige nome de curso já existente", async () => {
    await runSeed();
    await db.update(courses).set({ name: "Nome Antigo" }).where(eq(courses.code, "CCO"));
    await runSeed();
    const [cco] = await db.select().from(courses).where(eq(courses.code, "CCO"));
    expect(cco.name).toBe("Ciência da Computação");
  });

  it("promove INITIAL_ADMIN_EMAIL existente a SYSTEM_ADMIN", async () => {
    await runSeed();
    const [inst] = await db.select().from(institutions);
    await db.insert(users).values({ institutionId: inst.id, name: "Admin", email: "admin@unifei.edu.br", emailVerified: true });
    await runSeed({ initialAdminEmail: "admin@unifei.edu.br" });
    const [u] = await db.select().from(users).where(eq(users.email, "admin@unifei.edu.br"));
    expect(u.systemRole).toBe("SYSTEM_ADMIN");
  });

  it("não falha nem cria usuário se INITIAL_ADMIN_EMAIL ainda não existe", async () => {
    await expect(runSeed({ initialAdminEmail: "ninguem@unifei.edu.br" })).resolves.toBeUndefined();
    expect(await total(users)).toBe(0);
  });
});
