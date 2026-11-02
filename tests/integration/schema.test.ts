import { beforeEach, describe, it, expect } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { institutions, projects, opportunities } from "@/db/schema";
import { resetDb } from "../helpers/db";

describe("schema", () => {
  beforeEach(resetDb);

  it("tem as extensões pg_trgm, unaccent, fuzzystrmatch e uuid-ossp", async () => {
    const rows = await db.execute(sql`select extname from pg_extension`);
    const names = rows.rows.map((r) => r.extname);
    expect(names).toEqual(expect.arrayContaining(["pg_trgm", "unaccent", "fuzzystrmatch", "uuid-ossp"]));
  });

  async function setup(suffix: string) {
    const [inst] = await db.insert(institutions).values({ slug: `t${suffix}`, name: "T", shortName: "T" }).returning();
    const [proj] = await db.insert(projects).values({
      institutionId: inst.id, slug: "p", name: "P", shortDescription: "d",
      category: "LAB_GROUP", contactEmail: "p@x.com",
    }).returning();
    return { inst, proj };
  }

  it("recusa processo sem link do edital e sem seleção pela plataforma (CHECK)", async () => {
    const { inst, proj } = await setup("a");
    // O Drizzle embrulha o erro do pg: o nome da constraint fica em `cause`.
    const err = await db.insert(opportunities).values({
      institutionId: inst.id, projectId: proj.id, slug: "v", title: "V",
      description: "d", internalSelectionEnabled: false, deadlineAt: new Date(),
    }).then(() => null, (e: unknown) => e as { cause?: { constraint?: string } });
    expect(err?.cause?.constraint).toBe("opportunities_has_channel");
  });

  it("aceita processo só com link do edital", async () => {
    const { inst, proj } = await setup("b");
    const [opp] = await db.insert(opportunities).values({
      institutionId: inst.id, projectId: proj.id, slug: "v", title: "V",
      description: "d", internalSelectionEnabled: false, deadlineAt: new Date(),
      externalUrl: "https://unifei.edu.br/edital.pdf",
    }).returning();
    expect(opp.id).toBeTruthy();
  });

  it("gera ids uuid", async () => {
    const [inst] = await db.insert(institutions).values({ slug: "u", name: "U", shortName: "U" }).returning();
    expect(inst.id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
