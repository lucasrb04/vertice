import { beforeEach, describe, it, expect } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { institutions, projects, opportunities } from "@/db/schema";
import { resetDb } from "../helpers/db";

describe("schema", () => {
  beforeEach(resetDb);

  it("tem as extensões pg_trgm, unaccent e uuid-ossp", async () => {
    const rows = await db.execute(sql`select extname from pg_extension`);
    const names = rows.rows.map((r) => r.extname);
    expect(names).toEqual(expect.arrayContaining(["pg_trgm", "unaccent", "uuid-ossp"]));
  });

  it("recusa vaga EXTERNAL sem external_url (CHECK)", async () => {
    const [inst] = await db.insert(institutions).values({ slug: "t", name: "T", shortName: "T" }).returning();
    const [proj] = await db.insert(projects).values({
      institutionId: inst.id, slug: "p", name: "P", shortDescription: "d",
      category: "LAB_GROUP", contactEmail: "p@x.com",
    }).returning();
    // O Drizzle embrulha o erro do pg: o nome da constraint fica em `cause`.
    const err = await db.insert(opportunities).values({
      institutionId: inst.id, projectId: proj.id, slug: "v", title: "V",
      description: "d", applicationMode: "EXTERNAL",
    }).then(() => null, (e: unknown) => e as { cause?: { constraint?: string } });
    expect(err?.cause?.constraint).toBe("opportunities_external_url_required");
  });

  it("gera ids uuid", async () => {
    const [inst] = await db.insert(institutions).values({ slug: "u", name: "U", shortName: "U" }).returning();
    expect(inst.id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
