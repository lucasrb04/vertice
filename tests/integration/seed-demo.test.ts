import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { count, eq } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { opportunities, opportunityTags, projectMembers, projects, tags, users } from "@/db/schema";
import { runSeed } from "@/db/seed";
import { DEMO_OWNER_EMAIL, runDemoSeed } from "@/db/seed-demo";
import { getPublicOpportunity, getPublicProject } from "@/lib/public/queries";
import { getDefaultInstitution } from "@/lib/tenant";
import { resetDb } from "../helpers/db";

const total = async (t: PgTable) => (await db.select({ n: count() }).from(t))[0].n;
const now = new Date("2026-11-02T15:00:00Z");

describe("runDemoSeed", () => {
  beforeEach(async () => {
    await resetDb();
    await runSeed();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("cria projetos e processos Demo, com verificado, arquivado e encerrado", async () => {
    await runDemoSeed(now);
    const ps = await db.select().from(projects);
    const os = await db.select().from(opportunities);
    expect(ps.length).toBeGreaterThanOrEqual(3);
    expect(ps.every((p) => p.name.startsWith("Demo") && p.slug.startsWith("demo-"))).toBe(true);
    expect(os.every((o) => o.title.startsWith("Demo") && o.slug.startsWith("demo-"))).toBe(true);
    expect(ps.some((p) => p.hasInstitutionalBadge)).toBe(true);
    expect(ps.some((p) => p.status === "ARCHIVED")).toBe(true);

    const inst = await getDefaultInstitution();
    const details = await Promise.all(os.map((o) => getPublicOpportunity(inst.id, o.slug, now)));
    expect(details.every(Boolean)).toBe(true);
    expect(details.some((d) => d!.isOpen)).toBe(true);
    expect(details.some((d) => !d!.isOpen && d!.closedOn)).toBe(true);
    expect(details.some((d) => d!.tags.THEME.length > 0 && d!.courses.length > 0)).toBe(true);

    for (const p of ps) expect(await getPublicProject(inst.id, p.slug, now)).not.toBeNull();
  });

  it("o dono demo é membro OWNER de todos os projetos", async () => {
    await runDemoSeed(now);
    const [owner] = await db.select().from(users).where(eq(users.email, DEMO_OWNER_EMAIL));
    expect(owner).toBeDefined();
    const members = await db.select().from(projectMembers).where(eq(projectMembers.userId, owner!.id));
    expect(members).toHaveLength(await total(projects));
    expect(members.every((m) => m.role === "OWNER")).toBe(true);
  });

  it("é idempotente, atualiza datas e preserva contadores", async () => {
    await runDemoSeed(now);
    const before = {
      users: await total(users),
      projects: await total(projects),
      opportunities: await total(opportunities),
      members: await total(projectMembers),
      links: await total(opportunityTags),
    };
    const usage = await db.select({ id: tags.id, n: tags.usageCount }).from(tags).orderBy(tags.id);
    const [first] = await db.select().from(opportunities).orderBy(opportunities.slug).limit(1);
    await db.update(opportunities).set({ viewsCount: 7 }).where(eq(opportunities.id, first!.id));

    const later = new Date(now.getTime() + 10 * 24 * 3_600_000);
    await runDemoSeed(later);

    expect({
      users: await total(users),
      projects: await total(projects),
      opportunities: await total(opportunities),
      members: await total(projectMembers),
      links: await total(opportunityTags),
    }).toEqual(before);
    expect(await db.select({ id: tags.id, n: tags.usageCount }).from(tags).orderBy(tags.id)).toEqual(usage);
    const [again] = await db.select().from(opportunities).where(eq(opportunities.id, first!.id));
    expect(again!.viewsCount).toBe(7);
    expect(again!.deadlineAt.getTime()).toBeGreaterThan(first!.deadlineAt.getTime());
  });

  it("recusa NODE_ENV=production sem tocar no banco", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(runDemoSeed(now)).rejects.toThrow(/produção/);
    expect(await total(projects)).toBe(0);
  });
});
