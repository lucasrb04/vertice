import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import type { OpportunityStatus, ProjectStatus } from "@/db/schema";
import { opportunities, projects } from "@/db/schema";
import { runSeed } from "@/db/seed";
import { openOpportunitySql } from "@/lib/opportunities/status";
import { getDefaultInstitution } from "@/lib/tenant";
import { resetDb } from "../helpers/db";

const now = new Date("2026-10-27T12:00:00Z");
const future = new Date("2026-11-01T02:59:59Z");
const past = new Date("2026-10-20T02:59:59Z");

describe("openOpportunitySql", () => {
  beforeEach(async () => {
    await resetDb();
    await runSeed();
  });

  it("retorna só o processo aberto de projeto ativo", async () => {
    const inst = await getDefaultInstitution();
    const mkProject = async (slug: string, status: ProjectStatus) =>
      (
        await db
          .insert(projects)
          .values({
            institutionId: inst.id,
            slug,
            name: slug,
            shortDescription: "d",
            category: "SCIENTIFIC_INIT",
            contactEmail: "c@unifei.edu.br",
            status,
          })
          .returning()
      )[0]!;
    const mkOpp = async (projectId: string, slug: string, status: OpportunityStatus, deadlineAt: Date) =>
      db.insert(opportunities).values({
        institutionId: inst.id,
        projectId,
        slug,
        title: slug,
        description: "d",
        status,
        internalSelectionEnabled: true, // satisfaz a constraint opportunities_has_channel
        deadlineAt,
      });

    const active = await mkProject("ativo", "ACTIVE");
    const archived = await mkProject("arquivado", "ARCHIVED");
    await mkOpp(active.id, "aberto", "OPEN", future);
    await mkOpp(active.id, "vencido", "OPEN", past);
    await mkOpp(active.id, "fechado", "CLOSED", future);
    await mkOpp(active.id, "em-analise", "UNDER_REVIEW", future);
    await mkOpp(archived.id, "projeto-arquivado", "OPEN", future);

    const rows = await db
      .select({ slug: opportunities.slug })
      .from(opportunities)
      .innerJoin(projects, eq(projects.id, opportunities.projectId))
      .where(openOpportunitySql(now));
    expect(rows.map((r) => r.slug)).toEqual(["aberto"]);
  });
});
