import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { runSeed } from "@/db/seed";
import { opportunityTags, tagAliases, tags } from "@/db/schema";
import { NotFoundError } from "@/lib/auth/errors";
import { RateLimitError, ValidationError } from "@/lib/domain-errors";
import { tagCreationLimiter } from "@/lib/security/rate-limit";
import { searchTags, syncOpportunityTags, type TagGroups } from "@/lib/tags/service";
import { getDefaultInstitution } from "@/lib/tenant";
import { resetDb } from "../helpers/db";
import { mkForeignInstitution, mkOpportunity, mkProject, mkUser } from "../helpers/fixtures";

const empty: TagGroups = { THEME: [], DESIRED_SKILL: [], DEVELOPED_SKILL: [] };

async function setup() {
  const inst = await getDefaultInstitution();
  const user = await mkUser("a@unifei.edu.br");
  const project = await mkProject();
  const opp = await mkOpportunity(project.id);
  const ctx = { institutionId: inst.id, userId: user.id, opportunityId: opp.id };
  const sync = (groups: Partial<TagGroups>) =>
    db.transaction((tx) => syncOpportunityTags(tx, ctx, { ...empty, ...groups }));
  return { inst, user, opp, ctx, sync };
}

const bySlug = async (slug: string) => (await db.select().from(tags).where(eq(tags.normalizedSlug, slug)))[0];

describe("tags service", () => {
  beforeEach(async () => {
    await resetDb();
    await runSeed();
    tagCreationLimiter.reset();
  });

  it("reutiliza tag existente ignorando caixa, espaços e acentos", async () => {
    const { sync, opp } = await setup();
    const before = await db.select().from(tags);
    await sync({ THEME: [{ name: "python " }], DESIRED_SKILL: [{ name: "PYTHON" }] });
    expect(await db.select().from(tags)).toHaveLength(before.length);
    const rows = await db.select().from(opportunityTags).where(eq(opportunityTags.opportunityId, opp.id));
    expect(rows).toHaveLength(2);
  });

  it("mesmo nome novo em dois grupos cria uma tag só", async () => {
    const { sync, opp, user } = await setup();
    await sync({ THEME: [{ name: "Telemetria CAN" }], DEVELOPED_SKILL: [{ name: "telemetria can" }] });
    const tag = await bySlug("telemetria-can");
    expect(tag.isVerified).toBe(false);
    expect(tag.createdByUserId).toBe(user.id);
    expect(tag.usageCount).toBe(1);
    const rows = await db.select().from(opportunityTags).where(eq(opportunityTags.opportunityId, opp.id));
    expect(rows).toHaveLength(2);
  });

  it("deduplica refs que resolvem para a mesma tag no mesmo grupo", async () => {
    const { sync, opp } = await setup();
    const python = await bySlug("python");
    await sync({ THEME: [{ id: python.id }, { name: "Python" }] });
    const rows = await db.select().from(opportunityTags).where(eq(opportunityTags.opportunityId, opp.id));
    expect(rows).toHaveLength(1);
  });

  it("alias resolve para a tag canônica", async () => {
    const { sync, inst, opp } = await setup();
    const python = await bySlug("python");
    await db.insert(tagAliases).values({ institutionId: inst.id, aliasSlug: "pyhton", canonicalTagId: python.id });
    const before = await db.select().from(tags);
    await sync({ THEME: [{ name: "Pyhton" }] });
    expect(await db.select().from(tags)).toHaveLength(before.length);
    const rows = await db.select().from(opportunityTags).where(eq(opportunityTags.opportunityId, opp.id));
    expect(rows.map((r) => r.tagId)).toEqual([python.id]);
  });

  it("id de tag de outra instituição é recusado", async () => {
    const { sync } = await setup();
    const foreign = await mkForeignInstitution();
    const [other] = await db
      .insert(tags)
      .values({ institutionId: foreign.id, name: "Alheia", normalizedSlug: "alheia" })
      .returning();
    await expect(sync({ THEME: [{ id: other.id }] })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("nome sem caracteres válidos é ValidationError no campo tags", async () => {
    const { sync } = await setup();
    const err = await sync({ THEME: [{ name: "!!!" }] }).catch((e) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.fieldErrors).toEqual({ tags: ["Tag inválida."] });
  });

  it("usageCount acompanha adicionar, mover entre grupos e remover", async () => {
    const { sync } = await setup();
    const python = await bySlug("python");
    const count = async () => (await bySlug("python")).usageCount;
    const start = python.usageCount;
    await sync({ THEME: [{ id: python.id }] });
    expect(await count()).toBe(start + 1);
    await sync({ DESIRED_SKILL: [{ id: python.id }] });
    expect(await count()).toBe(start + 1);
    await sync({});
    expect(await count()).toBe(start);
    await sync({});
    expect(await count()).toBe(start);
  });

  it("usageCount nunca fica negativo", async () => {
    const { sync, opp } = await setup();
    const python = await bySlug("python");
    await sync({ THEME: [{ id: python.id }] });
    await db.update(tags).set({ usageCount: 0 }).where(eq(tags.id, python.id));
    await sync({});
    expect((await bySlug("python")).usageCount).toBe(0);
    expect(await db.select().from(opportunityTags).where(and(eq(opportunityTags.opportunityId, opp.id)))).toHaveLength(0);
  });

  it("31ª tag nova na hora é recusada", async () => {
    const { sync } = await setup();
    await sync({ THEME: Array.from({ length: 10 }, (_, i) => ({ name: `Nova A${i}` })), DESIRED_SKILL: Array.from({ length: 10 }, (_, i) => ({ name: `Nova B${i}` })), DEVELOPED_SKILL: Array.from({ length: 10 }, (_, i) => ({ name: `Nova C${i}` })) });
    await expect(sync({ THEME: [{ name: "Nova extra" }] })).rejects.toBeInstanceOf(RateLimitError);
  });

  it("searchTags encontra por nome e por slug sem acento", async () => {
    const { inst } = await setup();
    const found = await searchTags(inst.id, "inteligencia");
    expect(found.map((t) => t.name)).toContain("Inteligência Artificial");
    expect(await searchTags(inst.id, "")).toEqual([]);
  });
});
